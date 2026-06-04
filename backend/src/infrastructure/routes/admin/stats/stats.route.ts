import type { ServerRoute } from '@hapi/hapi';
import { statsController } from './stats.controller';
import statsDocs from './stats.doc';

export const adminStatsOverviewRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/stats/overview',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Dashboard analytics overview (admin only)',
    handler: statsController.overview,
    plugins: { 'hapi-swagger': { responses: statsDocs.overview.responses } },
    validate: statsDocs.overview.parameters,
    tags: ['api', 'admin'],
  },
};
