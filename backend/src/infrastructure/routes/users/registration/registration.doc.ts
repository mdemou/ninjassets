import config from '@config/config';
import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import registrationResponses from './registration.responses';

const registrationDocs = {
  register: {
    responses: createResponseDoc('register', registrationResponses.registerOk, {
      400: registrationResponses.badRequest(400, 'Validation error'),
      403: { statusCode: 403, code: 'REG4030', message: 'Registration is disabled' },
      409: { statusCode: 409, code: 'REG4001', message: 'Email already exists' },
    }),
    parameters: {
      payload: Joi.object({
        email: Joi.string().email().required().error(new Error('email must be a valid email address')),
        displayName: Joi.string().required().min(1).max(100).error(new Error('displayName is required. Max 100 chars')),
        password: Joi.string()
          .optional()
          .pattern(config.passwordRegex)
          .error(new Error('password must be at least 8 characters with one uppercase, one lowercase, and one digit')),
        passwordConfirmation: Joi.string()
          .when('password', {
            is: Joi.exist(),
            then: Joi.valid(Joi.ref('password')).required(),
            otherwise: Joi.optional(),
          })
          .error(new Error('passwordConfirmation must match password')),
        captchaToken: Joi.string().required().allow('').error(new Error('captchaToken is required')),
      }),
      failAction: createValidationFailAction(registrationResponses.badRequest),
    },
  },
  verifyEmail: {
    responses: createResponseDoc('verifyEmail', registrationResponses.verifyEmailOk, {
      400: { statusCode: 400, code: 'REG4004', message: 'Invalid or expired verification token' },
    }),
    parameters: {
      payload: Joi.object({
        token: Joi.string().required().length(64).error(new Error('token is required and must be 64 characters')),
      }),
      failAction: createValidationFailAction(registrationResponses.badRequest),
    },
  },
  resendVerification: {
    responses: createResponseDoc('resendVerification', registrationResponses.resendVerificationOk, {
    }),
    parameters: {
      payload: Joi.object({
        email: Joi.string().email().required().error(new Error('email must be a valid email address')),
      }),
      failAction: createValidationFailAction(registrationResponses.badRequest),
    },
  },
};

export default registrationDocs;
