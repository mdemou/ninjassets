export type IWebhookPlatform = 'slack' | 'discord' | 'telegram';

export const WEBHOOK_PLATFORMS: IWebhookPlatform[] = ['slack', 'discord', 'telegram'];

/** Authenticated admin route that serves `backend/assets/{platform}.png`. */
export function platformIconApiPath(platform: IWebhookPlatform): string {
  return `/api/p/webhooks/platforms/${platform}/icon`;
}

/**
 * Delivery coordinates. Slack/Discord use an incoming-webhook `url`; Telegram
 * uses `botToken` + `chatId`. Stored as jsonb; treated as a secret (§12).
 */
export interface IWebhookTarget {
  url?: string;
  botToken?: string;
  chatId?: string;
}

export interface IWebhookDestination {
  id: string;
  name: string;
  platform: IWebhookPlatform;
  enabled: boolean;
  target: IWebhookTarget;
  /** Catalog event types this destination wants (webhook-only filter). */
  subscribedEvents: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateWebhookDestination {
  name: string;
  platform: IWebhookPlatform;
  enabled: boolean;
  target: IWebhookTarget;
  subscribedEvents: string[];
  createdBy: string | null;
}

export interface IUpdateWebhookDestination {
  name?: string;
  enabled?: boolean;
  target?: IWebhookTarget;
  subscribedEvents?: string[];
}

/** Outbound view with the secret target masked (§12). */
export interface IWebhookDestinationView {
  id: string;
  name: string;
  platform: IWebhookPlatform;
  /** Relative API path for the platform brand icon (fetch with auth). */
  platformIconUrl: string;
  enabled: boolean;
  targetHint: string;
  subscribedEvents: string[];
  createdAt: string;
  updatedAt: string;
}
