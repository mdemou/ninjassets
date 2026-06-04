import config from '@config/config';
import type { ServerRoute } from '@hapi/hapi';
import { manufacturerImageController } from './manufacturerImage.controller';
import manufacturerImageDocs from './manufacturerImage.doc';

const imageUploadPayload = {
  maxBytes: config.uploads.imageMaxBytes,
  output: 'data' as const,
  parse: false,
  allow: ['image/jpeg', 'image/png'],
};

export const adminUploadManufacturerImageRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/manufacturers/{id}/image',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Upload/replace a manufacturer image (admin only)',
    handler: manufacturerImageController.uploadImage,
    payload: imageUploadPayload,
    plugins: { 'hapi-swagger': { responses: manufacturerImageDocs.upload.responses } },
    validate: manufacturerImageDocs.upload.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteManufacturerImageRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/manufacturers/{id}/image',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Remove a manufacturer image (admin only)',
    handler: manufacturerImageController.removeImage,
    plugins: { 'hapi-swagger': { responses: manufacturerImageDocs.remove.responses } },
    validate: manufacturerImageDocs.remove.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetManufacturerImageRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/manufacturers/{id}/image',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Stream a manufacturer image (admin only)',
    handler: manufacturerImageController.getImage,
    plugins: { 'hapi-swagger': { responses: manufacturerImageDocs.get.responses } },
    validate: manufacturerImageDocs.get.parameters,
    tags: ['api', 'admin'],
  },
};
