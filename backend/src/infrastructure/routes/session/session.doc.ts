import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import sessionResponses from './session.responses';

const loginDataSchema = Joi.object({
  token: Joi.string().example('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'),
  user: Joi.object({
    id: Joi.string().example('550e8400-e29b-41d4-a716-446655440000'),
    email: Joi.string().example('user@example.com'),
    displayName: Joi.string().example('John Doe'),
    roleName: Joi.string().example('USER'),
  }),
});

const sessionDocs = {
  login: {
    responses: createResponseDoc('login', sessionResponses.loginOk, {
      dataSchema: loginDataSchema,
      400: sessionResponses.badRequest(400, 'Invalid email or password'),
      500: { statusCode: 500, code: 'AUTH5001', message: 'Internal server error' },
    }),
    parameters: {
      payload: Joi.object({
        email: Joi.string().email().required().error(new Error('email must be a valid email address')),
        password: Joi.string().required().min(6).error(new Error('password is required. Min 6 chars')),
        captchaToken: Joi.string().required().allow('').error(new Error('captchaToken is required')),
        platform: Joi.string().required().error(new Error('platform is required')),
      }),
      failAction: createValidationFailAction(sessionResponses.badRequest),
    },
  },
  logout: {
    responses: createResponseDoc('logout', sessionResponses.logoutOk, {
      401: true,
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      failAction: createValidationFailAction(sessionResponses.badRequest),
    },
  },
  publicConfig: {
    responses: createResponseDoc('publicConfig', sessionResponses.publicConfigOk, {
      dataSchema: Joi.object({
        signupEnabled: Joi.boolean().example(true),
        aiEnabled: Joi.boolean().example(false),
      }),
    }),
    parameters: {},
  },
  me: {
    responses: createResponseDoc('me', sessionResponses.meOk, {
      dataSchema: Joi.object({
        user: Joi.object({
          id: Joi.string().uuid(),
          dateCreated: Joi.string(),
          email: Joi.string().email(),
          displayName: Joi.string(),
          roleName: Joi.string(),
        }),
      }),
      401: true,
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      failAction: createValidationFailAction(sessionResponses.badRequest),
    },
  },
};

export default sessionDocs;
