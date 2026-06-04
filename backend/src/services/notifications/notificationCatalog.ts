/**
 * Inventory of email notification types (SPEC-WEBHOOK-001 §7). Mirrors the
 * typed `EVENT_CATALOG` for webhook events: each entry requires its metadata,
 * and `NotificationType = keyof typeof` makes the resolver registry
 * (infrastructure/notifications/notificationResolvers) exhaustive at compile time.
 *
 * `mandatory: true` notifications are always delivered — they are never gated by
 * webhook `subscribed_events` or the webhooks kill-switch (only by the pipeline).
 */
export type NotificationChannel = 'email';

export interface NotificationDef {
  channel: NotificationChannel;
  mandatory: boolean;
  describe: string;
}

export const NOTIFICATION_CATALOG = {
  'email.verification': {
    channel: 'email',
    mandatory: true,
    describe: 'Email verification link (registration / resend)',
  },
  'email.account_activation': {
    channel: 'email',
    mandatory: true,
    describe: 'Account activation link (admin-created user)',
  },
  'email.password_reset': {
    channel: 'email',
    mandatory: true,
    describe: 'Password reset link',
  },
  'email.asset_unassigned': {
    channel: 'email',
    mandatory: true,
    describe: 'Notice to the former assignee when an asset is unassigned',
  },
} satisfies Record<string, NotificationDef>;

export type NotificationType = keyof typeof NOTIFICATION_CATALOG;

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_CATALOG) as NotificationType[];

export function isNotificationType(value: string): value is NotificationType {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_CATALOG, value);
}
