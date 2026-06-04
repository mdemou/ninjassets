import type { ServerRoute } from '@hapi/hapi';
import { CapabilityEnum } from '@infrastructure/roles/capabilities';
import { assetsController } from './assets.controller';
import assetsDocs from './assets.doc';

export const adminListAssetsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/assets',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.ASSETS_READ },
    description: 'List all assets (admin only)',
    handler: assetsController.listAssets,
    plugins: {
      'hapi-swagger': {
        responses: assetsDocs.listAssets.responses,
      },
    },
    validate: assetsDocs.listAssets.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminListAssetMapMarkersRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/assets/map-markers',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.ASSETS_READ },
    description: 'List asset map markers (admin only)',
    handler: assetsController.listMapMarkers,
    plugins: {
      'hapi-swagger': {
        responses: assetsDocs.listMapMarkers.responses,
      },
    },
    validate: assetsDocs.listMapMarkers.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetAssetDetailsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/assets/{id}',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.ASSETS_READ },
    description: 'Get asset details by id (admin only)',
    handler: assetsController.getAssetDetails,
    plugins: {
      'hapi-swagger': {
        responses: assetsDocs.getAssetDetails.responses,
      },
    },
    validate: assetsDocs.getAssetDetails.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCreateAssetRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/assets',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.ASSETS_WRITE },
    description: 'Create a new asset (admin only)',
    handler: assetsController.createAsset,
    plugins: {
      'hapi-swagger': {
        responses: assetsDocs.createAsset.responses,
      },
    },
    validate: assetsDocs.createAsset.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminUpdateAssetRoute: ServerRoute = {
  method: 'PATCH',
  path: '/api/p/assets/{id}',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.ASSETS_WRITE },
    description: 'Update an asset (admin only)',
    handler: assetsController.updateAsset,
    plugins: {
      'hapi-swagger': {
        responses: assetsDocs.updateAsset.responses,
      },
    },
    validate: assetsDocs.updateAsset.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteAssetRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/assets/{id}',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.ASSETS_WRITE },
    description: 'Delete an asset (admin only)',
    handler: assetsController.deleteAsset,
    plugins: {
      'hapi-swagger': {
        responses: assetsDocs.deleteAsset.responses,
      },
    },
    validate: assetsDocs.deleteAsset.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminListAssetTransactionsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/assets/{id}/transactions',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.ASSETS_READ },
    description: 'List transaction history for an asset (admin only)',
    handler: assetsController.listAssetTransactions,
    plugins: {
      'hapi-swagger': {
        responses: assetsDocs.listAssetTransactions.responses,
      },
    },
    validate: assetsDocs.listAssetTransactions.parameters,
    tags: ['api', 'admin'],
  },
};
