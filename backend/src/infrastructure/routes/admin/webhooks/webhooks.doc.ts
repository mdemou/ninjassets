import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import { WEBHOOK_PLATFORMS } from '@domain/_interfaces/webhook.interface';
import Joi from 'joi';
import webhooksResponses from './webhooks.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const idParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid destination id is required')),
});

const targetSchema = Joi.object({
  url: Joi.string().uri().optional(),
  botToken: Joi.string().optional(),
  chatId: Joi.string().optional(),
});

const destinationSchema = Joi.object({
  id: Joi.string().uuid(),
  name: Joi.string(),
  platform: Joi.string().valid(...WEBHOOK_PLATFORMS),
  platformIconUrl: Joi.string(),
  enabled: Joi.boolean(),
  targetHint: Joi.string(),
  subscribedEvents: Joi.array().items(Joi.string()),
  createdAt: Joi.string(),
  updatedAt: Joi.string(),
}).label('WebhookDestination');

const platformParams = Joi.object({
  platform: Joi.string()
    .valid(...WEBHOOK_PLATFORMS)
    .required()
    .error(new Error('platform must be slack, discord, or telegram')),
});

const catalogEntrySchema = Joi.object({
  type: Joi.string(),
  category: Joi.string(),
  labelEn: Joi.string(),
  labelEs: Joi.string(),
  defaultSubscribed: Joi.boolean(),
}).label('WebhookEvent');

const createPayload = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  platform: Joi.string().valid(...WEBHOOK_PLATFORMS).required(),
  enabled: Joi.boolean().optional(),
  target: targetSchema.required(),
  subscribedEvents: Joi.array().items(Joi.string()).required(),
});

const updatePayload = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  enabled: Joi.boolean().optional(),
  target: targetSchema.optional(),
  subscribedEvents: Joi.array().items(Joi.string()).optional(),
}).min(1);

const webhooksDocs = {
  catalog: {
    responses: createResponseDoc('listWebhookEvents', webhooksResponses.catalogOk, {
      dataSchema: Joi.object({ events: Joi.array().items(catalogEntrySchema) }),
      401: true,
      500: { statusCode: 500, code: 'WHK5001', message: 'Failed to list events' },
    }),
    parameters: {
      headers: authHeaders,
      failAction: createValidationFailAction(webhooksResponses.badRequest),
    },
  },
  list: {
    responses: createResponseDoc('listWebhookDestinations', webhooksResponses.listOk, {
      dataSchema: Joi.object({ destinations: Joi.array().items(destinationSchema), total: Joi.number() }),
      401: true,
      500: { statusCode: 500, code: 'WHK5001', message: 'Failed to list destinations' },
    }),
    parameters: {
      headers: authHeaders,
      failAction: createValidationFailAction(webhooksResponses.badRequest),
    },
  },
  get: {
    responses: createResponseDoc('getWebhookDestination', webhooksResponses.getOk, {
      dataSchema: Joi.object({ destination: destinationSchema }),
      401: true,
      404: { statusCode: 404, code: 'WHK4040', message: 'Webhook destination not found' },
      500: { statusCode: 500, code: 'WHK5001', message: 'Failed to get destination' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(webhooksResponses.badRequest),
    },
  },
  create: {
    responses: createResponseDoc('createWebhookDestination', webhooksResponses.createOk, {
      dataSchema: Joi.object({ destination: destinationSchema }),
      400: webhooksResponses.badRequest(400, 'Invalid webhook destination request'),
      401: true,
      403: webhooksResponses.badRequest(403, 'Insufficient permissions'),
      500: { statusCode: 500, code: 'WHK5001', message: 'Failed to create destination' },
    }),
    parameters: {
      headers: authHeaders,
      payload: createPayload,
      failAction: createValidationFailAction(webhooksResponses.badRequest),
    },
  },
  update: {
    responses: createResponseDoc('updateWebhookDestination', webhooksResponses.updateOk, {
      dataSchema: Joi.object({ destination: destinationSchema }),
      400: webhooksResponses.badRequest(400, 'Invalid webhook destination request'),
      401: true,
      404: { statusCode: 404, code: 'WHK4040', message: 'Webhook destination not found' },
      500: { statusCode: 500, code: 'WHK5001', message: 'Failed to update destination' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      payload: updatePayload,
      failAction: createValidationFailAction(webhooksResponses.badRequest),
    },
  },
  remove: {
    responses: createResponseDoc('deleteWebhookDestination', webhooksResponses.deleteOk, {
      401: true,
      404: { statusCode: 404, code: 'WHK4040', message: 'Webhook destination not found' },
      500: { statusCode: 500, code: 'WHK5001', message: 'Failed to delete destination' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(webhooksResponses.badRequest),
    },
  },
  test: {
    responses: createResponseDoc('testWebhookDestination', webhooksResponses.testOk, {
      400: webhooksResponses.badRequest(400, 'Test delivery failed'),
      401: true,
      404: { statusCode: 404, code: 'WHK4040', message: 'Webhook destination not found' },
      500: { statusCode: 500, code: 'WHK5001', message: 'Failed to send test' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(webhooksResponses.badRequest),
    },
  },
  platformIcon: {
    responses: createResponseDoc('getWebhookPlatformIcon', webhooksResponses.platformIconOk, {
      401: true,
      404: { statusCode: 404, code: 'WHK4040', message: 'Platform icon not found' },
      500: { statusCode: 500, code: 'WHK5001', message: 'Failed to get platform icon' },
    }),
    parameters: {
      headers: authHeaders,
      params: platformParams,
      failAction: createValidationFailAction(webhooksResponses.badRequest),
    },
  },
};

export default webhooksDocs;
