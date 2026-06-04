import type { ServerRoute } from '@hapi/hapi';
import { alertsController } from './alerts.controller';
import alertsDocs from './alerts.doc';

export const adminListAlertsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/alerts',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'List in-app admin alerts (admin only)',
    handler: alertsController.list,
    plugins: { 'hapi-swagger': { responses: alertsDocs.list.responses } },
    validate: alertsDocs.list.parameters,
    tags: ['api', 'admin'],
  },
};
