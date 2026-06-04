import { IDataQualityIssue } from '@domain/_interfaces/dataQuality.interface';
import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import alertsResponses from './alerts.responses';

const ISSUE_CODES = Object.values(IDataQualityIssue);

const alertRowSchema = Joi.object({
  issue: Joi.string()
    .valid(...ISSUE_CODES)
    .required(),
  severity: Joi.string().valid('high', 'medium', 'low').required(),
  assetId: Joi.string().uuid().required(),
  assetName: Joi.string().required(),
  serialNumber: Joi.string().required(),
  assignedUserId: Joi.string().uuid().allow(null).required(),
  assignedUserName: Joi.string().allow(null).required(),
  assignedUserEmail: Joi.string().allow(null).required(),
  assignedUserAvatarFilename: Joi.string().allow(null).required(),
  detail: Joi.string().allow(null).required(),
});

const alertsDocs = {
  list: {
    responses: createResponseDoc('listAlerts', alertsResponses.listOk, {
      dataSchema: Joi.object({
        alerts: Joi.array().items(alertRowSchema),
        total: Joi.number(),
      }),
      401: true,
      500: { statusCode: 500, code: 'ALT5001', message: 'Failed to retrieve alerts' },
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      query: Joi.object({
        limit: Joi.number().integer().min(1).max(50).optional(),
        issue: Joi.string()
          .valid(...ISSUE_CODES)
          .optional(),
        // Overview + bell pass true so admin-dismissed rows are hidden from these lists.
        excludeDismissed: Joi.boolean().optional(),
      }),
      failAction: createValidationFailAction(alertsResponses.badRequest),
    },
  },
};

export default alertsDocs;
