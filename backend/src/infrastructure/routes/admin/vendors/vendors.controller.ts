import { ICreateVendor, IUpdateVendor } from '@domain/_interfaces/vendor.interface';
import vendorDomainFactory from '@domain/vendors/vendors.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import vendorDbRepository from '@infrastructure/repositories/vendorDb/vendorDb.repository';
import vendorsResponses from '@routes/admin/vendors/vendors.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const vendorDomain = vendorDomainFactory({
  vendorRepository: vendorDbRepository,
});

export const vendorsController = {
  listVendors: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { search, page } = request.query as { search?: string; page?: number };
      const result = await vendorDomain.listVendors({ search, page });
      response = responsesService.createResponseData(vendorsResponses.listOk, result);
    } catch (error) {
      logger.error(__filename, 'listVendors', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  getVendorDetails: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const vendor = await vendorDomain.getVendorDetails(id);
      response = responsesService.createResponseData(vendorsResponses.getOk, { vendor });
    } catch (error) {
      logger.error(__filename, 'getVendorDetails', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  createVendor: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as ICreateVendor;
      const created = await vendorDomain.createVendor(payload);
      const vendor = await vendorDomain.getVendorDetails(created.id);
      response = responsesService.createResponseData(vendorsResponses.createOk, { vendor });
    } catch (error) {
      logger.error(__filename, 'createVendor', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  updateVendor: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const payload = request.payload as IUpdateVendor;
      const vendor = await vendorDomain.updateVendor(id, payload);
      response = responsesService.createResponseData(vendorsResponses.updateOk, { vendor });
    } catch (error) {
      logger.error(__filename, 'updateVendor', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  deleteVendor: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await vendorDomain.deleteVendor(id);
      response = responsesService.createResponseData(vendorsResponses.deleteOk);
    } catch (error) {
      logger.error(__filename, 'deleteVendor', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
