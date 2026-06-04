import { IDataQualityIssue } from '@domain/_interfaces/dataQuality.interface';
import reportsDomainFactory from '@domain/reports/reports.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import {
  getCurrentSignature,
  listDataQualityRows,
} from '@infrastructure/repositories/reportsDb/dataQuality.queries';
import { dismiss, restore } from '@infrastructure/repositories/reportsDb/dismissals.repository';
import reportsResponses from '@routes/admin/reports/reports.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const reportsDomain = reportsDomainFactory({
  listDataQuality: listDataQualityRows,
  getCurrentSignature,
  dismiss,
  restore,
});

// JWT sessions carry the admin id; API-key auth has no user, so dismissals are attributed
// to null (they are global anyway).
function getUserId(request: Request): string | null {
  const credentials = request.auth.credentials as { id?: string };
  return credentials?.id ?? null;
}

export const reportsController = {
  dataQuality: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { search, page, issue } = request.query as {
        search?: string;
        page?: number;
        issue?: IDataQualityIssue;
      };
      const result = await reportsDomain.listDataQuality({ search, page, issue });
      response = responsesService.createResponseData(reportsResponses.listOk, result);
    } catch (error) {
      logger.error(__filename, 'dataQuality', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  dismiss: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { assetId, issue } = request.payload as { assetId: string; issue: IDataQualityIssue };
      await reportsDomain.dismissDataQuality({
        assetId,
        issue,
        dismissedByUserId: getUserId(request),
      });
      response = responsesService.createResponseData(reportsResponses.dismissOk, {});
    } catch (error) {
      logger.error(__filename, 'dismiss', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  restore: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { assetId, issue } = request.payload as { assetId: string; issue: IDataQualityIssue };
      await reportsDomain.restoreDataQuality({ assetId, issue });
      response = responsesService.createResponseData(reportsResponses.restoreOk, {});
    } catch (error) {
      logger.error(__filename, 'restore', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
