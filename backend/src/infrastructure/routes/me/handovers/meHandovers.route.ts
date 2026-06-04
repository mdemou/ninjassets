import type { ServerRoute } from '@hapi/hapi';
import { meHandoversController } from './meHandovers.controller';
import meHandoversDocs from './meHandovers.doc';

export const myHandoversListRoute: ServerRoute = {
  method: 'GET',
  path: '/api/me/handovers',
  options: {
    auth: { strategies: ['JWTAdminAndUser'] },
    description: 'List open custody confirmations awaiting the current user',
    handler: meHandoversController.list,
    plugins: { 'hapi-swagger': { responses: meHandoversDocs.list.responses } },
    validate: meHandoversDocs.list.parameters,
    tags: ['api', 'me'],
  },
};

export const myHandoverPreviewRoute: ServerRoute = {
  method: 'GET',
  path: '/api/me/handovers/preview',
  options: {
    auth: { strategies: ['JWTAdminAndUser'] },
    description: 'Preview a handover by token (authenticated users)',
    handler: meHandoversController.preview,
    plugins: { 'hapi-swagger': { responses: meHandoversDocs.preview.responses } },
    validate: meHandoversDocs.preview.parameters,
    tags: ['api', 'me'],
  },
};

export const myHandoverAcceptRoute: ServerRoute = {
  method: 'POST',
  path: '/api/me/handovers/accept',
  options: {
    auth: { strategies: ['JWTAdminAndUser'] },
    description: 'Accept (consume) a handover the current user is the target of',
    handler: meHandoversController.accept,
    plugins: { 'hapi-swagger': { responses: meHandoversDocs.accept.responses } },
    validate: meHandoversDocs.accept.parameters,
    tags: ['api', 'me'],
  },
};

export const myHandoverAcceptByIdRoute: ServerRoute = {
  method: 'POST',
  path: '/api/me/handovers/{handoverId}/accept',
  options: {
    auth: { strategies: ['JWTAdminAndUser'] },
    description: 'Accept a pending handover by id (current user must be the recipient)',
    handler: meHandoversController.acceptById,
    plugins: { 'hapi-swagger': { responses: meHandoversDocs.acceptById.responses } },
    validate: meHandoversDocs.acceptById.parameters,
    tags: ['api', 'me'],
  },
};
