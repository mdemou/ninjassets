import type { ServerRoute } from '@hapi/hapi';
import { healthController } from './health.controller';
import healthDocs from './health.doc';

export const healthLivenessRoute: ServerRoute = {
  method: 'GET',
  path: '/api/__health/liveness',
  options: {
    description: 'Liveness check',
    handler: healthController.liveness,
    plugins: {
      'hapi-swagger': {
        responses: healthDocs.liveness.responses,
      },
    },
    tags: ['api', 'health'],
  },
};

export const healthReadinessRoute: ServerRoute = {
  method: 'GET',
  path: '/api/__health/readiness',
  options: {
    description: 'Readiness check',
    handler: healthController.readiness,
    plugins: {
      'hapi-swagger': {
        responses: healthDocs.readiness.responses,
      },
    },
    tags: ['api', 'health'],
  },
};
