import type { ServerRoute } from '@hapi/hapi';
import { usersController } from './users.controller';
import usersDocs from './users.doc';

export const usersChangePasswordRoute: ServerRoute = {
  method: 'PATCH',
  path: '/api/session/change-password',
  options: {
    auth: {
      strategies: ['JWTAdminAndUser'],
    },
    description: 'Change password',
    handler: usersController.changePassword,
    plugins: {
      'hapi-swagger': {
        responses: usersDocs.changePassword.responses,
      },
    },
    validate: usersDocs.changePassword.parameters,
    tags: ['api', 'users'],
  },
};

export const usersUpdateProfileRoute: ServerRoute = {
  method: 'PATCH',
  path: '/api/user/profile',
  options: {
    auth: {
      strategies: ['JWTAdminAndUser'],
    },
    description: 'Update user profile',
    handler: usersController.updateProfile,
    plugins: {
      'hapi-swagger': {
        responses: usersDocs.updateProfile.responses,
      },
    },
    validate: usersDocs.updateProfile.parameters,
    tags: ['api', 'users'],
  },
};

export const usersDeleteAccountRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/user/account',
  options: {
    auth: {
      strategies: ['JWTAdminAndUser'],
    },
    description: 'Delete user account',
    handler: usersController.deleteAccount,
    plugins: {
      'hapi-swagger': {
        responses: usersDocs.deleteAccount.responses,
      },
    },
    validate: usersDocs.deleteAccount.parameters,
    tags: ['api', 'users'],
  },
};
