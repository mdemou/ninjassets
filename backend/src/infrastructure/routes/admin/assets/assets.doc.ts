import { IAssetStatus, IDepreciationMethod } from '@domain/_interfaces/asset.interface';
import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import transactionsResponses from '@routes/admin/transactions/transactions.responses';
import Joi from 'joi';
import assetsResponses from './assets.responses';

const ASSET_STATUSES = Object.values(IAssetStatus);
const DEPRECIATION_METHODS = Object.values(IDepreciationMethod);

const childSummarySchema = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().required(),
  model: Joi.string().required(),
  serialNumber: Joi.string().required(),
  status: Joi.string()
    .valid(...ASSET_STATUSES)
    .required(),
});

const assetSchema = Joi.object({
  id: Joi.string().uuid().required(),
  dateCreated: Joi.string().required(),
  dateUpdated: Joi.string().required(),
  name: Joi.string().required(),
  model: Joi.string().allow('').required(),
  serialNumber: Joi.string().required(),
  status: Joi.string()
    .valid(...ASSET_STATUSES)
    .required(),
  assignedUserId: Joi.string().uuid().allow(null).required(),
  siteId: Joi.string().uuid().allow(null).required(),
  latitude: Joi.number().allow(null).required(),
  longitude: Joi.number().allow(null).required(),
  assignedUserName: Joi.string().allow(null).required(),
  assignedUserEmail: Joi.string().allow(null).required(),
  assignedUserAvatarFilename: Joi.string().allow(null).optional(),
  imageFilename: Joi.string().allow(null).required(),
  note: Joi.string().allow(null).required(),
  siteName: Joi.string().allow(null).required(),
  effectiveLatitude: Joi.number().allow(null).required(),
  effectiveLongitude: Joi.number().allow(null).required(),
  detailUrl: Joi.string().uri().required(),
  manufacturerId: Joi.string().uuid().allow(null).required(),
  vendorId: Joi.string().uuid().allow(null).required(),
  parentAssetId: Joi.string().uuid().allow(null).required(),
  categoryId: Joi.string().uuid().allow(null).required(),
  categoryName: Joi.string().allow(null).required(),
  customFields: Joi.object().unknown(true).required(),
  manufacturerName: Joi.string().allow(null).required(),
  manufacturerImageFilename: Joi.string().allow(null).required(),
  assignedAt: Joi.string().allow(null).required(),
  vendorName: Joi.string().allow(null).required(),
  parentAssetName: Joi.string().allow(null).required(),
  childCount: Joi.number().required(),
  children: Joi.array().items(childSummarySchema).optional(),
  purchaseDate: Joi.string().allow(null).required(),
  purchaseCost: Joi.number().allow(null).required(),
  salvageValue: Joi.number().allow(null).required(),
  usefulLifeMonths: Joi.number().integer().allow(null).required(),
  depreciationMethod: Joi.string()
    .valid(...DEPRECIATION_METHODS)
    .allow(null)
    .required(),
  monthlyDepreciation: Joi.number().allow(null).required(),
  accumulatedDepreciation: Joi.number().allow(null).required(),
  bookValue: Joi.number().allow(null).required(),
  warrantyEndDate: Joi.string().isoDate().allow(null).required(),
  expectedReturnDate: Joi.string().isoDate().allow(null).required(),
}).label('Asset');

const financialPayloadFields = {
  manufacturerId: Joi.string().uuid().allow(null).optional(),
  vendorId: Joi.string().uuid().allow(null).optional(),
  parentAssetId: Joi.string().uuid().allow(null).optional(),
  categoryId: Joi.string().uuid().allow(null).optional(),
  customFields: Joi.object().unknown(true).optional(),
  purchaseDate: Joi.string().isoDate().allow(null).optional(),
  purchaseCost: Joi.number().min(0).allow(null).optional(),
  salvageValue: Joi.number().min(0).allow(null).optional(),
  usefulLifeMonths: Joi.number().integer().min(1).allow(null).optional(),
  depreciationMethod: Joi.string()
    .valid(...DEPRECIATION_METHODS)
    .allow(null)
    .optional(),
  warrantyEndDate: Joi.string().isoDate().allow(null).optional(),
  expectedReturnDate: Joi.string().isoDate().allow(null).optional(),
};

const optionalLatitude = Joi.number().min(-90).max(90).allow(null);
const optionalLongitude = Joi.number().min(-180).max(180).allow(null);

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const assetIdParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid asset id is required')),
});

const listQuery = Joi.object({
  search: Joi.string().allow('').max(200).optional(),
  page: Joi.number().integer().min(1).optional(),
});

const assetsDocs = {
  listAssets: {
    responses: createResponseDoc('listAssets', assetsResponses.listAssetsOk, {
      dataSchema: Joi.object({
        assets: Joi.array().items(assetSchema),
        total: Joi.number(),
        page: Joi.number(),
        pageSize: Joi.number(),
      }),
      401: true,
      500: { statusCode: 500, code: 'AST5001', message: 'Failed to list assets' },
    }),
    parameters: {
      headers: authHeaders,
      query: Joi.object({
        search: Joi.string().allow('').max(200).optional(),
        page: Joi.number().integer().min(1).optional(),
        siteId: Joi.string().uuid().optional(),
        status: Joi.string()
          .valid(...ASSET_STATUSES)
          .optional(),
        manufacturerId: Joi.string().uuid().optional(),
        vendorId: Joi.string().uuid().optional(),
        categoryId: Joi.string().uuid().optional(),
        eligibleParent: Joi.boolean().optional(),
        eligibleChild: Joi.boolean().optional(),
        excludeId: Joi.string().uuid().optional(),
      }),
      failAction: createValidationFailAction(assetsResponses.badRequest),
    },
  },
  listMapMarkers: {
    responses: createResponseDoc('listAssetMapMarkers', assetsResponses.listMapMarkersOk, {
      dataSchema: Joi.object({
        markers: Joi.array().items(
          Joi.object({
            id: Joi.string().uuid().required(),
            name: Joi.string().required(),
            siteName: Joi.string().allow(null).required(),
            effectiveLatitude: Joi.number().required(),
            effectiveLongitude: Joi.number().required(),
          }),
        ),
      }),
      401: true,
      500: { statusCode: 500, code: 'AST5001', message: 'Failed to list asset map markers' },
    }),
    parameters: {
      headers: authHeaders,
      failAction: createValidationFailAction(assetsResponses.badRequest),
    },
  },
  getAssetDetails: {
    responses: createResponseDoc('getAssetDetails', assetsResponses.getAssetOk, {
      dataSchema: Joi.object({ asset: assetSchema }),
      401: true,
      403: { statusCode: 403, code: 'AST4030', message: 'You do not have access to this asset' },
      404: { statusCode: 404, code: 'AST4040', message: 'Asset not found' },
      500: { statusCode: 500, code: 'AST5001', message: 'Failed to get asset details' },
    }),
    parameters: {
      headers: authHeaders,
      params: Joi.object({
        id: Joi.string().uuid().required().error(new Error('Valid asset id is required')),
      }),
      failAction: createValidationFailAction(assetsResponses.badRequest),
    },
  },
  createAsset: {
    responses: createResponseDoc('createAsset', assetsResponses.createAssetOk, {
      dataSchema: Joi.object({ asset: assetSchema }),
      400: assetsResponses.badRequest(400, 'Validation error'),
      401: true,
      409: { statusCode: 409, code: 'AST4090', message: 'Serial number already exists' },
      500: { statusCode: 500, code: 'AST5001', message: 'Failed to create asset' },
    }),
    parameters: {
      headers: authHeaders,
      payload: Joi.object({
        name: Joi.string().min(1).max(200).required().error(new Error('name is required. Max 200 chars')),
        model: Joi.string().allow('').max(200).optional(),
        serialNumber: Joi.string()
          .min(1)
          .max(200)
          .required()
          .error(new Error('serialNumber is required. Max 200 chars')),
        status: Joi.string()
          .valid(...ASSET_STATUSES)
          .optional()
          .error(new Error(`status must be one of: ${ASSET_STATUSES.join(', ')}`)),
        assignedUserId: Joi.string().uuid().allow(null).optional(),
        siteId: Joi.string().uuid().allow(null).optional(),
        latitude: optionalLatitude.optional().error(new Error('latitude must be between -90 and 90')),
        longitude: optionalLongitude.optional().error(new Error('longitude must be between -180 and 180')),
        note: Joi.string().allow('', null).max(2000).optional(),
        ...financialPayloadFields,
      }),
      failAction: createValidationFailAction(assetsResponses.badRequest),
    },
  },
  updateAsset: {
    responses: createResponseDoc('updateAsset', assetsResponses.updateAssetOk, {
      dataSchema: Joi.object({ asset: assetSchema }),
      400: assetsResponses.badRequest(400, 'Validation error'),
      401: true,
      404: { statusCode: 404, code: 'AST4040', message: 'Asset not found' },
      409: { statusCode: 409, code: 'AST4090', message: 'Serial number already exists' },
      500: { statusCode: 500, code: 'AST5001', message: 'Failed to update asset' },
    }),
    parameters: {
      headers: authHeaders,
      params: Joi.object({
        id: Joi.string().uuid().required().error(new Error('Valid asset id is required')),
      }),
      payload: Joi.object({
        name: Joi.string().min(1).max(200).optional(),
        model: Joi.string().allow('').max(200).optional(),
        serialNumber: Joi.string().min(1).max(200).optional(),
        status: Joi.string()
          .valid(...ASSET_STATUSES)
          .optional()
          .error(new Error(`status must be one of: ${ASSET_STATUSES.join(', ')}`)),
        assignedUserId: Joi.string().uuid().allow(null).optional(),
        siteId: Joi.string().uuid().allow(null).optional(),
        latitude: optionalLatitude.optional().error(new Error('latitude must be between -90 and 90')),
        longitude: optionalLongitude.optional().error(new Error('longitude must be between -180 and 180')),
        note: Joi.string().allow('', null).max(2000).optional(),
        ...financialPayloadFields,
      })
        .min(1)
        .error(new Error('At least one field to update is required')),
      failAction: createValidationFailAction(assetsResponses.badRequest),
    },
  },
  deleteAsset: {
    responses: createResponseDoc('deleteAsset', assetsResponses.deleteAssetOk, {
      401: true,
      404: { statusCode: 404, code: 'AST4040', message: 'Asset not found' },
      500: { statusCode: 500, code: 'AST5001', message: 'Failed to delete asset' },
    }),
    parameters: {
      headers: authHeaders,
      params: assetIdParams,
      failAction: createValidationFailAction(assetsResponses.badRequest),
    },
  },
  listAssetTransactions: {
    responses: createResponseDoc('listAssetTransactions', transactionsResponses.listOk, {
      401: true,
      404: { statusCode: 404, code: 'AST4040', message: 'Asset not found' },
      500: { statusCode: 500, code: 'TRX5001', message: 'Failed to list asset transactions' },
    }),
    parameters: {
      headers: authHeaders,
      params: assetIdParams,
      query: listQuery,
      failAction: createValidationFailAction(assetsResponses.badRequest),
    },
  },
};

export default assetsDocs;
