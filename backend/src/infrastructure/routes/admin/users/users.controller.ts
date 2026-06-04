import { IAdminChangePassword, ICreateUser, IUpdateUser } from '@domain/_interfaces/userManagement.interface';
import assetDomainFactory from '@domain/assets/assets.domain';
import transactionDomainFactory from '@domain/transactions/transactions.domain';
import managementDomainFactory from '@domain/users/management/management.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import assetDbRepository from '@infrastructure/repositories/assetDb/assetDb.repository';
import manufacturerDbRepository from '@infrastructure/repositories/manufacturerDb/manufacturerDb.repository';
import passwordResetTokenDbRepository from '@infrastructure/repositories/passwordResetTokenDb/passwordResetTokenDb.repository';
import sessionDbRepository from '@infrastructure/repositories/sessionDb/sessionDb.repository';
import siteDbRepository from '@infrastructure/repositories/siteDb/siteDb.repository';
import vendorDbRepository from '@infrastructure/repositories/vendorDb/vendorDb.repository';
import categoryDbRepository from '@infrastructure/repositories/categoryDb/categoryDb.repository';
import transactionDbRepository from '@infrastructure/repositories/transactionDb/transactionDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import assetsResponses from '@routes/admin/assets/assets.responses';
import transactionsResponses from '@routes/admin/transactions/transactions.responses';
import usersResponses from '@routes/admin/users/users.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const managementDomain = managementDomainFactory({
  userRepository: userDbRepository,
  passwordResetTokenRepository: passwordResetTokenDbRepository,
  sessionRepository: sessionDbRepository,
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

const transactionDomain = transactionDomainFactory({
  transactionRepository: transactionDbRepository,
});

export const usersController = {
  listUsers: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { search, page } = request.query as { search?: string; page?: number };
      const result = await managementDomain.listUsers({ search, page });
      response = responsesService.createResponseData(usersResponses.listUsersOk, result);
    } catch (error) {
      logger.error(__filename, 'listUsers', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  getUserDetails: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const user = await managementDomain.getUserDetails(id);
      response = responsesService.createResponseData(usersResponses.getUserOk, { user });
    } catch (error) {
      logger.error(__filename, 'getUserDetails', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  createUser: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as ICreateUser;
      await managementDomain.createUser(payload);
      response = responsesService.createResponseData(usersResponses.createUserOk);
    } catch (error) {
      logger.error(__filename, 'createUser', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  updateUser: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const payload = request.payload as IUpdateUser;
      await managementDomain.updateUser(id, payload);
      response = responsesService.createResponseData(usersResponses.updateUserOk);
    } catch (error) {
      logger.error(__filename, 'updateUser', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  changeUserPassword: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const { password } = request.payload as IAdminChangePassword;
      await managementDomain.changeUserPassword(id, password);
      response = responsesService.createResponseData(usersResponses.changePasswordOk);
    } catch (error) {
      logger.error(__filename, 'changeUserPassword', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  deleteUser: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await managementDomain.deleteUser(id);
      response = responsesService.createResponseData(usersResponses.deleteUserOk);
    } catch (error) {
      logger.error(__filename, 'deleteUser', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  listUserAssets: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const { search, page } = request.query as { search?: string; page?: number };
      await managementDomain.getUserDetails(id);
      const result = await assetDomain.listMyAssets(id, { search, page });
      response = responsesService.createResponseData(assetsResponses.listAssetsOk, result);
    } catch (error) {
      logger.error(__filename, 'listUserAssets', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  listUserTransactions: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const { search, page } = request.query as { search?: string; page?: number };
      await managementDomain.getUserDetails(id);
      const result = await transactionDomain.listMyTransactions(id, { search, page });
      response = responsesService.createResponseData(transactionsResponses.listOk, result);
    } catch (error) {
      logger.error(__filename, 'listUserTransactions', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
