import config from '@config/config';
import {
  IUpdateWebhookDestination,
  IWebhookDestination,
  IWebhookDestinationView,
  IWebhookPlatform,
  IWebhookTarget,
  WEBHOOK_PLATFORMS,
  platformIconApiPath,
} from '@domain/_interfaces/webhook.interface';
import { WebhookDestinationRepository } from '@domain/_repositories/webhookDestination.repository';
import Boom from '@hapi/boom';
import { DomainEvent } from '@services/events/event.types';
import { EVENT_CATALOG, EVENT_TYPES, EventType, isEventType } from '@services/events/eventCatalog';
import logger from '@services/logger.service';
import { buildSampleEvent } from '@services/webhooks/sampleEvent';
import { sendEvent, WebhookTargetError } from '@services/webhooks/webhookSender';
import webhookErrors from './webhooks.errors';

interface WebhookRepositories {
  webhookDestinationRepository: WebhookDestinationRepository;
}

interface CreateInput {
  name: string;
  platform: string;
  enabled?: boolean;
  target: IWebhookTarget;
  subscribedEvents: string[];
}

interface UpdateInput {
  name?: string;
  enabled?: boolean;
  target?: IWebhookTarget;
  subscribedEvents?: string[];
}

function badRequest(error: { message: string; code: string }): never {
  throw Boom.badRequest(error.message, { code: error.code });
}

/** Mask the secret target for outbound reads (§12). */
function targetHint(platform: IWebhookPlatform, target: IWebhookTarget): string {
  if (platform === 'telegram') {
    const token = target.botToken ?? '';
    const botId = token.split(':')[0] || '?';
    const last4 = token.slice(-4);
    return `bot ${botId}…${last4} → chat ${target.chatId ?? '?'}`;
  }
  try {
    return new URL(target.url ?? '').host;
  } catch {
    return '(invalid url)';
  }
}

export function toView(destination: IWebhookDestination): IWebhookDestinationView {
  return {
    id: destination.id,
    name: destination.name,
    platform: destination.platform,
    platformIconUrl: platformIconApiPath(destination.platform),
    enabled: destination.enabled,
    targetHint: targetHint(destination.platform, destination.target),
    subscribedEvents: destination.subscribedEvents,
    createdAt: destination.createdAt,
    updatedAt: destination.updatedAt,
  };
}

function assertPlatform(platform: string): asserts platform is IWebhookPlatform {
  if (!WEBHOOK_PLATFORMS.includes(platform as IWebhookPlatform)) {
    badRequest(webhookErrors.invalidPlatform);
  }
}

/** Reject targets that cannot be delivered (missing url / token / chat id). */
function validateTarget(platform: IWebhookPlatform, target: IWebhookTarget): IWebhookTarget {
  if (platform === 'telegram') {
    if (!target.botToken?.trim() || !target.chatId?.trim()) badRequest(webhookErrors.invalidTarget);
    return { botToken: target.botToken.trim(), chatId: target.chatId.trim() };
  }
  if (!target.url?.trim()) badRequest(webhookErrors.invalidTarget);
  return { url: target.url.trim() };
}

function validateEvents(events: string[]): string[] {
  if (!Array.isArray(events) || events.some((e) => !isEventType(e))) {
    badRequest(webhookErrors.invalidEvents);
  }
  // De-dupe while preserving the caller's order.
  return [...new Set(events)];
}

function webhooksDomainFactory(repositories: WebhookRepositories) {
  const { webhookDestinationRepository } = repositories;

  async function getOrThrow(id: string): Promise<IWebhookDestination> {
    const found = await webhookDestinationRepository.findById(id);
    if (!found) {
      throw Boom.notFound(webhookErrors.destinationNotFound.message, {
        code: webhookErrors.destinationNotFound.code,
      });
    }
    return found;
  }

  return {
    /** The event catalog for the UI picker (§13). */
    listCatalog(): {
      type: EventType;
      category: string;
      labelEn: string;
      labelEs: string;
      defaultSubscribed: boolean;
    }[] {
      return EVENT_TYPES.map((type) => ({
        type,
        category: EVENT_CATALOG[type].category,
        labelEn: EVENT_CATALOG[type].labels.en,
        labelEs: EVENT_CATALOG[type].labels.es,
        defaultSubscribed: EVENT_CATALOG[type].defaultSubscribed,
      }));
    },

    async list(): Promise<IWebhookDestinationView[]> {
      const rows = await webhookDestinationRepository.listAll();
      return rows.map(toView);
    },

    async getDetail(id: string): Promise<IWebhookDestinationView> {
      return toView(await getOrThrow(id));
    },

    async create(actorUserId: string, input: CreateInput): Promise<IWebhookDestinationView> {
      const name = (input.name ?? '').trim();
      if (!name) badRequest(webhookErrors.invalidName);
      assertPlatform(input.platform);
      const target = validateTarget(input.platform, input.target ?? {});
      const subscribedEvents = validateEvents(input.subscribedEvents ?? []);

      const created = await webhookDestinationRepository.create({
        name,
        platform: input.platform,
        enabled: input.enabled ?? true,
        target,
        subscribedEvents,
        createdBy: actorUserId,
      });
      return toView(created);
    },

    async update(id: string, input: UpdateInput): Promise<IWebhookDestinationView> {
      const existing = await getOrThrow(id);

      const patch: IUpdateWebhookDestination = {};
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) badRequest(webhookErrors.invalidName);
        patch.name = name;
      }
      if (input.enabled !== undefined) patch.enabled = input.enabled;
      if (input.target !== undefined) patch.target = validateTarget(existing.platform, input.target);
      if (input.subscribedEvents !== undefined) {
        patch.subscribedEvents = validateEvents(input.subscribedEvents);
      }

      const updated = await webhookDestinationRepository.update(id, patch);
      if (!updated) {
        throw Boom.notFound(webhookErrors.destinationNotFound.message, {
          code: webhookErrors.destinationNotFound.code,
        });
      }
      return toView(updated);
    },

    async remove(id: string): Promise<void> {
      await getOrThrow(id);
      await webhookDestinationRepository.delete(id);
    },

    /**
     * Deliver an event to every enabled destination subscribed to its type
     * (SPEC-WEBHOOK-001 §7). Invoked by the queue consumer for each popped job.
     * Per-destination failures are logged, never thrown (at-most-once).
     */
    async deliverEvent(event: DomainEvent): Promise<void> {
      if (!config.webhooks.enabled) return;
      const destinations = await webhookDestinationRepository.listEnabled();
      for (const destination of destinations) {
        if (!destination.subscribedEvents.includes(event.type)) continue;
        void sendEvent(destination, event).catch((error) =>
          logger.warn(
            __filename,
            'deliverEvent',
            `delivery failed for destination ${destination.id} (${destination.platform})`,
            error as Error,
          ),
        );
      }
    },

    /** Send a sample message to verify connectivity (§13). */
    async sendTest(id: string): Promise<void> {
      const destination = await getOrThrow(id);
      try {
        await sendEvent(destination, buildSampleEvent());
      } catch (error) {
        const message = error instanceof WebhookTargetError ? error.message : webhookErrors.testFailed.message;
        throw Boom.badRequest(message, { code: webhookErrors.testFailed.code });
      }
    },
  };
}

export default webhooksDomainFactory;
