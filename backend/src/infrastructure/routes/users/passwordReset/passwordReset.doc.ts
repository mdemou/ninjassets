import config from '@config/config';
import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import passwordResetResponses from './passwordReset.responses';

const passwordResetDocs = {
  forgotPassword: {
    responses: createResponseDoc('forgotPassword', passwordResetResponses.forgotPasswordOk, {
    }),
    parameters: {
      payload: Joi.object({
        email: Joi.string().email().required().error(new Error('email must be a valid email address')),
      }),
      failAction: createValidationFailAction(passwordResetResponses.badRequest),
    },
  },
  resetPassword: {
    responses: createResponseDoc('resetPassword', passwordResetResponses.resetPasswordOk, {
      400: passwordResetResponses.badRequest(400, 'Invalid or expired reset token'),
    }),
    parameters: {
      payload: Joi.object({
        token: Joi.string().required().length(64).error(new Error('token is required and must be 64 characters')),
        password: Joi.string()
          .required()
          .pattern(config.passwordRegex)
          .error(new Error('password must be at least 8 characters with one uppercase, one lowercase, and one digit')),
        passwordConfirmation: Joi.string()
          .required()
          .valid(Joi.ref('password'))
          .error(new Error('passwordConfirmation must match password')),
      }),
      failAction: createValidationFailAction(passwordResetResponses.badRequest),
    },
  },
};

export default passwordResetDocs;
