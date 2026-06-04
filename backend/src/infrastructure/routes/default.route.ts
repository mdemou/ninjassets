import type { ServerRoute } from '@hapi/hapi';
import Boom from '@hapi/boom';

export const defaultRoute: ServerRoute = {
  method: '*',
  path: '/{any*}',
  handler: () => {
    throw Boom.notFound('Route not found');
  },
};
