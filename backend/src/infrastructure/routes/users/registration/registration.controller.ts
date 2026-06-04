import { IRegister, IResendVerification, IVerifyEmail } from '@domain/_interfaces/registration.interface';
import registrationDomainFactory from '@domain/users/registration/registration.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import emailVerificationTokenDbRepository from '@infrastructure/repositories/emailVerificationTokenDb/emailVerificationTokenDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import registrationResponses from '@routes/users/registration/registration.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const registrationDomain = registrationDomainFactory({
  userRepository: userDbRepository,
  emailVerificationTokenRepository: emailVerificationTokenDbRepository,
});

export const registrationController = {
  register: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as IRegister;
      await registrationDomain.register(payload);

      response = responsesService.createResponseData(registrationResponses.registerOk);
    } catch (error) {
      logger.error(__filename, 'register', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  verifyEmail: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as IVerifyEmail;
      await registrationDomain.verifyEmail(payload);

      response = responsesService.createResponseData(registrationResponses.verifyEmailOk);
    } catch (error) {
      logger.error(__filename, 'verifyEmail', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  resendVerification: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as IResendVerification;
      await registrationDomain.resendVerification(payload);

      response = responsesService.createResponseData(registrationResponses.resendVerificationOk);
    } catch (error) {
      logger.error(__filename, 'resendVerification', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
