import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import assetQrResponses from './assetQr.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const assetIdParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid asset id is required')),
});

const assetQrDocs = {
  get: {
    responses: createResponseDoc('getAssetQr', assetQrResponses.badRequest(200, 'OK'), {
      401: true,
      404: assetQrResponses.notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: assetIdParams,
      failAction: createValidationFailAction(assetQrResponses.badRequest),
    },
  },
};

export default assetQrDocs;
