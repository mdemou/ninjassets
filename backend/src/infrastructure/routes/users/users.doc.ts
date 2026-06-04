import config from '@config/config';
import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import usersResponses from './users.responses';

const usersDocs = {
  changePassword: {
    responses: createResponseDoc('changePassword', usersResponses.changePasswordOk, {
      400: usersResponses.badRequest(400, 'Current password is incorrect'),
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      payload: Joi.object({
        currentPassword: Joi.string().required().error(new Error('currentPassword is required')),
        password: Joi.string()
          .required()
          .pattern(config.passwordRegex)
          .error(new Error('password must be at least 8 characters with one uppercase, one lowercase, and one digit')),
        passwordConfirmation: Joi.string()
          .required()
          .valid(Joi.ref('password'))
          .error(new Error('passwordConfirmation must match password')),
      }),
      failAction: createValidationFailAction(usersResponses.badRequest),
    },
  },
  updateProfile: {
    responses: createResponseDoc('updateProfile', usersResponses.updateProfileOk, {
      400: usersResponses.badRequest(400, 'Validation error'),
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      payload: Joi.object({
        displayName: Joi.string().min(1).max(100).error(new Error('displayName must be 1-100 characters')),
      }).min(1),
      failAction: createValidationFailAction(usersResponses.badRequest),
    },
  },
  deleteAccount: {
    responses: createResponseDoc('deleteAccount', usersResponses.deleteAccountOk, {
      400: usersResponses.badRequest(400, 'Current password is incorrect'),
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      payload: Joi.object({
        password: Joi.string().required().error(new Error('password is required')),
      }),
      failAction: createValidationFailAction(usersResponses.badRequest),
    },
  },
};

export default usersDocs;
