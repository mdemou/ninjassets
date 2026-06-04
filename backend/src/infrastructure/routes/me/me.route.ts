import type { ServerRoute } from '@hapi/hapi';
import { manufacturerImageController } from '@routes/admin/manufacturers/manufacturerImage.controller';
import manufacturerImageDocs from '@routes/admin/manufacturers/manufacturerImage.doc';
import { meController } from './me.controller';
import meDocs from './me.doc';

// Personal endpoints — always scoped to the authenticated caller, regardless of
// role. The dedicated counterpart to the admin-only /api/p/assets and /api/p/transactions.

export const myAssetsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/me/assets',
  options: {
    auth: { strategies: ['JWTAdminAndUser'] },
    description: 'List the assets assigned to the current user',
    handler: meController.listMyAssets,
    plugins: { 'hapi-swagger': { responses: meDocs.assets.responses } },
    validate: meDocs.assets.parameters,
    tags: ['api', 'me'],
  },
};

export const myGetManufacturerImageRoute: ServerRoute = {
  method: 'GET',
  path: '/api/me/manufacturers/{id}/image',
  options: {
    auth: { strategies: ['JWTAdminAndUser'] },
    description: 'Stream a manufacturer image (authenticated users)',
    handler: manufacturerImageController.getImage,
    plugins: { 'hapi-swagger': { responses: manufacturerImageDocs.get.responses } },
    validate: manufacturerImageDocs.get.parameters,
    tags: ['api', 'me'],
  },
};

export const myTransactionsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/me/transactions',
  options: {
    auth: { strategies: ['JWTAdminAndUser'] },
    description: 'List the current user’s own asset history',
    handler: meController.listMyTransactions,
    plugins: { 'hapi-swagger': { responses: meDocs.transactions.responses } },
    validate: meDocs.transactions.parameters,
    tags: ['api', 'me'],
  },
};
