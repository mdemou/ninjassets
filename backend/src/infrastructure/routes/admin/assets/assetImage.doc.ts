import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import assetImageResponses from './assetImage.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const assetIdParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid asset id is required')),
});

const assetImageDocs = {
  upload: {
    responses: createResponseDoc('uploadAssetImage', assetImageResponses.uploadOk, {
      400: assetImageResponses.badRequest(400, 'Uploaded file is not a valid image'),
      401: true,
      404: { statusCode: 404, code: 'AST4040', message: 'Asset not found' },
    }),
    parameters: {
      headers: authHeaders,
      params: assetIdParams,
      failAction: createValidationFailAction(assetImageResponses.badRequest),
    },
  },
  remove: {
    responses: createResponseDoc('removeAssetImage', assetImageResponses.removeOk, {
      401: true,
      404: { statusCode: 404, code: 'AST4040', message: 'Asset not found' },
    }),
    parameters: {
      headers: authHeaders,
      params: assetIdParams,
      failAction: createValidationFailAction(assetImageResponses.badRequest),
    },
  },
  get: {
    responses: createResponseDoc('getAssetImage', assetImageResponses.uploadOk, {
      401: true,
      404: assetImageResponses.notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: assetIdParams,
      failAction: createValidationFailAction(assetImageResponses.badRequest),
    },
  },
};

export default assetImageDocs;
