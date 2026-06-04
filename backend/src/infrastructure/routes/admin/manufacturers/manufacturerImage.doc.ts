import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import manufacturerImageResponses from './manufacturerImage.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const idParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid manufacturer id is required')),
});

const manufacturerImageDocs = {
  upload: {
    responses: createResponseDoc('uploadManufacturerImage', manufacturerImageResponses.uploadOk, {
      400: manufacturerImageResponses.badRequest(400, 'Uploaded file is not a valid image'),
      401: true,
      404: { statusCode: 404, code: 'MFR4040', message: 'Manufacturer not found' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(manufacturerImageResponses.badRequest),
    },
  },
  remove: {
    responses: createResponseDoc('removeManufacturerImage', manufacturerImageResponses.removeOk, {
      401: true,
      404: { statusCode: 404, code: 'MFR4040', message: 'Manufacturer not found' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(manufacturerImageResponses.badRequest),
    },
  },
  get: {
    responses: createResponseDoc('getManufacturerImage', manufacturerImageResponses.uploadOk, {
      401: true,
      404: manufacturerImageResponses.notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(manufacturerImageResponses.badRequest),
    },
  },
};

export default manufacturerImageDocs;
