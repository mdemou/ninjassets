import type { ServerRoute } from '@hapi/hapi';
import { passwordResetController } from './passwordReset.controller';
import passwordResetDocs from './passwordReset.doc';

export const passwordForgotRoute: ServerRoute = {
  method: 'POST',
  path: '/api/session/forgot-password',
  options: {
    auth: false,
    description: 'Request password reset',
    handler: passwordResetController.forgotPassword,
    plugins: {
      'hapi-swagger': {
        responses: passwordResetDocs.forgotPassword.responses,
      },
    },
    validate: passwordResetDocs.forgotPassword.parameters,
    tags: ['api', 'password-reset'],
  },
};

export const passwordResetRoute: ServerRoute = {
  method: 'POST',
  path: '/api/session/reset-password',
  options: {
    auth: false,
    description: 'Reset password with token',
    handler: passwordResetController.resetPassword,
    plugins: {
      'hapi-swagger': {
        responses: passwordResetDocs.resetPassword.responses,
      },
    },
    validate: passwordResetDocs.resetPassword.parameters,
    tags: ['api', 'password-reset'],
  },
};
