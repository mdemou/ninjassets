import { IHandoverType, IListHandoversResult } from '@domain/_interfaces/handover.interface';
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
import handoversResponses from './handovers.responses';

// The handover flow consumes the handover *before* applying the asset change, so the
// asset domain used here is wired WITHOUT the handover-block repository (the open row
// it would see is the one being completed).
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
  return { id: credentials.id, role: credentials.role };
}

export const handoversController = {
  listOpenHandovers: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const result: IListHandoversResult = await handoverDomain.listOpenHandovers();
      response = responsesService.createResponseData(handoversResponses.listOpenOk, result);
    } catch (error) {
      logger.error(__filename, 'listOpenHandovers', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  createHandover: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { assetId } = request.params as { assetId: string };
      const payload = request.payload as {
        type: IHandoverType;
        targetUserId: string;
        sendEmail?: boolean;
      };
      const result = await handoverDomain.createHandover(getRequester(request), assetId, payload);
      response = responsesService.createResponseData(handoversResponses.createOk, result);
    } catch (error) {
      logger.error(__filename, 'createHandover', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  listHandovers: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { assetId } = request.params as { assetId: string };
      const result = await handoverDomain.listForAsset(assetId);
      response = responsesService.createResponseData(handoversResponses.listOk, result);
    } catch (error) {
      logger.error(__filename, 'listHandovers', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  getHandover: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { handoverId } = request.params as { handoverId: string };
      const handover = await handoverDomain.getHandover(handoverId);
      response = responsesService.createResponseData(handoversResponses.getOk, { handover });
    } catch (error) {
      logger.error(__filename, 'getHandover', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  cancelHandover: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { handoverId } = request.params as { handoverId: string };
      const handover = await handoverDomain.cancelHandover(getRequester(request), handoverId);
      response = responsesService.createResponseData(handoversResponses.cancelOk, { handover });
    } catch (error) {
      logger.error(__filename, 'cancelHandover', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  completeHandover: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { handoverId } = request.params as { handoverId: string };
      const asset = await handoverDomain.completeOnBehalf(getRequester(request), handoverId);
      response = responsesService.createResponseData(handoversResponses.completeOk, {
        asset: toAssetApi(asset),
      });
    } catch (error) {
      logger.error(__filename, 'completeHandover', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
