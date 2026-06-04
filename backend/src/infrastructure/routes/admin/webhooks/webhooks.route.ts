import type { ServerRoute } from '@hapi/hapi';
import { CapabilityEnum } from '@infrastructure/roles/capabilities';
import { webhooksController } from './webhooks.controller';
import webhooksDocs from './webhooks.doc';

// Webhook configuration is JWTAdmin-only and never grantable to an API key.
const MANAGE_AUTH = { strategies: ['JWTAdmin'] };
const MANAGE_APP = { capability: CapabilityEnum.WEBHOOKS_MANAGE };

export const adminListWebhookEventsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/webhooks/events',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'List the domain event catalog (admin only)',
    handler: webhooksController.listEvents,
    plugins: { 'hapi-swagger': { responses: webhooksDocs.catalog.responses } },
    validate: webhooksDocs.catalog.parameters,
    tags: ['api', 'admin', 'webhooks'],
  },
};

export const adminListWebhookDestinationsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/webhooks/destinations',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'List webhook destinations (admin only); targets masked',
    handler: webhooksController.list,
    plugins: { 'hapi-swagger': { responses: webhooksDocs.list.responses } },
    validate: webhooksDocs.list.parameters,
    tags: ['api', 'admin', 'webhooks'],
  },
};

export const adminGetWebhookDestinationRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/webhooks/destinations/{id}',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'Get a webhook destination by id (admin only); target masked',
    handler: webhooksController.get,
    plugins: { 'hapi-swagger': { responses: webhooksDocs.get.responses } },
    validate: webhooksDocs.get.parameters,
    tags: ['api', 'admin', 'webhooks'],
  },
};

export const adminCreateWebhookDestinationRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/webhooks/destinations',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'Create a webhook destination (admin only)',
    handler: webhooksController.create,
    plugins: { 'hapi-swagger': { responses: webhooksDocs.create.responses } },
    validate: webhooksDocs.create.parameters,
    tags: ['api', 'admin', 'webhooks'],
  },
};

export const adminUpdateWebhookDestinationRoute: ServerRoute = {
  method: 'PATCH',
  path: '/api/p/webhooks/destinations/{id}',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'Update a webhook destination (admin only)',
    handler: webhooksController.update,
    plugins: { 'hapi-swagger': { responses: webhooksDocs.update.responses } },
    validate: webhooksDocs.update.parameters,
    tags: ['api', 'admin', 'webhooks'],
  },
};

export const adminDeleteWebhookDestinationRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/webhooks/destinations/{id}',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'Delete a webhook destination (admin only)',
    handler: webhooksController.remove,
    plugins: { 'hapi-swagger': { responses: webhooksDocs.remove.responses } },
    validate: webhooksDocs.remove.parameters,
    tags: ['api', 'admin', 'webhooks'],
  },
};

export const adminTestWebhookDestinationRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/webhooks/destinations/{id}/test',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'Send a test message to a webhook destination (admin only)',
    handler: webhooksController.test,
    plugins: { 'hapi-swagger': { responses: webhooksDocs.test.responses } },
    validate: webhooksDocs.test.parameters,
    tags: ['api', 'admin', 'webhooks'],
  },
};

export const adminGetWebhookPlatformIconRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/webhooks/platforms/{platform}/icon',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'Platform brand icon PNG (admin only)',
    handler: webhooksController.getPlatformIcon,
    plugins: { 'hapi-swagger': { responses: webhooksDocs.platformIcon.responses } },
    validate: webhooksDocs.platformIcon.parameters,
    tags: ['api', 'admin', 'webhooks'],
  },
};
