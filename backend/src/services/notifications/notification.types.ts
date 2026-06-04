import { DomainEvent } from '@services/events/event.types';
import { NotificationType } from './notificationCatalog';

/** Email job payload — references only (identifiers), never secrets (§7). */
export interface EmailJobPayload {
  notificationType: NotificationType;
  refs: Record<string, unknown>;
}

interface BaseEnvelope {
  id: string; // random uuid; dedup is keyed on this
  enqueuedAt: string; // ISO; reset to now on each reaper requeue
  retries: number;
}

export type NotificationEnvelope =
  | (BaseEnvelope & { kind: 'webhook'; type: string; payload: DomainEvent })
  | (BaseEnvelope & { kind: 'email'; type: NotificationType; payload: EmailJobPayload });
