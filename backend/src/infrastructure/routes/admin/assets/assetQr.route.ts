import type { ServerRoute } from '@hapi/hapi';
import { assetQrController } from './assetQr.controller';
import assetQrDocs from './assetQr.doc';

export const adminGetAssetQrRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/assets/{id}/qr',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Generate a PNG QR code linking to the admin asset detail page',
    handler: assetQrController.getAssetQr,
    plugins: { 'hapi-swagger': { responses: assetQrDocs.get.responses } },
    validate: assetQrDocs.get.parameters,
    tags: ['api', 'admin'],
  },
};
