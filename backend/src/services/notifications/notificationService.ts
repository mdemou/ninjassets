import { randomUUID } from 'crypto';
import config, { notificationsConfig } from '@config/config';
import { DomainEvent } from '@services/events/event.types';
import redisService from '@services/redis.service';
import logger from '@services/logger.service';
import { NotificationType } from './notificationCatalog';
import { NotificationEnvelope } from './notification.types';

/**
 * Producer for the unified notification pipeline (SPEC-WEBHOOK-001 §7). Domains
 * call `email(...)`; the event bus calls `webhook(...)`. Both wrap the item in an
 * envelope and `rpush` it onto the Redis queue. Enqueue failures are logged and
 * swallowed — Redis being down must never break the operation that produced the
 * notification (mandatory emails included; the row/token is already committed).
 */
function nowIso(): string {
  return new Date().toISOString();
}

const notificationService = {
  async enqueue(envelope: NotificationEnvelope): Promise<void> {
    // Master pipeline switch: when off, nothing is enqueued (no silent backlog).
    if (!notificationsConfig.enabled) return;
    try {
      await redisService.rpush(config.db.redis.queues.notifications, JSON.stringify(envelope));
    } catch (error) {
      logger.warn(__filename, 'enqueue', `failed to enqueue ${envelope.kind}:${envelope.type}`, error);
    }
  },

  /** Webhook fan-out job (gated additionally by the webhooks kill-switch). */
  async webhook(event: DomainEvent): Promise<void> {
    if (!config.webhooks.enabled) return;
    await this.enqueue({
      id: randomUUID(),
      kind: 'webhook',
      type: event.type,
      enqueuedAt: nowIso(),
      retries: 0,
      payload: event,
    });
  },

  /** Email notification job (reference-based; secrets re-fetched in the consumer). */
  async email(notificationType: NotificationType, refs: Record<string, unknown>): Promise<void> {
    await this.enqueue({
      id: randomUUID(),
      kind: 'email',
      type: notificationType,
      enqueuedAt: nowIso(),
      retries: 0,
      payload: { notificationType, refs },
    });
  },
};

export default notificationService;
