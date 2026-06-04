/**
 * Import/export job worker (SPEC-IMPORT-001 §16, D-IMPORT-2/3). Drains dry-run,
 * commit, and export jobs. Event-driven: it blocks on the Redis queue (BLPOP) and
 * wakes the instant a job is enqueued (rpush in importExport.composition.ts), then
 * drains the DB until empty. The DB sweep is authoritative; the Redis list is the
 * low-latency wakeup signal. A separate low-frequency safety sweep (registered on
 * the scheduler) catches jobs enqueued while Redis was down. Uses a dedicated
 * blocking Redis connection so it never stalls the notification consumer.
 */
import config from '@config/config';
import logger from '@services/logger.service';
import redisService from '@services/redis.service';
import { delay } from '@services/delay.service';
import importExportDomain from '@infrastructure/composition/importExport.composition';

let running = false; // drain() re-entrancy guard
let isConsuming = false; // consumer loop liveness flag

const queueKey = config.db.redis.queues.importExportJobs;
const blockSeconds = config.importExport.workerBlockSeconds;

/** Process pending jobs until the DB queue is drained. */
async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    // Clear any extra Redis wakeup signals (best effort); they only hint work exists.
    try {
      if ((await redisService.llen(queueKey)) > 0) await redisService.del(queueKey);
    } catch {
      // Redis down: the DB sweep below still makes progress.
    }
    let didWork = true;
    while (didWork) {
      didWork = await importExportDomain.processPending();
    }
  } catch (error) {
    logger.error(__filename, 'drain', 'import/export sweep failed', error);
  } finally {
    running = false;
  }
}

/** Block on the queue; on each wakeup (or timeout) drain the DB fully. */
async function consume(): Promise<void> {
  while (isConsuming) {
    try {
      await redisService.blpopImportExport(queueKey, blockSeconds);
      if (!isConsuming) break;
      await drain();
    } catch (error) {
      // Connection-level failure: back off, re-probe, loop. The scheduler safety
      // sweep still drains the DB while Redis is unavailable.
      logger.error(__filename, 'consume', 'import/export consumer error', error);
      await delay(5000);
      await redisService.isReady().catch(() => undefined);
    }
  }
}

export const importExportWorker = {
  start(): void {
    if (!config.importExport.enabled) {
      logger.info(__filename, 'start', 'import/export worker disabled', '');
      return;
    }
    if (isConsuming) return;
    isConsuming = true;
    void consume();
    // Drain once on boot to pick up jobs enqueued while the worker was down.
    void drain();
    logger.info(__filename, 'start', 'import/export worker started (event-driven)', '');
  },
  stop(): void {
    isConsuming = false;
  },
  /** Low-frequency safety sweep for the scheduler (Redis-down enqueue path). */
  sweep: drain,
};

export default importExportWorker;
