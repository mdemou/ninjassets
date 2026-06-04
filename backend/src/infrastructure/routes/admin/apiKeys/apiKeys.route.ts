import type { ServerRoute } from '@hapi/hapi';
import { CapabilityEnum } from '@infrastructure/roles/capabilities';
import { apiKeysController } from './apiKeys.controller';
import apiKeysDocs from './apiKeys.doc';

// Management routes are JWTAdmin-only: a key can never mint or revoke keys (D-API-3).
const MANAGE_AUTH = { strategies: ['JWTAdmin'] };
const MANAGE_APP = { capability: CapabilityEnum.API_KEYS_MANAGE };

export const adminCreateApiKeyRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/api-keys',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'Create an API key (admin only); secret returned once',
    handler: apiKeysController.createKey,
    plugins: { 'hapi-swagger': { responses: apiKeysDocs.create.responses } },
    validate: apiKeysDocs.create.parameters,
    tags: ['api', 'admin', 'api-keys'],
  },
};

export const adminListApiKeysRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/api-keys',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'List all deployment API keys (admin only)',
    handler: apiKeysController.listKeys,
    plugins: { 'hapi-swagger': { responses: apiKeysDocs.list.responses } },
    validate: apiKeysDocs.list.parameters,
    tags: ['api', 'admin', 'api-keys'],
  },
};

export const adminGetApiKeyRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/api-keys/{id}',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'Get an API key by id (admin only)',
    handler: apiKeysController.getKey,
    plugins: { 'hapi-swagger': { responses: apiKeysDocs.get.responses } },
    validate: apiKeysDocs.get.parameters,
    tags: ['api', 'admin', 'api-keys'],
  },
};

export const adminRegenerateApiKeyRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/api-keys/{id}/regenerate',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'Regenerate an API key secret (admin only); new secret returned once',
    handler: apiKeysController.regenerateKey,
    plugins: { 'hapi-swagger': { responses: apiKeysDocs.regenerate.responses } },
    validate: apiKeysDocs.regenerate.parameters,
    tags: ['api', 'admin', 'api-keys'],
  },
};

export const adminRevokeApiKeyRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/api-keys/{id}',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'Revoke an API key (admin only)',
    handler: apiKeysController.revokeKey,
    plugins: { 'hapi-swagger': { responses: apiKeysDocs.revoke.responses } },
    validate: apiKeysDocs.revoke.parameters,
    tags: ['api', 'admin', 'api-keys'],
  },
};

export const adminListApiAccessLogsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/api-access-logs',
  options: {
    auth: MANAGE_AUTH,
    app: MANAGE_APP,
    description: 'List API access log entries (admin only)',
    handler: apiKeysController.listAccessLogs,
    plugins: { 'hapi-swagger': { responses: apiKeysDocs.accessLogs.responses } },
    validate: apiKeysDocs.accessLogs.parameters,
    tags: ['api', 'admin', 'api-keys'],
  },
};
