import { ICreateSite, IUpdateSite } from '@domain/_interfaces/site.interface';
import assetDomainFactory from '@domain/assets/assets.domain';
import siteDomainFactory from '@domain/sites/sites.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import assetDbRepository from '@infrastructure/repositories/assetDb/assetDb.repository';
import manufacturerDbRepository from '@infrastructure/repositories/manufacturerDb/manufacturerDb.repository';
import siteDbRepository from '@infrastructure/repositories/siteDb/siteDb.repository';
import vendorDbRepository from '@infrastructure/repositories/vendorDb/vendorDb.repository';
import categoryDbRepository from '@infrastructure/repositories/categoryDb/categoryDb.repository';
import transactionDbRepository from '@infrastructure/repositories/transactionDb/transactionDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import assetsResponses from '@routes/admin/assets/assets.responses';
import sitesResponses from '@routes/admin/sites/sites.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const siteDomain = siteDomainFactory({
  siteRepository: siteDbRepository,
});

const assetDomain = assetDomainFactory({
  assetRepository: assetDbRepository,
  userRepository: userDbRepository,
  siteRepository: siteDbRepository,
  transactionRepository: transactionDbRepository,
  manufacturerRepository: manufacturerDbRepository,
  vendorRepository: vendorDbRepository,
  categoryRepository: categoryDbRepository,
});

export const sitesController = {
  listSites: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { search, page } = request.query as { search?: string; page?: number };
      const result = await siteDomain.listSites({ search, page });
      response = responsesService.createResponseData(sitesResponses.listSitesOk, result);
    } catch (error) {
      logger.error(__filename, 'listSites', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  getSiteDetails: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const site = await siteDomain.getSiteDetails(id);
      response = responsesService.createResponseData(sitesResponses.getSiteOk, { site });
    } catch (error) {
      logger.error(__filename, 'getSiteDetails', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  createSite: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as ICreateSite;
      const site = await siteDomain.createSite(payload);
      response = responsesService.createResponseData(sitesResponses.createSiteOk, { site });
    } catch (error) {
      logger.error(__filename, 'createSite', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  updateSite: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const payload = request.payload as IUpdateSite;
      const site = await siteDomain.updateSite(id, payload);
      response = responsesService.createResponseData(sitesResponses.updateSiteOk, { site });
    } catch (error) {
      logger.error(__filename, 'updateSite', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  deleteSite: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const { deleteAssets } = request.query as { deleteAssets?: boolean };
      await siteDomain.deleteSite(id, deleteAssets === true);
      response = responsesService.createResponseData(sitesResponses.deleteSiteOk);
    } catch (error) {
      logger.error(__filename, 'deleteSite', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  listSiteAssets: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const { search, page } = request.query as { search?: string; page?: number };
      await siteDomain.getSiteDetails(id);
      const result = await assetDomain.listSiteAssets(id, { search, page });
      response = responsesService.createResponseData(assetsResponses.listAssetsOk, result);
    } catch (error) {
      logger.error(__filename, 'listSiteAssets', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
