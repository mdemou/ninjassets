import type { ServerRoute } from '@hapi/hapi';
import { CapabilityEnum } from '@infrastructure/roles/capabilities';
import { usersController } from './users.controller';
import usersDocs from './users.doc';

export const adminListUsersRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/users',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.USERS_READ },
    description: 'List all users (admin only)',
    handler: usersController.listUsers,
    plugins: {
      'hapi-swagger': {
        responses: usersDocs.listUsers.responses,
      },
    },
    validate: usersDocs.listUsers.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetUserDetailsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/users/{id}',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.USERS_READ },
    description: 'Get user details by id (admin only)',
    handler: usersController.getUserDetails,
    plugins: {
      'hapi-swagger': {
        responses: usersDocs.getUserDetails.responses,
      },
    },
    validate: usersDocs.getUserDetails.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCreateUserRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/users',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.USERS_WRITE },
    description: 'Create a new user (admin only)',
    handler: usersController.createUser,
    plugins: {
      'hapi-swagger': {
        responses: usersDocs.createUser.responses,
      },
    },
    validate: usersDocs.createUser.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminUpdateUserRoute: ServerRoute = {
  method: 'PATCH',
  path: '/api/p/users/{id}',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.USERS_WRITE },
    description: 'Update a user (admin only)',
    handler: usersController.updateUser,
    plugins: {
      'hapi-swagger': {
        responses: usersDocs.updateUser.responses,
      },
    },
    validate: usersDocs.updateUser.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminChangeUserPasswordRoute: ServerRoute = {
  method: 'PATCH',
  path: '/api/p/users/{id}/password',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.USERS_WRITE },
    description: "Change a user's password (admin only)",
    handler: usersController.changeUserPassword,
    plugins: {
      'hapi-swagger': {
        responses: usersDocs.changePassword.responses,
      },
    },
    validate: usersDocs.changePassword.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteUserRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/users/{id}',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.USERS_WRITE },
    description: 'Delete a user (admin only)',
    handler: usersController.deleteUser,
    plugins: {
      'hapi-swagger': {
        responses: usersDocs.deleteUser.responses,
      },
    },
    validate: usersDocs.deleteUser.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminListUserAssetsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/users/{id}/assets',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.USERS_READ },
    description: 'List assets assigned to a user (admin only)',
    handler: usersController.listUserAssets,
    plugins: {
      'hapi-swagger': {
        responses: usersDocs.listUserAssets.responses,
      },
    },
    validate: usersDocs.listUserAssets.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminListUserTransactionsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/users/{id}/transactions',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.USERS_READ },
    description: 'List asset history for a user (admin only)',
    handler: usersController.listUserTransactions,
    plugins: {
      'hapi-swagger': {
        responses: usersDocs.listUserTransactions.responses,
      },
    },
    validate: usersDocs.listUserTransactions.parameters,
    tags: ['api', 'admin'],
  },
};
