import assetDomainFactory from '@domain/assets/assets.domain';
import transactionDomainFactory from '@domain/transactions/transactions.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import assetDbRepository from '@infrastructure/repositories/assetDb/assetDb.repository';
import manufacturerDbRepository from '@infrastructure/repositories/manufacturerDb/manufacturerDb.repository';
import siteDbRepository from '@infrastructure/repositories/siteDb/siteDb.repository';
import transactionDbRepository from '@infrastructure/repositories/transactionDb/transactionDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import vendorDbRepository from '@infrastructure/repositories/vendorDb/vendorDb.repository';
import categoryDbRepository from '@infrastructure/repositories/categoryDb/categoryDb.repository';
import { toListMyAssetsApi, toListMyTransactionsApi } from '@routes/me/meApi.mapper';
import meResponses from '@routes/me/me.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const assetDomain = assetDomainFactory({
  assetRepository: assetDbRepository,
  userRepository: userDbRepository,
  siteRepository: siteDbRepository,
  transactionRepository: transactionDbRepository,
  manufacturerRepository: manufacturerDbRepository,
  vendorRepository: vendorDbRepository,
  categoryRepository: categoryDbRepository,
});

const transactionDomain = transactionDomainFactory({
  transactionRepository: transactionDbRepository,
});

function getUserId(request: Request): string {
  return (request.auth.credentials as { id: string }).id;
}

export const meController = {
  listMyAssets: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { search, page } = request.query as { search?: string; page?: number };
      const result = await assetDomain.listMyAssets(getUserId(request), { search, page });
      response = responsesService.createResponseData(meResponses.assetsOk, toListMyAssetsApi(result));
    } catch (error) {
      logger.error(__filename, 'listMyAssets', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  listMyTransactions: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { search, page } = request.query as { search?: string; page?: number };
      const result = await transactionDomain.listMyTransactions(getUserId(request), { search, page });
      response = responsesService.createResponseData(meResponses.transactionsOk, toListMyTransactionsApi(result));
    } catch (error) {
      logger.error(__filename, 'listMyTransactions', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
