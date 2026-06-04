import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import meHandoversResponses from './meHandovers.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const previewSchema = Joi.object({
  handoverId: Joi.string().uuid(),
  type: Joi.string().valid('CHECK_OUT', 'CHECK_IN'),
  expiresAt: Joi.string(),
  asset: Joi.object({
    id: Joi.string().uuid(),
    name: Joi.string(),
    serialNumber: Joi.string(),
  }),
  targetUser: Joi.object({
    id: Joi.string().uuid(),
    displayName: Joi.string().allow(null),
  }),
}).label('HandoverPreview');

const pendingHandoverSchema = Joi.object({
  id: Joi.string().uuid(),
  type: Joi.string().valid('CHECK_OUT', 'CHECK_IN'),
  expiresAt: Joi.string(),
  assetId: Joi.string().uuid(),
  assetName: Joi.string(),
  assetSerialNumber: Joi.string(),
}).label('PendingHandover');

const meHandoversDocs = {
  list: {
    responses: createResponseDoc('listMyPendingHandovers', meHandoversResponses.listOk, {
      dataSchema: Joi.object({ handovers: Joi.array().items(pendingHandoverSchema), total: Joi.number() }),
      401: true,
      500: { statusCode: 500, code: 'HND5001', message: 'Failed to list pending handovers' },
    }),
    parameters: {
      headers: authHeaders,
      failAction: createValidationFailAction(meHandoversResponses.badRequest),
    },
  },
  acceptById: {
    responses: createResponseDoc('acceptHandoverById', meHandoversResponses.acceptOk, {
      dataSchema: Joi.object({ asset: Joi.object().unknown() }),
      400: meHandoversResponses.badRequest(400, 'Invalid or expired handover'),
      401: true,
      404: { statusCode: 404, code: 'HND4040', message: 'Handover not found' },
      409: { statusCode: 409, code: 'HND4091', message: 'The asset assignee has changed' },
      500: { statusCode: 500, code: 'HND5001', message: 'Failed to accept handover' },
    }),
    parameters: {
      headers: authHeaders,
      params: Joi.object({
        handoverId: Joi.string().uuid().required().error(new Error('Valid handover id is required')),
      }),
      failAction: createValidationFailAction(meHandoversResponses.badRequest),
    },
  },
  preview: {
    responses: createResponseDoc('previewHandover', meHandoversResponses.previewOk, {
      dataSchema: previewSchema,
      400: meHandoversResponses.badRequest(400, 'Invalid or expired link'),
      401: true,
      403: { statusCode: 403, code: 'HND4030', message: 'This link is not valid' },
      500: { statusCode: 500, code: 'HND5001', message: 'Failed to preview handover' },
    }),
    parameters: {
      headers: authHeaders,
      query: Joi.object({
        token: Joi.string().required().error(new Error('A handover token is required')),
      }),
      failAction: createValidationFailAction(meHandoversResponses.badRequest),
    },
  },
  accept: {
    responses: createResponseDoc('acceptHandover', meHandoversResponses.acceptOk, {
      dataSchema: Joi.object({ asset: Joi.object().unknown(), handoverId: Joi.string().uuid() }),
      400: meHandoversResponses.badRequest(400, 'Invalid or expired link'),
      401: true,
      403: { statusCode: 403, code: 'HND4030', message: 'This link is not valid' },
      409: { statusCode: 409, code: 'HND4091', message: 'The asset assignee has changed' },
      500: { statusCode: 500, code: 'HND5001', message: 'Failed to accept handover' },
    }),
    parameters: {
      headers: authHeaders,
      payload: Joi.object({
        token: Joi.string().required().error(new Error('A handover token is required')),
      }),
      failAction: createValidationFailAction(meHandoversResponses.badRequest),
    },
  },
};

export default meHandoversDocs;
