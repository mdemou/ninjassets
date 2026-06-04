import { IDataQualityIssue } from '@domain/_interfaces/dataQuality.interface';
import alertsDomainFactory from '@domain/alerts/alerts.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import { listAlerts } from '@infrastructure/repositories/reportsDb/dataQuality.queries';
import alertsResponses from '@routes/admin/alerts/alerts.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const alertsDomain = alertsDomainFactory({
  listAlerts,
});

export const alertsController = {
  list: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { limit, issue, excludeDismissed } = request.query as {
        limit?: number;
        issue?: IDataQualityIssue;
        excludeDismissed?: boolean;
      };
      const result = await alertsDomain.listAlerts({ limit, issue, excludeDismissed });
      response = responsesService.createResponseData(alertsResponses.listOk, result);
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
