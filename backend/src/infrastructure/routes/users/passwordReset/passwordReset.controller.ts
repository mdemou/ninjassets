import { IForgotPasswordPayload, IResetPasswordPayload } from '@domain/_interfaces/passwordReset.interface';
import passwordResetDomainFactory from '@domain/users/passwordReset/passwordReset.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import passwordResetTokenDbRepository from '@infrastructure/repositories/passwordResetTokenDb/passwordResetTokenDb.repository';
import sessionDbRepository from '@infrastructure/repositories/sessionDb/sessionDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import passwordResetResponses from '@routes/users/passwordReset/passwordReset.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const passwordResetDomain = passwordResetDomainFactory({
  userRepository: userDbRepository,
  passwordResetTokenRepository: passwordResetTokenDbRepository,
  sessionRepository: sessionDbRepository,
});

export const passwordResetController = {
  async forgotPassword(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const payload = request.payload as IForgotPasswordPayload;
      await passwordResetDomain.forgotPassword(payload);

      response = responsesService.createResponseData(passwordResetResponses.forgotPasswordOk);
    } catch (error) {
      logger.error(__filename, 'forgotPassword', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async resetPassword(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const payload = request.payload as IResetPasswordPayload;
      await passwordResetDomain.resetPassword(payload);

      response = responsesService.createResponseData(passwordResetResponses.resetPasswordOk);
    } catch (error) {
      logger.error(__filename, 'resetPassword', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
