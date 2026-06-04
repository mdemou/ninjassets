import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import vendorsResponses from './vendors.responses';

const vendorSchema = Joi.object({
  id: Joi.string().uuid().required(),
  dateCreated: Joi.string().required(),
  dateUpdated: Joi.string().required(),
  name: Joi.string().required(),
  imageFilename: Joi.string().allow(null).required(),
  assetCount: Joi.number().required(),
}).label('Vendor');

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const idParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid vendor id is required')),
});

const vendorsDocs = {
  listVendors: {
    responses: createResponseDoc('listVendors', vendorsResponses.listOk, {
      dataSchema: Joi.object({
        vendors: Joi.array().items(vendorSchema),
        total: Joi.number(),
        page: Joi.number(),
        pageSize: Joi.number().allow(null),
      }),
      401: true,
      500: { statusCode: 500, code: 'VND5001', message: 'Failed to list vendors' },
    }),
    parameters: {
      headers: authHeaders,
      query: Joi.object({
        search: Joi.string().allow('').max(200).optional(),
        page: Joi.number().integer().min(1).optional(),
      }),
      failAction: createValidationFailAction(vendorsResponses.badRequest),
    },
  },
  getVendorDetails: {
    responses: createResponseDoc('getVendorDetails', vendorsResponses.getOk, {
      dataSchema: Joi.object({ vendor: vendorSchema }),
      401: true,
      404: { statusCode: 404, code: 'VND4040', message: 'Vendor not found' },
      500: { statusCode: 500, code: 'VND5001', message: 'Failed to get vendor details' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(vendorsResponses.badRequest),
    },
  },
  createVendor: {
    responses: createResponseDoc('createVendor', vendorsResponses.createOk, {
      dataSchema: Joi.object({
        vendor: vendorSchema.keys({ assetCount: Joi.number().optional() }),
      }),
      400: vendorsResponses.badRequest(400, 'Validation error'),
      401: true,
      409: { statusCode: 409, code: 'VND4090', message: 'A vendor with this name already exists' },
      500: { statusCode: 500, code: 'VND5001', message: 'Failed to create vendor' },
    }),
    parameters: {
      headers: authHeaders,
      payload: Joi.object({
        name: Joi.string().min(1).max(200).required().error(new Error('name is required. Max 200 chars')),
      }),
      failAction: createValidationFailAction(vendorsResponses.badRequest),
    },
  },
  updateVendor: {
    responses: createResponseDoc('updateVendor', vendorsResponses.updateOk, {
      dataSchema: Joi.object({ vendor: vendorSchema }),
      400: vendorsResponses.badRequest(400, 'Validation error'),
      401: true,
      404: { statusCode: 404, code: 'VND4040', message: 'Vendor not found' },
      409: { statusCode: 409, code: 'VND4090', message: 'A vendor with this name already exists' },
      500: { statusCode: 500, code: 'VND5001', message: 'Failed to update vendor' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      payload: Joi.object({
        name: Joi.string().min(1).max(200).optional(),
      })
        .min(1)
        .error(new Error('At least one field to update is required')),
      failAction: createValidationFailAction(vendorsResponses.badRequest),
    },
  },
  deleteVendor: {
    responses: createResponseDoc('deleteVendor', vendorsResponses.deleteOk, {
      401: true,
      404: { statusCode: 404, code: 'VND4040', message: 'Vendor not found' },
      409: { statusCode: 409, code: 'VND4091', message: 'Vendor is in use' },
      500: { statusCode: 500, code: 'VND5001', message: 'Failed to delete vendor' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(vendorsResponses.badRequest),
    },
  },
};

export default vendorsDocs;
