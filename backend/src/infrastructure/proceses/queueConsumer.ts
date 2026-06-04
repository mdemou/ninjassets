import config from '@config/config';
import { NotificationEnvelope } from '@services/notifications/notification.types';
import { dispatchNotification } from '@infrastructure/notifications/notificationDispatcher';
import { delay } from '@services/delay.service';
import logger from '@services/logger.service';
import redisService from '@services/redis.service';

/**
 * Reliable notification consumer (SPEC-WEBHOOK-001 §7, at-least-once):
 *   BRPOPLPUSH main → processing  (atomic claim)
 *   dedup check → dispatch → record dedup (after send) → LREM ack
 * A crash/throw before ack leaves the job in `processing`; the reaper requeues
 * it. Dedup (recorded after a successful send) prevents re-delivery on the
 * crash-after-send path. NOTE: with MOCK_EMAIL the send always "succeeds", so
 * the retry/reaper paths are only exercisable with a real (failing) SMTP.
 */
let isRunning = true;

const queueConsumer = {
  consumeList: async () => {
    const main = config.db.redis.queues.notifications;
    const processing = config.db.redis.queues.notificationsProcessing;

    while (isRunning) {
      try {
        const raw = await redisService.brpoplpush(main, processing, config.notifications.blockSeconds);
        if (!raw) continue; // timeout — re-check isRunning

        let env: NotificationEnvelope;
        try {
          env = JSON.parse(raw) as NotificationEnvelope;
        } catch (error) {
          logger.error(__filename, 'consumeList', 'invalid job payload (dropping)', error);
          await redisService.lrem(processing, 1, raw);
          continue;
        }

        const dedupKey = `${config.notifications.dedupKeyPrefix}${env.id}`;
        if (await redisService.get(dedupKey)) {
          // Already delivered by a prior attempt — ack and skip.
          await redisService.lrem(processing, 1, raw);
          continue;
        }

        try {
          await dispatchNotification(env);
          // Record success BEFORE ack so a crash-before-ack does not re-deliver.
          await redisService.setNx(dedupKey, '1', config.notifications.dedupTtlSec);
          await redisService.lrem(processing, 1, raw);
        } catch (error) {
          // Leave the entry in `processing`; the reaper requeues it after the
          // visibility timeout. Do not LREM here.
          logger.error(__filename, 'consumeList', `failed to process job ${env.id} (${env.kind})`, error);
        }
      } catch (error) {
        // Connection-level failure: back off, re-probe, loop.
        logger.error(__filename, 'consumeList', 'Error consuming from queue', error);
        await delay(5000);
        await redisService.isReady().catch(() => undefined);
      }
    }
  },
  stopConsumer: () => {
    isRunning = false;
  },
};

export default queueConsumer;
