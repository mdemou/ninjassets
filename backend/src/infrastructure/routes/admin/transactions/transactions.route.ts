import type { ServerRoute } from '@hapi/hapi';
import { transactionsController } from './transactions.controller';
import transactionsDocs from './transactions.doc';

export const adminListTransactionsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/transactions',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'List the full asset history (admin only)',
    handler: transactionsController.list,
    plugins: { 'hapi-swagger': { responses: transactionsDocs.list.responses } },
    validate: transactionsDocs.list.parameters,
    tags: ['api', 'admin'],
  },
};
