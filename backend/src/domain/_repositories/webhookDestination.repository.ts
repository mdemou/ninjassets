import {
  ICreateWebhookDestination,
  IUpdateWebhookDestination,
  IWebhookDestination,
} from '@domain/_interfaces/webhook.interface';

export interface WebhookDestinationRepository {
  create(data: ICreateWebhookDestination): Promise<IWebhookDestination>;
  /** All destinations, newest first. */
  listAll(): Promise<IWebhookDestination[]>;
  /** Only enabled destinations — the dispatcher hot path. */
  listEnabled(): Promise<IWebhookDestination[]>;
  findById(id: string): Promise<IWebhookDestination | null>;
  update(id: string, data: IUpdateWebhookDestination): Promise<IWebhookDestination | null>;
  /** Returns true if a row was removed. */
  delete(id: string): Promise<boolean>;
}
