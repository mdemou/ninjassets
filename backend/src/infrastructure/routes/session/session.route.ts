import type { ServerRoute } from '@hapi/hapi';
import { sessionController } from './session.controller';
import sessionDocs from './session.doc';

export const sessionPublicConfigRoute: ServerRoute = {
  method: 'GET',
  path: '/api/session/public-config',
  options: {
    auth: false,
    description: 'Public client configuration',
    handler: sessionController.publicConfig,
    plugins: {
      'hapi-swagger': {
        responses: sessionDocs.publicConfig.responses,
      },
    },
    validate: sessionDocs.publicConfig.parameters,
    tags: ['api', 'session'],
  },
};

export const sessionLoginRoute: ServerRoute = {
  method: 'POST',
  path: '/api/session/login',
  options: {
    auth: false,
    description: 'User login',
    handler: sessionController.login,
    plugins: {
      'hapi-swagger': {
        responses: sessionDocs.login.responses,
      },
    },
    validate: sessionDocs.login.parameters,
    tags: ['api', 'session'],
  },
};

export const sessionLogoutRoute: ServerRoute = {
  method: 'GET',
  path: '/api/session/logout',
  options: {
    auth: {
      strategies: ['JWTAdminAndUser'],
    },
    description: 'User logout',
    handler: sessionController.logout,
    plugins: {
      'hapi-swagger': {
        responses: sessionDocs.logout.responses,
      },
    },
    validate: sessionDocs.logout.parameters,
    tags: ['api', 'session'],
  },
};

export const sessionMeRoute: ServerRoute = {
  method: 'GET',
  path: '/api/session/me',
  options: {
    auth: {
      strategies: ['JWTAdminAndUser'],
    },
    description: 'Get current user',
    handler: sessionController.me,
    plugins: {
      'hapi-swagger': {
        responses: sessionDocs.me.responses,
      },
    },
    validate: sessionDocs.me.parameters,
    tags: ['api', 'session'],
  },
};
