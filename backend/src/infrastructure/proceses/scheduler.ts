/**
 * Redis-backed periodic scheduler.
 *
 * Replaces the scattered bare `setInterval` maintenance timers. A single ticker
 * drives every registered task; each task's `lastRunAt` is persisted in Redis so a
 * process restart does NOT reset its clock (a 6h job stays ~6h even across frequent
 * deploys), and a SETNX lock keeps the job single-runner across instances.
 *
 * Degrades gracefully: if Redis is unavailable the scheduler falls back to an
 * in-memory lastRun map and skips locking, so jobs still run (matching the
 * "Redis down → work still progresses" posture in importExportWorker.ts).
 */
import { randomUUID } from 'crypto';
import config from '@config/config';
import logger from '@services/logger.service';
import redisService from '@services/redis.service';

export interface ScheduledTask {
  /** Stable, unique name — used for the Redis lastRunAt/lock keys. */
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  /** Single-runner across instances via SETNX. Defaults to true; set false for
   *  already race-safe jobs (e.g. the notification reaper). */
  lock?: boolean;
}

const { keyPrefix, lockTtlSec, tickMs } = config.maintenance;

// Stable per-process identity used as the lock owner value.
const instanceId = process.env.HOSTNAME || randomUUID();

const tasks: ScheduledTask[] = [];
// Fallback schedule state when Redis cannot be read/written.
const memoryLastRun = new Map<string, number>();
let timer: NodeJS.Timeout | null = null;
let ticking = false;

const lastKey = (name: string): string => `${keyPrefix}${name}:last`;
const lockKey = (name: string): string => `${keyPrefix}${name}:lock`;

async function getLastRun(name: string): Promise<number> {
  try {
    const raw = await redisService.get(lastKey(name));
    if (raw !== null) return Number(raw);
  } catch {
    // Redis down — fall through to the in-memory value.
  }
  return memoryLastRun.get(name) ?? 0;
}

async function setLastRun(name: string, ts: number): Promise<void> {
  memoryLastRun.set(name, ts);
  try {
    await redisService.set(lastKey(name), String(ts));
  } catch {
    // Redis down: the in-memory map keeps the schedule moving until it recovers.
  }
}

async function acquireLock(name: string): Promise<boolean> {
  try {
    return await redisService.setNx(lockKey(name), instanceId, lockTtlSec);
  } catch {
    // No coordination available — allow the run so the job is not starved.
    return true;
  }
}

async function releaseLock(name: string): Promise<void> {
  try {
    await redisService.del(lockKey(name));
  } catch {
    // Best effort; the lock TTL is the backstop if the runner dies mid-job.
  }
}

async function runTask(task: ScheduledTask, now: number): Promise<void> {
  if (now - (await getLastRun(task.name)) < task.intervalMs) return;

  const locked = task.lock !== false;
  // Acquire the lock before running so two instances never run the same window.
  if (locked && !(await acquireLock(task.name))) return;

  try {
    await task.handler();
    await setLastRun(task.name, now);
  } catch (error) {
    logger.error(__filename, 'scheduler', `task '${task.name}' failed`, error);
  } finally {
    if (locked) await releaseLock(task.name);
  }
}

async function tick(): Promise<void> {
  if (ticking) return; // never overlap ticks
  ticking = true;
  const now = Date.now();
  try {
    for (const task of tasks) {
      await runTask(task, now);
    }
  } finally {
    ticking = false;
  }
}

const scheduler = {
  register(task: ScheduledTask): void {
    tasks.push(task);
  },
  start(): void {
    if (timer) return;
    timer = setInterval(() => void tick(), tickMs);
    logger.info(__filename, 'scheduler', `started (${tasks.length} task(s), tick ${tickMs}ms)`, '');
  },
  stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  },
};

export default scheduler;
