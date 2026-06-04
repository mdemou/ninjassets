import { EventType } from './eventCatalog';

/** Who caused the event (the acting user), if known. */
export interface EventActor {
  id: string | null;
  name: string | null;
}

/** What the event is about. `name` is always a display string (never null). */
export interface EventSubject {
  kind: 'asset' | 'user' | 'handover' | 'alert' | 'import' | 'export';
  id: string | null;
  name: string;
}

/**
 * A normalized, platform-agnostic domain event (SPEC-WEBHOOK-001 §10).
 *
 * Payloads are delivered to external chat services — they carry display names
 * and a deep link, never emails, tokens, or secrets.
 */
export interface DomainEvent {
  type: EventType;
  occurredAt: string; // ISO
  actor: EventActor | null;
  subject: EventSubject;
  /** Secondary party, e.g. the assignee on an assignment. */
  target?: { id: string | null; name: string | null } | null;
  /** Short human detail mirroring the audit `detail`. */
  detail?: string | null;
  /** Deep link back into the app (FRONTEND_URL + path). */
  link?: string | null;
}
