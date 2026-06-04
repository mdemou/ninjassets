import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import custodyDocumentsResponses from './custodyDocuments.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const assetIdParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid asset id is required')),
});

const documentParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid asset id is required')),
  documentId: Joi.string().uuid().required().error(new Error('Valid document id is required')),
});

const typeValues = ['CHECK_OUT', 'CHECK_IN'];

const uploadQuery = Joi.object({
  type: Joi.string().valid(...typeValues).required(),
  handoverId: Joi.string().uuid().optional(),
  documentDate: Joi.string().isoDate().optional(),
  notes: Joi.string().max(2000).optional(),
  filename: Joi.string().max(255).optional(),
});

const generatePayload = Joi.object({
  type: Joi.string().valid(...typeValues).required(),
  targetUserId: Joi.string().uuid().optional().allow(null),
  handoverId: Joi.string().uuid().optional().allow(null),
  condition: Joi.string().max(255).optional().allow(null, ''),
  accessoriesNote: Joi.string().max(2000).optional().allow(null, ''),
});

const generateQuery = Joi.object({
  lang: Joi.string().valid('en', 'es').optional(),
});

const generateBatchPayload = Joi.object({
  type: Joi.string().valid(...typeValues).required(),
  assetIds: Joi.array().items(Joi.string().uuid()).min(1).max(200).required(),
  targetUserId: Joi.string().uuid().optional().allow(null),
  condition: Joi.string().max(255).optional().allow(null, ''),
  accessoriesNote: Joi.string().max(2000).optional().allow(null, ''),
});

const notFound = { statusCode: 404, code: 'CDOC4040', message: 'Asset not found' };

const custodyDocumentsDocs = {
  list: {
    responses: createResponseDoc('listCustodyDocuments', custodyDocumentsResponses.listOk, {
      401: true,
      404: notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: assetIdParams,
      failAction: createValidationFailAction(custodyDocumentsResponses.badRequest),
    },
  },
  get: {
    responses: createResponseDoc('getCustodyDocument', custodyDocumentsResponses.getOk, {
      401: true,
      404: notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: documentParams,
      failAction: createValidationFailAction(custodyDocumentsResponses.badRequest),
    },
  },
  getFile: {
    responses: createResponseDoc('getCustodyDocumentFile', custodyDocumentsResponses.getOk, {
      401: true,
      404: notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: documentParams,
      failAction: createValidationFailAction(custodyDocumentsResponses.badRequest),
    },
  },
  upload: {
    responses: createResponseDoc('uploadCustodyDocument', custodyDocumentsResponses.uploadOk, {
      400: custodyDocumentsResponses.badRequest(400, 'Uploaded file is not a valid PDF'),
      401: true,
      404: notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: assetIdParams,
      query: uploadQuery,
      failAction: createValidationFailAction(custodyDocumentsResponses.badRequest),
    },
  },
  remove: {
    responses: createResponseDoc('deleteCustodyDocument', custodyDocumentsResponses.deleteOk, {
      401: true,
      404: notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: documentParams,
      failAction: createValidationFailAction(custodyDocumentsResponses.badRequest),
    },
  },
  generate: {
    responses: createResponseDoc('generateCustodyDocument', custodyDocumentsResponses.getOk, {
      400: custodyDocumentsResponses.badRequest(400, 'Invalid custody document request'),
      401: true,
      404: notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: assetIdParams,
      query: generateQuery,
      payload: generatePayload,
      failAction: createValidationFailAction(custodyDocumentsResponses.badRequest),
    },
  },
  generateBatch: {
    responses: createResponseDoc('generateBatchCustodyDocument', custodyDocumentsResponses.getOk, {
      400: custodyDocumentsResponses.badRequest(400, 'Invalid custody document request'),
      401: true,
      404: notFound,
    }),
    parameters: {
      headers: authHeaders,
      query: generateQuery,
      payload: generateBatchPayload,
      failAction: createValidationFailAction(custodyDocumentsResponses.badRequest),
    },
  },
};

export default custodyDocumentsDocs;
