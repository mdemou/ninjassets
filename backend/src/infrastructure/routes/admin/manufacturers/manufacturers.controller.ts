import { ICreateManufacturer, IUpdateManufacturer } from '@domain/_interfaces/manufacturer.interface';
import manufacturerDomainFactory from '@domain/manufacturers/manufacturers.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import manufacturerDbRepository from '@infrastructure/repositories/manufacturerDb/manufacturerDb.repository';
import manufacturersResponses from '@routes/admin/manufacturers/manufacturers.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const manufacturerDomain = manufacturerDomainFactory({
  manufacturerRepository: manufacturerDbRepository,
});

export const manufacturersController = {
  listManufacturers: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { search, page } = request.query as { search?: string; page?: number };
      const result = await manufacturerDomain.listManufacturers({ search, page });
      response = responsesService.createResponseData(manufacturersResponses.listOk, result);
    } catch (error) {
      logger.error(__filename, 'listManufacturers', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  getManufacturerDetails: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const manufacturer = await manufacturerDomain.getManufacturerDetails(id);
      response = responsesService.createResponseData(manufacturersResponses.getOk, { manufacturer });
    } catch (error) {
      logger.error(__filename, 'getManufacturerDetails', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  createManufacturer: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as ICreateManufacturer;
      const created = await manufacturerDomain.createManufacturer(payload);
      const manufacturer = await manufacturerDomain.getManufacturerDetails(created.id);
      response = responsesService.createResponseData(manufacturersResponses.createOk, { manufacturer });
    } catch (error) {
      logger.error(__filename, 'createManufacturer', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  updateManufacturer: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const payload = request.payload as IUpdateManufacturer;
      const manufacturer = await manufacturerDomain.updateManufacturer(id, payload);
      response = responsesService.createResponseData(manufacturersResponses.updateOk, { manufacturer });
    } catch (error) {
      logger.error(__filename, 'updateManufacturer', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  deleteManufacturer: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await manufacturerDomain.deleteManufacturer(id);
      response = responsesService.createResponseData(manufacturersResponses.deleteOk);
    } catch (error) {
      logger.error(__filename, 'deleteManufacturer', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
