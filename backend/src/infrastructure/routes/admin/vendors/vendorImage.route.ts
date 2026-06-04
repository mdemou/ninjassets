import config from '@config/config';
import type { ServerRoute } from '@hapi/hapi';
import { vendorImageController } from './vendorImage.controller';
import vendorImageDocs from './vendorImage.doc';

const imageUploadPayload = {
  maxBytes: config.uploads.imageMaxBytes,
  output: 'data' as const,
  parse: false,
  allow: ['image/jpeg', 'image/png'],
};

export const adminUploadVendorImageRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/vendors/{id}/image',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Upload/replace a vendor image (admin only)',
    handler: vendorImageController.uploadImage,
    payload: imageUploadPayload,
    plugins: { 'hapi-swagger': { responses: vendorImageDocs.upload.responses } },
    validate: vendorImageDocs.upload.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteVendorImageRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/vendors/{id}/image',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Remove a vendor image (admin only)',
    handler: vendorImageController.removeImage,
    plugins: { 'hapi-swagger': { responses: vendorImageDocs.remove.responses } },
    validate: vendorImageDocs.remove.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetVendorImageRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/vendors/{id}/image',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Stream a vendor image (admin only)',
    handler: vendorImageController.getImage,
    plugins: { 'hapi-swagger': { responses: vendorImageDocs.get.responses } },
    validate: vendorImageDocs.get.parameters,
    tags: ['api', 'admin'],
  },
};
