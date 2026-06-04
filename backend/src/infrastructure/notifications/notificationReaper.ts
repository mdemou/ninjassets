import config from '@config/config';
import { NotificationEnvelope } from '@services/notifications/notification.types';
import redisService from '@services/redis.service';
import logger from '@services/logger.service';

/**
 * Requeues notification jobs stranded in the processing list by a crashed/slow
 * consumer (SPEC-WEBHOOK-001 §7, at-least-once). An entry older than the
 * visibility timeout is removed from processing and pushed back to the main
 * queue with retries+1 and a fresh enqueuedAt, until maxRetries — then dropped.
 *
 * Caveats (honored here): age by `enqueuedAt` (reset on requeue ≈ claim time,
 * since BRPOPLPUSH happens right after enqueue); `LREM` the exact byte string
 * read back; skip when LREM removes 0 (another worker already acked/requeued).
 */
export const notificationReaper = {
  async reap(): Promise<void> {
    if (!config.notifications.enabled) return;
    const processing = config.db.redis.queues.notificationsProcessing;
    const main = config.db.redis.queues.notifications;

    let entries: string[];
    try {
      entries = await redisService.lrange(processing, 0, -1);
    } catch (error) {
      logger.error(__filename, 'reap', 'failed to read processing list', error);
      return;
    }

    const now = Date.now();
    for (const raw of entries) {
      let env: NotificationEnvelope;
      try {
        env = JSON.parse(raw) as NotificationEnvelope;
      } catch {
        // Poison entry — remove it so it cannot loop forever.
        await redisService.lrem(processing, 1, raw);
        continue;
      }

      const age = now - new Date(env.enqueuedAt).getTime();
      if (age < config.notifications.visibilityTimeoutMs) continue;

      const removed = await redisService.lrem(processing, 1, raw);
      if (removed === 0) continue; // someone else already acked/requeued it

      if ((env.retries ?? 0) >= config.notifications.maxRetries) {
        logger.error(__filename, 'reap', `dropping notification ${env.id} after maxRetries`, {
          kind: env.kind,
          type: env.type,
        });
        continue;
      }

      const requeued: NotificationEnvelope = {
        ...env,
        retries: (env.retries ?? 0) + 1,
        enqueuedAt: new Date().toISOString(),
      };
      try {
        await redisService.rpush(main, JSON.stringify(requeued));
      } catch (error) {
        logger.error(__filename, 'reap', `failed to requeue ${env.id}`, error);
      }
    }
  },
};
