import { ITransactionAction } from '@domain/_interfaces/transaction.interface';
import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import transactionsResponses from './transactions.responses';

const transactionSchema = Joi.object({
  id: Joi.string().uuid().required(),
  dateCreated: Joi.string().required(),
  action: Joi.string()
    .valid(...Object.values(ITransactionAction))
    .required(),
  assetId: Joi.string().uuid().allow(null).required(),
  assetName: Joi.string().required(),
  assetImageFilename: Joi.string().allow(null).required(),
  actorUserId: Joi.string().uuid().allow(null).required(),
  actorName: Joi.string().allow(null).required(),
  actorAvatarFilename: Joi.string().allow(null).required(),
  targetUserId: Joi.string().uuid().allow(null).required(),
  targetName: Joi.string().allow(null).required(),
  targetAvatarFilename: Joi.string().allow(null).required(),
  detail: Joi.string().allow(null).required(),
}).label('Transaction');

const transactionsDocs = {
  list: {
    responses: createResponseDoc('listTransactions', transactionsResponses.listOk, {
      dataSchema: Joi.object({
        transactions: Joi.array().items(transactionSchema),
        total: Joi.number(),
        page: Joi.number(),
        pageSize: Joi.number(),
      }),
      401: true,
      500: { statusCode: 500, code: 'TRX5001', message: 'Failed to list transactions' },
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      query: Joi.object({
        search: Joi.string().allow('').max(200).optional(),
        page: Joi.number().integer().min(1).optional(),
      }),
      failAction: createValidationFailAction(transactionsResponses.badRequest),
    },
  },
};

export default transactionsDocs;
