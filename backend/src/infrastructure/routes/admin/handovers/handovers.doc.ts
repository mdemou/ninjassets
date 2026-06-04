import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import handoversResponses from './handovers.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const assetIdParams = Joi.object({
  assetId: Joi.string().uuid().required().error(new Error('Valid asset id is required')),
});

const handoverIdParams = Joi.object({
  handoverId: Joi.string().uuid().required().error(new Error('Valid handover id is required')),
});

const handoverSchema = Joi.object({
  id: Joi.string().uuid(),
  dateCreated: Joi.string(),
  assetId: Joi.string().uuid(),
  type: Joi.string().valid('CHECK_OUT', 'CHECK_IN'),
  status: Joi.string().valid('OPEN', 'CONSUMED', 'CANCELLED', 'EXPIRED'),
  targetUserId: Joi.string().uuid(),
  createdByUserId: Joi.string().uuid().allow(null),
  expiresAt: Joi.string(),
  consumedAt: Joi.string().allow(null),
  consumedByUserId: Joi.string().uuid().allow(null),
  cancelledAt: Joi.string().allow(null),
  cancelledByUserId: Joi.string().uuid().allow(null),
  assetName: Joi.string(),
  assetSerialNumber: Joi.string(),
  assetImageFilename: Joi.string().allow(null),
  targetUserName: Joi.string().allow(null),
  targetUserEmail: Joi.string().allow(null),
  targetUserAvatarFilename: Joi.string().allow(null),
}).label('Handover');

const handoversDocs = {
  listOpen: {
    responses: createResponseDoc('listOpenHandovers', handoversResponses.listOpenOk, {
      dataSchema: Joi.object({ handovers: Joi.array().items(handoverSchema), total: Joi.number() }),
      401: true,
      500: { statusCode: 500, code: 'HND5001', message: 'Failed to list open handovers' },
    }),
    parameters: {
      headers: authHeaders,
      failAction: createValidationFailAction(handoversResponses.badRequest),
    },
  },
  create: {
    responses: createResponseDoc('createHandover', handoversResponses.createOk, {
      dataSchema: Joi.object({ handover: handoverSchema, acceptUrl: Joi.string().allow(null) }),
      400: handoversResponses.badRequest(400, 'Invalid handover request'),
      401: true,
      404: { statusCode: 404, code: 'HND4040', message: 'Asset not found' },
      409: { statusCode: 409, code: 'HND4090', message: 'An open handover already exists for this asset' },
      500: { statusCode: 500, code: 'HND5001', message: 'Failed to create handover' },
    }),
    parameters: {
      headers: authHeaders,
      params: assetIdParams,
      payload: Joi.object({
        type: Joi.string().valid('CHECK_OUT', 'CHECK_IN').required(),
        targetUserId: Joi.string().uuid().required(),
        sendEmail: Joi.boolean().optional(),
      }),
      failAction: createValidationFailAction(handoversResponses.badRequest),
    },
  },
  list: {
    responses: createResponseDoc('listHandovers', handoversResponses.listOk, {
      dataSchema: Joi.object({ handovers: Joi.array().items(handoverSchema), total: Joi.number() }),
      401: true,
      404: { statusCode: 404, code: 'HND4040', message: 'Asset not found' },
      500: { statusCode: 500, code: 'HND5001', message: 'Failed to list handovers' },
    }),
    parameters: {
      headers: authHeaders,
      params: assetIdParams,
      failAction: createValidationFailAction(handoversResponses.badRequest),
    },
  },
  get: {
    responses: createResponseDoc('getHandover', handoversResponses.getOk, {
      dataSchema: Joi.object({ handover: handoverSchema }),
      401: true,
      404: { statusCode: 404, code: 'HND4041', message: 'Handover not found' },
      500: { statusCode: 500, code: 'HND5001', message: 'Failed to get handover' },
    }),
    parameters: {
      headers: authHeaders,
      params: handoverIdParams,
      failAction: createValidationFailAction(handoversResponses.badRequest),
    },
  },
  cancel: {
    responses: createResponseDoc('cancelHandover', handoversResponses.cancelOk, {
      dataSchema: Joi.object({ handover: handoverSchema }),
      400: handoversResponses.badRequest(400, 'Handover is not open'),
      401: true,
      404: { statusCode: 404, code: 'HND4041', message: 'Handover not found' },
      500: { statusCode: 500, code: 'HND5001', message: 'Failed to cancel handover' },
    }),
    parameters: {
      headers: authHeaders,
      params: handoverIdParams,
      failAction: createValidationFailAction(handoversResponses.badRequest),
    },
  },
  complete: {
    responses: createResponseDoc('completeHandover', handoversResponses.completeOk, {
      dataSchema: Joi.object({ asset: Joi.object().unknown() }),
      400: handoversResponses.badRequest(400, 'Handover cannot be completed'),
      401: true,
      404: { statusCode: 404, code: 'HND4041', message: 'Handover not found' },
      409: { statusCode: 409, code: 'HND4091', message: 'The asset assignee has changed' },
      500: { statusCode: 500, code: 'HND5001', message: 'Failed to complete handover' },
    }),
    parameters: {
      headers: authHeaders,
      params: handoverIdParams,
      failAction: createValidationFailAction(handoversResponses.badRequest),
    },
  },
};

export default handoversDocs;
