import { IAssetStatus, ICreateAsset, IUpdateAsset } from '@domain/_interfaces/asset.interface';
import assetDomainFactory, { type AssetDomain } from '@domain/assets/assets.domain';
import transactionDomainFactory from '@domain/transactions/transactions.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import assetDbRepository from '@infrastructure/repositories/assetDb/assetDb.repository';
import handoverDbRepository from '@infrastructure/repositories/handoverDb/handoverDb.repository';
import manufacturerDbRepository from '@infrastructure/repositories/manufacturerDb/manufacturerDb.repository';
import siteDbRepository from '@infrastructure/repositories/siteDb/siteDb.repository';
import transactionDbRepository from '@infrastructure/repositories/transactionDb/transactionDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import vendorDbRepository from '@infrastructure/repositories/vendorDb/vendorDb.repository';
import categoryDbRepository from '@infrastructure/repositories/categoryDb/categoryDb.repository';
import { toAssetApi, toListAssetsApi } from '@routes/admin/assets/assetApi.mapper';
import assetsResponses from '@routes/admin/assets/assets.responses';
import transactionsResponses from '@routes/admin/transactions/transactions.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const assetDomain: AssetDomain = assetDomainFactory({
  assetRepository: assetDbRepository,
  userRepository: userDbRepository,
  siteRepository: siteDbRepository,
  transactionRepository: transactionDbRepository,
  manufacturerRepository: manufacturerDbRepository,
  vendorRepository: vendorDbRepository,
  categoryRepository: categoryDbRepository,
  // Admin direct PATCH is gated by the open-handover block policy (policy A).
  handoverRepository: handoverDbRepository,
});

const transactionDomain = transactionDomainFactory({
  transactionRepository: transactionDbRepository,
});

function getRequester(request: Request): { id: string; role: string } {
  const credentials = request.auth.credentials as { id: string; role: string };
  return { id: credentials.id, role: credentials.role };
}

export const assetsController = {
  listAssets: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { search, page, siteId, status, manufacturerId, vendorId, categoryId, eligibleParent, eligibleChild, excludeId } =
        request.query as {
          search?: string;
          page?: number;
          siteId?: string;
          status?: string;
          manufacturerId?: string;
          vendorId?: string;
          categoryId?: string;
          eligibleParent?: boolean;
          eligibleChild?: boolean;
          excludeId?: string;
        };
      const result = await assetDomain.listAssets({
        search,
        page,
        siteId,
        status: status as IAssetStatus | undefined,
        manufacturerId,
        vendorId,
        categoryId,
        eligibleParent: eligibleParent === true,
        eligibleChild: eligibleChild === true,
        excludeId,
      });
      response = responsesService.createResponseData(assetsResponses.listAssetsOk, toListAssetsApi(result));
    } catch (error) {
      logger.error(__filename, 'listAssets', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  listMapMarkers: async (_request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const markers = await assetDomain.listMapMarkers();
      response = responsesService.createResponseData(assetsResponses.listMapMarkersOk, { markers });
    } catch (error) {
      logger.error(__filename, 'listMapMarkers', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  getAssetDetails: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const asset = await assetDomain.getAssetDetails(id);
      response = responsesService.createResponseData(assetsResponses.getAssetOk, { asset: toAssetApi(asset) });
    } catch (error) {
      logger.error(__filename, 'getAssetDetails', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  createAsset: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as ICreateAsset;
      const asset = await assetDomain.createAsset(getRequester(request), payload);
      response = responsesService.createResponseData(assetsResponses.createAssetOk, { asset: toAssetApi(asset) });
    } catch (error) {
      logger.error(__filename, 'createAsset', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  updateAsset: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const payload = request.payload as IUpdateAsset;
      const asset = await assetDomain.updateAsset(getRequester(request), id, payload);
      response = responsesService.createResponseData(assetsResponses.updateAssetOk, { asset: toAssetApi(asset) });
    } catch (error) {
      logger.error(__filename, 'updateAsset', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  deleteAsset: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await assetDomain.deleteAsset(getRequester(request), id);
      response = responsesService.createResponseData(assetsResponses.deleteAssetOk);
    } catch (error) {
      logger.error(__filename, 'deleteAsset', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  listAssetTransactions: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const { search, page } = request.query as { search?: string; page?: number };
      await assetDomain.getAssetDetails(id);
      const result = await transactionDomain.listAssetTransactions(id, { search, page });
      response = responsesService.createResponseData(transactionsResponses.listOk, result);
    } catch (error) {
      logger.error(__filename, 'listAssetTransactions', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
