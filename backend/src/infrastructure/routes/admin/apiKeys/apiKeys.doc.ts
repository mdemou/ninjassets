import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import apiKeysResponses from './apiKeys.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const idParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid API key id is required')),
});

const apiKeySchema = Joi.object({
  id: Joi.string().uuid(),
  name: Joi.string(),
  prefix: Joi.string(),
  capabilities: Joi.array().items(Joi.string()),
  ownerUserId: Joi.string().uuid().allow(null),
  ownerEmail: Joi.string().allow(null),
  ownerName: Joi.string().allow(null),
  ownerAvatarFilename: Joi.string().allow(null),
  expiresAt: Joi.string().allow(null),
  revokedAt: Joi.string().allow(null),
  lastUsedAt: Joi.string().allow(null),
  createdAt: Joi.string(),
}).label('ApiKey');

const apiKeySecretSchema = Joi.object({
  id: Joi.string().uuid(),
  name: Joi.string(),
  prefix: Joi.string(),
  secret: Joi.string(),
  capabilities: Joi.array().items(Joi.string()),
  expiresAt: Joi.string().allow(null),
}).label('ApiKeySecret');

const accessLogSchema = Joi.object({
  id: Joi.string().uuid(),
  apiKeyId: Joi.string().uuid().allow(null),
  userId: Joi.string().uuid().allow(null),
  method: Joi.string(),
  path: Joi.string(),
  statusCode: Joi.number(),
  durationMs: Joi.number().allow(null),
  ip: Joi.string().allow(null),
  createdAt: Joi.string(),
  keyName: Joi.string().allow(null),
  userEmail: Joi.string().allow(null),
}).label('ApiAccessLogEntry');

const apiKeysDocs = {
  create: {
    responses: createResponseDoc('createApiKey', apiKeysResponses.createOk, {
      dataSchema: Joi.object({ apiKey: apiKeySecretSchema }),
      400: apiKeysResponses.badRequest(400, 'Invalid API key request'),
      401: true,
      403: apiKeysResponses.badRequest(403, 'Insufficient permissions'),
      500: { statusCode: 500, code: 'API5001', message: 'Failed to create API key' },
    }),
    parameters: {
      headers: authHeaders,
      payload: Joi.object({
        name: Joi.string().trim().min(1).max(255).required(),
        expiresAt: Joi.string().isoDate().optional().allow(null),
        capabilities: Joi.array().items(Joi.string()).optional(),
      }),
      failAction: createValidationFailAction(apiKeysResponses.badRequest),
    },
  },
  list: {
    responses: createResponseDoc('listApiKeys', apiKeysResponses.listOk, {
      dataSchema: Joi.object({ apiKeys: Joi.array().items(apiKeySchema), total: Joi.number() }),
      401: true,
      403: apiKeysResponses.badRequest(403, 'Insufficient permissions'),
      500: { statusCode: 500, code: 'API5001', message: 'Failed to list API keys' },
    }),
    parameters: {
      headers: authHeaders,
      failAction: createValidationFailAction(apiKeysResponses.badRequest),
    },
  },
  get: {
    responses: createResponseDoc('getApiKey', apiKeysResponses.getOk, {
      dataSchema: Joi.object({ apiKey: apiKeySchema }),
      401: true,
      404: { statusCode: 404, code: 'API4040', message: 'API key not found' },
      500: { statusCode: 500, code: 'API5001', message: 'Failed to get API key' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(apiKeysResponses.badRequest),
    },
  },
  revoke: {
    responses: createResponseDoc('revokeApiKey', apiKeysResponses.revokeOk, {
      400: apiKeysResponses.badRequest(400, 'API key is already revoked'),
      401: true,
      404: { statusCode: 404, code: 'API4040', message: 'API key not found' },
      500: { statusCode: 500, code: 'API5001', message: 'Failed to revoke API key' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(apiKeysResponses.badRequest),
    },
  },
  regenerate: {
    responses: createResponseDoc('regenerateApiKey', apiKeysResponses.regenerateOk, {
      dataSchema: Joi.object({ apiKey: apiKeySecretSchema }),
      400: apiKeysResponses.badRequest(400, 'API key is already revoked'),
      401: true,
      404: { statusCode: 404, code: 'API4040', message: 'API key not found' },
      500: { statusCode: 500, code: 'API5001', message: 'Failed to regenerate API key' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(apiKeysResponses.badRequest),
    },
  },
  accessLogs: {
    responses: createResponseDoc('listApiAccessLogs', apiKeysResponses.accessLogOk, {
      dataSchema: Joi.object({ logs: Joi.array().items(accessLogSchema), total: Joi.number() }),
      401: true,
      500: { statusCode: 500, code: 'API5001', message: 'Failed to list access logs' },
    }),
    parameters: {
      headers: authHeaders,
      query: Joi.object({
        apiKeyId: Joi.string().uuid().optional(),
        page: Joi.number().integer().min(1).optional(),
      }),
      failAction: createValidationFailAction(apiKeysResponses.badRequest),
    },
  },
};

export default apiKeysDocs;
