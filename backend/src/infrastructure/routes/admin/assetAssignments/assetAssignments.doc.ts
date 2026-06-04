import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import assetAssignmentsResponses from './assetAssignments.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const bulkPayload = Joi.object({
  type: Joi.string().valid('CHECK_OUT', 'CHECK_IN').required(),
  mode: Joi.string().valid('direct', 'verify').required(),
  targetUserId: Joi.string().uuid().required(),
  assetIds: Joi.array().items(Joi.string().uuid()).min(1).max(200).required(),
});

const assetAssignmentsDocs = {
  bulkAssign: {
    responses: createResponseDoc('bulkAssign', assetAssignmentsResponses.bulkOk, {
      400: assetAssignmentsResponses.badRequest(400, 'Invalid bulk assignment request'),
      401: true,
    }),
    parameters: {
      headers: authHeaders,
      payload: bulkPayload,
      failAction: createValidationFailAction(assetAssignmentsResponses.badRequest),
    },
  },
};

export default assetAssignmentsDocs;
