import config from '@config/config';
import type { ServerRoute } from '@hapi/hapi';
import { assetImageController } from './assetImage.controller';
import assetImageDocs from './assetImage.doc';

const imageUploadPayload = {
  maxBytes: config.uploads.imageMaxBytes,
  output: 'data' as const,
  parse: false,
  allow: ['image/jpeg', 'image/png'],
};

export const adminUploadAssetImageRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/assets/{id}/image',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Upload/replace an asset image (admin only)',
    handler: assetImageController.uploadAssetImage,
    payload: imageUploadPayload,
    plugins: { 'hapi-swagger': { responses: assetImageDocs.upload.responses } },
    validate: assetImageDocs.upload.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteAssetImageRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/assets/{id}/image',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Remove an asset image (admin only)',
    handler: assetImageController.removeAssetImage,
    plugins: { 'hapi-swagger': { responses: assetImageDocs.remove.responses } },
    validate: assetImageDocs.remove.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetAssetImageRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/assets/{id}/image',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Stream an asset image (admin only)',
    handler: assetImageController.getAssetImage,
    plugins: { 'hapi-swagger': { responses: assetImageDocs.get.responses } },
    validate: assetImageDocs.get.parameters,
    tags: ['api', 'admin'],
  },
};
