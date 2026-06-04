import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import vendorImageResponses from './vendorImage.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const idParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid vendor id is required')),
});

const vendorImageDocs = {
  upload: {
    responses: createResponseDoc('uploadVendorImage', vendorImageResponses.uploadOk, {
      400: vendorImageResponses.badRequest(400, 'Uploaded file is not a valid image'),
      401: true,
      404: { statusCode: 404, code: 'VND4040', message: 'Vendor not found' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(vendorImageResponses.badRequest),
    },
  },
  remove: {
    responses: createResponseDoc('removeVendorImage', vendorImageResponses.removeOk, {
      401: true,
      404: { statusCode: 404, code: 'VND4040', message: 'Vendor not found' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(vendorImageResponses.badRequest),
    },
  },
  get: {
    responses: createResponseDoc('getVendorImage', vendorImageResponses.uploadOk, {
      401: true,
      404: vendorImageResponses.notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(vendorImageResponses.badRequest),
    },
  },
};

export default vendorImageDocs;
