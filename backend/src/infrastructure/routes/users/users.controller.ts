import {
  IChangePasswordPayload,
  IDeleteAccountPayload,
  IUpdateProfilePayload,
} from '@domain/_interfaces/users.interface';
import usersDomainFactory from '@domain/users/users.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import sessionDbRepository from '@infrastructure/repositories/sessionDb/sessionDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';
import usersResponses from './users.responses';

const usersDomain = usersDomainFactory({
  userRepository: userDbRepository,
  sessionRepository: sessionDbRepository,
});

export const usersController = {
  async changePassword(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const userId = (request.auth.credentials as { id: string }).id;
      const authorization = request.headers.authorization;
      const token = typeof authorization === 'string' ? authorization.replace('Bearer ', '') : '';
      const payload = request.payload as IChangePasswordPayload;

      await usersDomain.changePassword(userId, token, payload);

      response = responsesService.createResponseData(usersResponses.changePasswordOk);
    } catch (error) {
      logger.error(__filename, 'changePassword', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async updateProfile(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const userId = (request.auth.credentials as { id: string }).id;
      const payload = request.payload as IUpdateProfilePayload;

      await usersDomain.updateProfile(userId, payload);

      response = responsesService.createResponseData(usersResponses.updateProfileOk);
    } catch (error) {
      logger.error(__filename, 'updateProfile', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async deleteAccount(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const userId = (request.auth.credentials as { id: string }).id;
      const payload = request.payload as IDeleteAccountPayload;

      await usersDomain.deleteAccount(userId, payload);

      response = responsesService.createResponseData(usersResponses.deleteAccountOk);
    } catch (error) {
      logger.error(__filename, 'deleteAccount', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
