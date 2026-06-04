import logger from '@services/logger.service';
import { DomainEvent } from './event.types';

/**
 * In-process typed publish/subscribe seam (SPEC-WEBHOOK-001 §6.1).
 *
 * Producers (domains) call `publish` and do NOT await it — delivery to
 * subscribers is scheduled on the microtask queue and never throws back into
 * the caller's critical path. v1 has a single subscriber (the webhook
 * dispatcher); email may subscribe in a later phase (its rule stays
 * unconditional and ignores webhook subscriptions).
 */
type EventHandler = (event: DomainEvent) => void | Promise<void>;

const handlers: EventHandler[] = [];

const eventBus = {
  subscribe(handler: EventHandler): void {
    handlers.push(handler);
  },

  /** Fire-and-forget. Subscriber errors are logged, never propagated. */
  publish(event: DomainEvent): void {
    for (const handler of handlers) {
      Promise.resolve()
        .then(() => handler(event))
        .catch((error) => logger.error(__filename, 'publish', `handler failed for ${event.type}`, error as Error));
    }
  },

  /** Test-only: drop all subscribers. */
  reset(): void {
    handlers.length = 0;
  },
};

export default eventBus;
