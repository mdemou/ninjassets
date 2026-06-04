import {
  ICreateWebhookDestination,
  IUpdateWebhookDestination,
  IWebhookDestination,
  IWebhookPlatform,
  IWebhookTarget,
} from '@domain/_interfaces/webhook.interface';
import { WebhookDestinationRepository } from '@domain/_repositories/webhookDestination.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import webhookDestinationDbErrors from './webhookDestinationDb.errors';

interface IWebhookDestinationDB {
  id: string;
  name: string;
  platform: string;
  enabled: boolean;
  target: IWebhookTarget;
  subscribed_events: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function adapt(row: IWebhookDestinationDB): IWebhookDestination {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform as IWebhookPlatform,
    enabled: row.enabled,
    target: row.target ?? {},
    subscribedEvents: row.subscribed_events ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function internal(): never {
  throw Boom.badImplementation(webhookDestinationDbErrors.internalError.message, {
    code: webhookDestinationDbErrors.internalError.code,
  });
}

const webhookDestinationDbRepository: WebhookDestinationRepository = {
  async create(data: ICreateWebhookDestination): Promise<IWebhookDestination> {
    try {
      const [row]: IWebhookDestinationDB[] = await sqlService
        .myDb('webhook_destination')
        .insert({
          name: data.name,
          platform: data.platform,
          enabled: data.enabled,
          target: JSON.stringify(data.target),
          subscribed_events: JSON.stringify(data.subscribedEvents),
          created_by: data.createdBy,
        })
        .returning('*');
      if (!row) return internal();
      return adapt(row);
    } catch (error) {
      logger.error(__filename, 'create', 'error', error);
      return internal();
    }
  },

  async listAll(): Promise<IWebhookDestination[]> {
    try {
      const rows: IWebhookDestinationDB[] = await sqlService
        .myDb('webhook_destination')
        .select('*')
        .orderBy('created_at', 'desc');
      return rows.map(adapt);
    } catch (error) {
      logger.error(__filename, 'listAll', 'error', error);
      return internal();
    }
  },

  async listEnabled(): Promise<IWebhookDestination[]> {
    try {
      const rows: IWebhookDestinationDB[] = await sqlService
        .myDb('webhook_destination')
        .where({ enabled: true })
        .select('*');
      return rows.map(adapt);
    } catch (error) {
      logger.error(__filename, 'listEnabled', 'error', error);
      return internal();
    }
  },

  async findById(id: string): Promise<IWebhookDestination | null> {
    try {
      const row: IWebhookDestinationDB | undefined = await sqlService
        .myDb('webhook_destination')
        .where({ id })
        .first();
      return row ? adapt(row) : null;
    } catch (error) {
      logger.error(__filename, 'findById', 'error', error);
      return internal();
    }
  },

  async update(id: string, data: IUpdateWebhookDestination): Promise<IWebhookDestination | null> {
    try {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (data.name !== undefined) patch.name = data.name;
      if (data.enabled !== undefined) patch.enabled = data.enabled;
      if (data.target !== undefined) patch.target = JSON.stringify(data.target);
      if (data.subscribedEvents !== undefined) {
        patch.subscribed_events = JSON.stringify(data.subscribedEvents);
      }
      const [row]: IWebhookDestinationDB[] = await sqlService
        .myDb('webhook_destination')
        .where({ id })
        .update(patch)
        .returning('*');
      return row ? adapt(row) : null;
    } catch (error) {
      logger.error(__filename, 'update', 'error', error);
      return internal();
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const count = await sqlService.myDb('webhook_destination').where({ id }).del();
      return count > 0;
    } catch (error) {
      logger.error(__filename, 'delete', 'error', error);
      return internal();
    }
  },
};

export default webhookDestinationDbRepository;
