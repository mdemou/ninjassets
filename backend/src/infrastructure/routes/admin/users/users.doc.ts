import config from '@config/config';
import { IUserRole, IUserStatus } from '@domain/_interfaces/users.interface';
import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import assetsResponses from '@routes/admin/assets/assets.responses';
import transactionsResponses from '@routes/admin/transactions/transactions.responses';
import Joi from 'joi';
import usersResponses from './users.responses';

const userSchema = Joi.object({
  id: Joi.string().uuid().required(),
  dateCreated: Joi.string().required(),
  email: Joi.string().email().required(),
  displayName: Joi.string().required(),
  roleId: Joi.number().required(),
  status: Joi.string().valid(IUserStatus.ACTIVE, IUserStatus.INACTIVE).required(),
  roleName: Joi.string().required(),
});

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const userIdParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid user id is required')),
});

const listQuery = Joi.object({
  search: Joi.string().allow('').max(200).optional(),
  page: Joi.number().integer().min(1).optional(),
});

const usersDocs = {
  listUsers: {
    responses: createResponseDoc('listUsers', usersResponses.listUsersOk, {
      dataSchema: Joi.object({
        users: Joi.array().items(userSchema),
        total: Joi.number(),
        page: Joi.number(),
        pageSize: Joi.number().allow(null),
      }),
      401: true,
      500: { statusCode: 500, code: 'USR5001', message: 'Failed to list users' },
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      query: Joi.object({
        search: Joi.string().allow('').max(200).optional(),
        page: Joi.number().integer().min(1).optional(),
      }),
      failAction: createValidationFailAction(usersResponses.badRequest),
    },
  },
  getUserDetails: {
    responses: createResponseDoc('getUserDetails', usersResponses.getUserOk, {
      dataSchema: userSchema,
      401: true,
      404: { statusCode: 404, code: 'ADU4001', message: 'User not found' },
      500: { statusCode: 500, code: 'USR5001', message: 'Failed to get user details' },
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      params: Joi.object({
        id: Joi.string().uuid().required().error(new Error('Valid user id is required')),
      }),
      failAction: createValidationFailAction(usersResponses.badRequest),
    },
  },
  createUser: {
    responses: createResponseDoc('createUser', usersResponses.createUserOk, {
      400: usersResponses.badRequest(400, 'Validation error'),
      401: true,
      409: { statusCode: 409, code: 'ADU4002', message: 'Email already exists' },
      500: { statusCode: 500, code: 'CRU5001', message: 'Failed to create user' },
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      payload: Joi.object({
        email: Joi.string().email().required().error(new Error('email must be a valid email address')),
        displayName: Joi.string().required().min(1).max(100).error(new Error('displayName is required. Max 100 chars')),
        roleName: Joi.string()
          .valid(...Object.values(IUserRole))
          .required()
          .error(new Error(`roleName must be one of: ${Object.values(IUserRole).join(', ')}`)),
      }),
      failAction: createValidationFailAction(usersResponses.badRequest),
    },
  },
  updateUser: {
    responses: createResponseDoc('updateUser', usersResponses.updateUserOk, {
      400: usersResponses.badRequest(400, 'Validation error'),
      401: true,
      404: { statusCode: 404, code: 'ADU4001', message: 'User not found' },
      409: { statusCode: 409, code: 'ADU4002', message: 'Email already exists' },
      500: { statusCode: 500, code: 'USR5001', message: 'Failed to update user' },
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      params: Joi.object({
        id: Joi.string().uuid().required().error(new Error('Valid user id is required')),
      }),
      payload: Joi.object({
        email: Joi.string().email().optional(),
        displayName: Joi.string().min(1).max(100).optional(),
        roleName: Joi.string()
          .valid(...Object.values(IUserRole))
          .optional()
          .error(new Error(`roleName must be one of: ${Object.values(IUserRole).join(', ')}`)),
        status: Joi.string()
          .valid(...Object.values(IUserStatus))
          .optional()
          .error(new Error(`status must be one of: ${Object.values(IUserStatus).join(', ')}`)),
      })
        .min(1)
        .error(new Error('At least one field to update is required')),
      failAction: createValidationFailAction(usersResponses.badRequest),
    },
  },
  changePassword: {
    responses: createResponseDoc('changeUserPassword', usersResponses.changePasswordOk, {
      400: usersResponses.badRequest(400, 'Validation error'),
      401: true,
      404: { statusCode: 404, code: 'ADU4001', message: 'User not found' },
      500: { statusCode: 500, code: 'USR5001', message: 'Failed to change password' },
    }),
    parameters: {
      headers: authHeaders,
      params: userIdParams,
      payload: Joi.object({
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
  deleteUser: {
    responses: createResponseDoc('deleteUser', usersResponses.deleteUserOk, {
      401: true,
      404: { statusCode: 404, code: 'ADU4001', message: 'User not found' },
      500: { statusCode: 500, code: 'USR5001', message: 'Failed to delete user' },
    }),
    parameters: {
      headers: authHeaders,
      params: userIdParams,
      failAction: createValidationFailAction(usersResponses.badRequest),
    },
  },
  listUserAssets: {
    responses: createResponseDoc('listUserAssets', assetsResponses.listAssetsOk, {
      401: true,
      404: { statusCode: 404, code: 'ADU4001', message: 'User not found' },
      500: { statusCode: 500, code: 'AST5001', message: 'Failed to list user assets' },
    }),
    parameters: {
      headers: authHeaders,
      params: userIdParams,
      query: listQuery,
      failAction: createValidationFailAction(usersResponses.badRequest),
    },
  },
  listUserTransactions: {
    responses: createResponseDoc('listUserTransactions', transactionsResponses.listOk, {
      401: true,
      404: { statusCode: 404, code: 'ADU4001', message: 'User not found' },
      500: { statusCode: 500, code: 'TRX5001', message: 'Failed to list user transactions' },
    }),
    parameters: {
      headers: authHeaders,
      params: userIdParams,
      query: listQuery,
      failAction: createValidationFailAction(usersResponses.badRequest),
    },
  },
};

export default usersDocs;
