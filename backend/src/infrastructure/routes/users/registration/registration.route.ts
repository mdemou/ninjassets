import type { ServerRoute } from '@hapi/hapi';
import { registrationController } from './registration.controller';
import registrationDocs from './registration.doc';

export const registrationRegisterRoute: ServerRoute = {
  method: 'POST',
  path: '/api/session/register',
  options: {
    auth: false,
    description: 'User registration',
    handler: registrationController.register,
    plugins: {
      'hapi-swagger': {
        responses: registrationDocs.register.responses,
      },
    },
    validate: registrationDocs.register.parameters,
    tags: ['api', 'registration'],
  },
};

export const registrationVerifyEmailRoute: ServerRoute = {
  method: 'POST',
  path: '/api/session/verify-email',
  options: {
    auth: false,
    description: 'Verify email address',
    handler: registrationController.verifyEmail,
    plugins: {
      'hapi-swagger': {
        responses: registrationDocs.verifyEmail.responses,
      },
    },
    validate: registrationDocs.verifyEmail.parameters,
    tags: ['api', 'registration'],
  },
};

export const registrationResendVerificationRoute: ServerRoute = {
  method: 'POST',
  path: '/api/session/resend-verification',
  options: {
    auth: false,
    description: 'Resend verification email',
    handler: registrationController.resendVerification,
    plugins: {
      'hapi-swagger': {
        responses: registrationDocs.resendVerification.responses,
      },
    },
    validate: registrationDocs.resendVerification.parameters,
    tags: ['api', 'registration'],
  },
};
