import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import statsResponses from './stats.responses';

const overviewSchema = Joi.object({
  totals: Joi.object({
    assets: Joi.number(),
    sites: Joi.number(),
    users: Joi.number(),
    assignedAssets: Joi.number(),
  }),
  assetsByStatus: Joi.array().items(Joi.object({ status: Joi.string(), count: Joi.number() })),
  assetsBySite: Joi.array().items(
    Joi.object({
      siteId: Joi.string().uuid().allow(null),
      siteName: Joi.string().allow(null),
      count: Joi.number(),
    }),
  ),
  attention: Joi.object({
    inactiveUserAssignedCount: Joi.number().required(),
    assignedWithoutUserCount: Joi.number().required(),
    warrantyExpiredCount: Joi.number().required(),
    warrantyExpiring30DaysCount: Joi.number().required(),
    returnOverdueCount: Joi.number().required(),
    returnDueSoon7DaysCount: Joi.number().required(),
  }).required(),
}).label('StatsOverview');

const statsDocs = {
  overview: {
    responses: createResponseDoc('statsOverview', statsResponses.overviewOk, {
      dataSchema: overviewSchema,
      401: true,
      500: { statusCode: 500, code: 'STA5001', message: 'Failed to retrieve stats' },
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      failAction: createValidationFailAction(statsResponses.badRequest),
    },
  },
};

export default statsDocs;
