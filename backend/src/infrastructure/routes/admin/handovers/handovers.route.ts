import type { ServerRoute } from '@hapi/hapi';
import { handoversController } from './handovers.controller';
import handoversDocs from './handovers.doc';

export const adminListOpenHandoversRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/handovers',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'List all currently open handovers across all assets (admin only)',
    handler: handoversController.listOpenHandovers,
    plugins: { 'hapi-swagger': { responses: handoversDocs.listOpen.responses } },
    validate: handoversDocs.listOpen.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCreateHandoverRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/assets/{assetId}/handovers',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Start a verified handover for an asset and email the target user (admin only)',
    handler: handoversController.createHandover,
    plugins: { 'hapi-swagger': { responses: handoversDocs.create.responses } },
    validate: handoversDocs.create.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminListHandoversRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/assets/{assetId}/handovers',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'List recent handovers for an asset (admin only)',
    handler: handoversController.listHandovers,
    plugins: { 'hapi-swagger': { responses: handoversDocs.list.responses } },
    validate: handoversDocs.list.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetHandoverRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/handovers/{handoverId}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Get a handover by id (admin only)',
    handler: handoversController.getHandover,
    plugins: { 'hapi-swagger': { responses: handoversDocs.get.responses } },
    validate: handoversDocs.get.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCancelHandoverRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/handovers/{handoverId}/cancel',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Cancel an open handover (admin only)',
    handler: handoversController.cancelHandover,
    plugins: { 'hapi-swagger': { responses: handoversDocs.cancel.responses } },
    validate: handoversDocs.cancel.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCompleteHandoverRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/handovers/{handoverId}/complete',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Complete a handover on behalf of the target user (admin only)',
    handler: handoversController.completeHandover,
    plugins: { 'hapi-swagger': { responses: handoversDocs.complete.responses } },
    validate: handoversDocs.complete.parameters,
    tags: ['api', 'admin'],
  },
};
