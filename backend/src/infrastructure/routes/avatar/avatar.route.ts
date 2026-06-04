import config from '@config/config';
import type { ServerRoute } from '@hapi/hapi';
import { avatarController } from './avatar.controller';
import avatarDocs from './avatar.doc';

// Raw image body (image/jpeg|png). The 1 MB cap is enforced here at the route
// level via maxBytes; the content-type is restricted via allow.
const imageUploadPayload = {
  maxBytes: config.uploads.imageMaxBytes,
  output: 'data' as const,
  parse: false,
  allow: ['image/jpeg', 'image/png'],
};

export const uploadMyAvatarRoute: ServerRoute = {
  method: 'POST',
  path: '/api/user/avatar',
  options: {
    auth: { strategies: ['JWTAdminAndUser'] },
    description: 'Upload/replace the current user’s avatar',
    handler: avatarController.uploadMyAvatar,
    payload: imageUploadPayload,
    plugins: { 'hapi-swagger': { responses: avatarDocs.upload.responses } },
    validate: avatarDocs.upload.parameters,
    tags: ['api', 'me'],
  },
};

export const deleteMyAvatarRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/user/avatar',
  options: {
    auth: { strategies: ['JWTAdminAndUser'] },
    description: 'Remove the current user’s avatar',
    handler: avatarController.deleteMyAvatar,
    plugins: { 'hapi-swagger': { responses: avatarDocs.remove.responses } },
    validate: avatarDocs.remove.parameters,
    tags: ['api', 'me'],
  },
};

export const getUserAvatarRoute: ServerRoute = {
  method: 'GET',
  path: '/api/users/{id}/avatar',
  options: {
    auth: { strategies: ['JWTAdminAndUser'] },
    description: 'Stream a user’s avatar (admin: any user; user: self only)',
    handler: avatarController.getUserAvatar,
    plugins: { 'hapi-swagger': { responses: avatarDocs.get.responses } },
    validate: avatarDocs.get.parameters,
    tags: ['api', 'me'],
  },
};

export const adminUploadUserAvatarRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/users/{id}/avatar',
  options: {
    auth: { strategies: ['JWTAdmin'] },
    description: 'Upload/replace a user’s avatar (admin only)',
    handler: avatarController.uploadUserAvatar,
    payload: imageUploadPayload,
    plugins: { 'hapi-swagger': { responses: avatarDocs.uploadForUser.responses } },
    validate: avatarDocs.uploadForUser.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteUserAvatarRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/users/{id}/avatar',
  options: {
    auth: { strategies: ['JWTAdmin'] },
    description: 'Remove a user’s avatar (admin only)',
    handler: avatarController.deleteUserAvatar,
    plugins: { 'hapi-swagger': { responses: avatarDocs.removeForUser.responses } },
    validate: avatarDocs.removeForUser.parameters,
    tags: ['api', 'admin'],
  },
};
