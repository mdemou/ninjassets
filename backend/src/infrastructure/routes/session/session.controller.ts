import config from '@config/config';
import { ILogin, ILoginResponse } from '@domain/_interfaces/session.interface';
import sessionDomainFactory from '@domain/session/session.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import sessionDbRepository from '@infrastructure/repositories/sessionDb/sessionDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import sessionResponses from '@infrastructure/routes/session/session.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const sessionDomain = sessionDomainFactory({
  findByEmail: userDbRepository.findByEmail,
  findById: userDbRepository.findById,
  insertJWT: sessionDbRepository.insertJWT,
  removeJWT: sessionDbRepository.removeJWT,
});

export const sessionController = {
  login: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as ILogin;

      const loginResponse: ILoginResponse = await sessionDomain.login(payload);

      response = responsesService.createResponseData(sessionResponses.loginOk, {
        token: loginResponse.token,
        user: loginResponse.user,
      });
    } catch (error) {
      logger.error(__filename, 'login', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  logout: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      await sessionDomain.logout(request);

      response = responsesService.createResponseData(sessionResponses.logoutOk);
    } catch (error) {
      logger.error(__filename, 'logout', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  publicConfig: (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      response = responsesService.createResponseData(sessionResponses.publicConfigOk, {
        signupEnabled: config.signupEnabled,
      });
    } catch (error) {
      logger.error(__filename, 'publicConfig', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  me: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const credentials = request.auth.credentials as { id: string };
      const meResponse = await sessionDomain.me(credentials.id);
      response = responsesService.createResponseData(sessionResponses.meOk, meResponse);
    } catch (error) {
      logger.error(__filename, 'me', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
