import { ICreateCategory, IUpdateCategory } from '@domain/_interfaces/category.interface';
import categoryDomainFactory from '@domain/categories/categories.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import categoryDbRepository from '@infrastructure/repositories/categoryDb/categoryDb.repository';
import categoriesResponses from '@routes/admin/categories/categories.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const categoryDomain = categoryDomainFactory({
  categoryRepository: categoryDbRepository,
});

export const categoriesController = {
  listCategories: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { search, page } = request.query as { search?: string; page?: number };
      const result = await categoryDomain.listCategories({ search, page });
      response = responsesService.createResponseData(categoriesResponses.listOk, result);
    } catch (error) {
      logger.error(__filename, 'listCategories', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  getCategoryDetails: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const category = await categoryDomain.getCategoryDetails(id);
      response = responsesService.createResponseData(categoriesResponses.getOk, { category });
    } catch (error) {
      logger.error(__filename, 'getCategoryDetails', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  createCategory: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as ICreateCategory;
      const category = await categoryDomain.createCategory(payload);
      response = responsesService.createResponseData(categoriesResponses.createOk, { category });
    } catch (error) {
      logger.error(__filename, 'createCategory', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  updateCategory: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const payload = request.payload as IUpdateCategory;
      const category = await categoryDomain.updateCategory(id, payload);
      response = responsesService.createResponseData(categoriesResponses.updateOk, { category });
    } catch (error) {
      logger.error(__filename, 'updateCategory', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  deleteCategory: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await categoryDomain.deleteCategory(id);
      response = responsesService.createResponseData(categoriesResponses.deleteOk);
    } catch (error) {
      logger.error(__filename, 'deleteCategory', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
