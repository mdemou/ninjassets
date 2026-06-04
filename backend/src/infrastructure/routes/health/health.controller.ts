import healthDomainFactory from '@domain/health/health.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import healthRepository from '@infrastructure/repositories/health/health.repository';
import healthResponses from '@routes/health/health.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const healthDomain = healthDomainFactory({
  healthRepository: healthRepository,
});

export const healthController = {
  liveness: (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      response = responsesService.createResponseData(healthResponses.livenessOk);
    } catch (error) {
      logger.error(__filename, 'liveness', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  readiness: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      await healthDomain.readiness();
      response = responsesService.createResponseData(healthResponses.readinessOk);
    } catch (error) {
      logger.error(__filename, 'readiness', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
