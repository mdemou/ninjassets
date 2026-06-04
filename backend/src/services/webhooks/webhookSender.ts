import config from '@config/config';
import { DomainEvent } from '@services/events/event.types';
import { IWebhookDestination, IWebhookPlatform } from '@domain/_interfaces/webhook.interface';
import { formatDiscord, formatSlack, formatTelegramText } from './messageFormatter';

/**
 * Outbound delivery + SSRF guard (SPEC-WEBHOOK-001 §7, §12). Used by both the
 * dispatcher (real events) and the domain test-send. Throws on invalid target
 * or non-2xx response; callers decide how to surface the failure.
 */

export class WebhookTargetError extends Error {}

function assertUrlAllowed(rawUrl: string, allowedHosts: string[]): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new WebhookTargetError('Invalid webhook URL');
  }
  // E2E/dev may point at a local mock receiver; skip host/scheme restrictions.
  if (config.webhooks.allowInsecureTargets) return url;
  if (url.protocol !== 'https:') {
    throw new WebhookTargetError('Webhook URL must use https');
  }
  if (!allowedHosts.includes(url.hostname)) {
    throw new WebhookTargetError(`Host not allowed: ${url.hostname}`);
  }
  return url;
}

async function postJson(url: string, body: unknown): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.webhooks.httpTimeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new WebhookTargetError(`Destination responded ${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve the concrete URL + JSON body for a platform delivery. */
function buildRequest(
  platform: IWebhookPlatform,
  target: IWebhookDestination['target'],
  event: DomainEvent,
): { url: string; body: unknown } {
  switch (platform) {
    case 'slack': {
      const url = assertUrlAllowed(target.url ?? '', config.webhooks.allowedHosts.slack);
      return { url: url.toString(), body: formatSlack(event) };
    }
    case 'discord': {
      const url = assertUrlAllowed(target.url ?? '', config.webhooks.allowedHosts.discord);
      return { url: url.toString(), body: formatDiscord(event) };
    }
    case 'telegram': {
      if (!target.botToken || !target.chatId) {
        throw new WebhookTargetError('Telegram target needs botToken and chatId');
      }
      const url = `${config.webhooks.telegramApiBase}/bot${target.botToken}/sendMessage`;
      return {
        url,
        body: {
          chat_id: target.chatId,
          text: formatTelegramText(event),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        },
      };
    }
    default:
      throw new WebhookTargetError(`Unknown platform: ${platform as string}`);
  }
}

export async function sendEvent(destination: IWebhookDestination, event: DomainEvent): Promise<void> {
  const { url, body } = buildRequest(destination.platform, destination.target, event);
  await postJson(url, body);
}
