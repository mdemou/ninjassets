import Boom from '@hapi/boom';
import sqlService from '@services/sql.service';
import healthErrors from '@domain/health/health.errors';

const healthRepository = {
  checkReadiness: async (): Promise<void> => {
    try {
      await sqlService.isReady();
    } catch {
      throw Boom.serverUnavailable(healthErrors.serverUnavailable.message, {
        code: healthErrors.serverUnavailable.code,
      });
    }
  },
};

export default healthRepository;
