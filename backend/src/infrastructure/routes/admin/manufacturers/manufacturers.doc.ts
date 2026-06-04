import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import manufacturersResponses from './manufacturers.responses';

const manufacturerSchema = Joi.object({
  id: Joi.string().uuid().required(),
  dateCreated: Joi.string().required(),
  dateUpdated: Joi.string().required(),
  name: Joi.string().required(),
  imageFilename: Joi.string().allow(null).required(),
  assetCount: Joi.number().required(),
}).label('Manufacturer');

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const idParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid manufacturer id is required')),
});

const manufacturersDocs = {
  listManufacturers: {
    responses: createResponseDoc('listManufacturers', manufacturersResponses.listOk, {
      dataSchema: Joi.object({
        manufacturers: Joi.array().items(manufacturerSchema),
        total: Joi.number(),
        page: Joi.number(),
        pageSize: Joi.number().allow(null),
      }),
      401: true,
      500: { statusCode: 500, code: 'MFR5001', message: 'Failed to list manufacturers' },
    }),
    parameters: {
      headers: authHeaders,
      query: Joi.object({
        search: Joi.string().allow('').max(200).optional(),
        page: Joi.number().integer().min(1).optional(),
      }),
      failAction: createValidationFailAction(manufacturersResponses.badRequest),
    },
  },
  getManufacturerDetails: {
    responses: createResponseDoc('getManufacturerDetails', manufacturersResponses.getOk, {
      dataSchema: Joi.object({ manufacturer: manufacturerSchema }),
      401: true,
      404: { statusCode: 404, code: 'MFR4040', message: 'Manufacturer not found' },
      500: { statusCode: 500, code: 'MFR5001', message: 'Failed to get manufacturer details' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(manufacturersResponses.badRequest),
    },
  },
  createManufacturer: {
    responses: createResponseDoc('createManufacturer', manufacturersResponses.createOk, {
      dataSchema: Joi.object({
        manufacturer: manufacturerSchema.keys({ assetCount: Joi.number().optional() }),
      }),
      400: manufacturersResponses.badRequest(400, 'Validation error'),
      401: true,
      409: { statusCode: 409, code: 'MFR4090', message: 'A manufacturer with this name already exists' },
      500: { statusCode: 500, code: 'MFR5001', message: 'Failed to create manufacturer' },
    }),
    parameters: {
      headers: authHeaders,
      payload: Joi.object({
        name: Joi.string().min(1).max(200).required().error(new Error('name is required. Max 200 chars')),
      }),
      failAction: createValidationFailAction(manufacturersResponses.badRequest),
    },
  },
  updateManufacturer: {
    responses: createResponseDoc('updateManufacturer', manufacturersResponses.updateOk, {
      dataSchema: Joi.object({ manufacturer: manufacturerSchema }),
      400: manufacturersResponses.badRequest(400, 'Validation error'),
      401: true,
      404: { statusCode: 404, code: 'MFR4040', message: 'Manufacturer not found' },
      409: { statusCode: 409, code: 'MFR4090', message: 'A manufacturer with this name already exists' },
      500: { statusCode: 500, code: 'MFR5001', message: 'Failed to update manufacturer' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      payload: Joi.object({
        name: Joi.string().min(1).max(200).optional(),
      })
        .min(1)
        .error(new Error('At least one field to update is required')),
      failAction: createValidationFailAction(manufacturersResponses.badRequest),
    },
  },
  deleteManufacturer: {
    responses: createResponseDoc('deleteManufacturer', manufacturersResponses.deleteOk, {
      401: true,
      404: { statusCode: 404, code: 'MFR4040', message: 'Manufacturer not found' },
      409: { statusCode: 409, code: 'MFR4091', message: 'Manufacturer is in use' },
      500: { statusCode: 500, code: 'MFR5001', message: 'Failed to delete manufacturer' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(manufacturersResponses.badRequest),
    },
  },
};

export default manufacturersDocs;
