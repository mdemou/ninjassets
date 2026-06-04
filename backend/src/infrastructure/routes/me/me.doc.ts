import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import meResponses from './me.responses';

const parameters = {
  headers: Joi.object({
    authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
  }).unknown(),
  query: Joi.object({
    search: Joi.string().allow('').max(200).optional(),
    page: Joi.number().integer().min(1).optional(),
  }),
  failAction: createValidationFailAction(meResponses.badRequest),
};

const meDocs = {
  assets: {
    responses: createResponseDoc('myAssets', meResponses.assetsOk, {
      401: true,
      500: { statusCode: 500, code: 'AST5001', message: 'Failed to list your assets' },
    }),
    parameters,
  },
  transactions: {
    responses: createResponseDoc('myTransactions', meResponses.transactionsOk, {
      401: true,
      500: { statusCode: 500, code: 'TRX5001', message: 'Failed to list your history' },
    }),
    parameters,
  },
};

export default meDocs;
