import {
  IHandoverWithDetails,
  IListPendingHandoversResult,
} from '@domain/_interfaces/handover.interface';
import assetDomainFactory, { type AssetDomain } from '@domain/assets/assets.domain';
import handoverDomainFactory, { type HandoverDomain } from '@domain/handovers/handovers.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import assetDbRepository from '@infrastructure/repositories/assetDb/assetDb.repository';
import handoverDbRepository from '@infrastructure/repositories/handoverDb/handoverDb.repository';
import manufacturerDbRepository from '@infrastructure/repositories/manufacturerDb/manufacturerDb.repository';
import siteDbRepository from '@infrastructure/repositories/siteDb/siteDb.repository';
import transactionDbRepository from '@infrastructure/repositories/transactionDb/transactionDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import vendorDbRepository from '@infrastructure/repositories/vendorDb/vendorDb.repository';
import categoryDbRepository from '@infrastructure/repositories/categoryDb/categoryDb.repository';
import { toAssetApi } from '@routes/admin/assets/assetApi.mapper';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';
import { toListPendingHandoversApi } from '@routes/me/meApi.mapper';
import meHandoversResponses from './meHandovers.responses';

const assetDomain: AssetDomain = assetDomainFactory({
  assetRepository: assetDbRepository,
  userRepository: userDbRepository,
  siteRepository: siteDbRepository,
  transactionRepository: transactionDbRepository,
  manufacturerRepository: manufacturerDbRepository,
  vendorRepository: vendorDbRepository,
  categoryRepository: categoryDbRepository,
});

const handoverDomain: HandoverDomain = handoverDomainFactory({
  handoverRepository: handoverDbRepository,
  assetRepository: assetDbRepository,
  userRepository: userDbRepository,
  transactionRepository: transactionDbRepository,
  assetDomain,
});

function getRequester(request: Request): { id: string; role: string } {
  const credentials = request.auth.credentials as { id: string; role: string };
  return { id: credentials.id, role: credentials.role ?? 'USER' };
}

/** Trim a full handover record to the non-sensitive preview shape (no token, no IDs leak). */
function toPreview(handover: IHandoverWithDetails) {
  return {
    handoverId: handover.id,
    type: handover.type,
    expiresAt: handover.expiresAt,
    asset: {
      id: handover.assetId,
      name: handover.assetName,
      serialNumber: handover.assetSerialNumber,
    },
    targetUser: {
      id: handover.targetUserId,
      displayName: handover.targetUserName,
    },
  };
}

export const meHandoversController = {
  list: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const result: IListPendingHandoversResult = await handoverDomain.listPendingForUser(
        getRequester(request),
      );
      response = responsesService.createResponseData(
        meHandoversResponses.listOk,
        toListPendingHandoversApi(result.handovers),
      );
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  preview: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { token } = request.query as { token: string };
      const handover = await handoverDomain.preview(getRequester(request), token);
      response = responsesService.createResponseData(
        meHandoversResponses.previewOk,
        toPreview(handover),
      );
    } catch (error) {
      logger.error(__filename, 'preview', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  accept: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { token } = request.payload as { token: string };
      const asset = await handoverDomain.accept(getRequester(request), token);
      response = responsesService.createResponseData(meHandoversResponses.acceptOk, {
        asset: toAssetApi(asset),
      });
    } catch (error) {
      logger.error(__filename, 'accept', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  acceptById: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { handoverId } = request.params as { handoverId: string };
      const asset = await handoverDomain.acceptById(getRequester(request), handoverId);
      response = responsesService.createResponseData(meHandoversResponses.acceptOk, {
        asset: toAssetApi(asset),
      });
    } catch (error) {
      logger.error(__filename, 'acceptById', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
