import statsDomainFactory from '@domain/stats/stats.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import statsDbRepository from '@infrastructure/repositories/statsDb/statsDb.repository';
import statsResponses from '@routes/admin/stats/stats.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const statsDomain = statsDomainFactory({
  statsRepository: statsDbRepository,
});

export const statsController = {
  overview: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const overview = await statsDomain.getOverview();
      response = responsesService.createResponseData(statsResponses.overviewOk, overview);
    } catch (error) {
      logger.error(__filename, 'overview', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
