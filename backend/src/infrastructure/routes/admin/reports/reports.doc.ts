import { IDataQualityIssue } from '@domain/_interfaces/dataQuality.interface';
import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import reportsResponses from './reports.responses';

const ISSUE_CODES = Object.values(IDataQualityIssue);

const rowSchema = Joi.object({
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

const reportsDocs = {
  dataQuality: {
    responses: createResponseDoc('dataQualityReport', reportsResponses.listOk, {
      dataSchema: Joi.object({
        rows: Joi.array().items(rowSchema),
        total: Joi.number(),
        page: Joi.number(),
        pageSize: Joi.number().allow(null),
      }),
      401: true,
      500: { statusCode: 500, code: 'RPT5001', message: 'Failed to retrieve data quality report' },
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      query: Joi.object({
        search: Joi.string().allow('').max(200).optional(),
        page: Joi.number().integer().min(1).optional(),
        issue: Joi.string()
          .valid(...ISSUE_CODES)
          .optional(),
      }),
      failAction: createValidationFailAction(reportsResponses.badRequest),
    },
  },

  dismiss: {
    responses: createResponseDoc('dismissDataQuality', reportsResponses.dismissOk, {
      dataSchema: Joi.object({}),
      400: reportsResponses.badRequest(400, 'Invalid dismiss request'),
      401: true,
      409: { statusCode: 409, code: 'RPT4090', message: 'Issue no longer present for the asset' },
      500: { statusCode: 500, code: 'RPT5002', message: 'Failed to dismiss data quality issue' },
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      payload: Joi.object({
        assetId: Joi.string().uuid().required(),
        issue: Joi.string()
          .valid(...ISSUE_CODES)
          .required(),
      }),
      failAction: createValidationFailAction(reportsResponses.badRequest),
    },
  },

  restore: {
    responses: createResponseDoc('restoreDataQuality', reportsResponses.restoreOk, {
      dataSchema: Joi.object({}),
      400: reportsResponses.badRequest(400, 'Invalid restore request'),
      401: true,
      500: { statusCode: 500, code: 'RPT5003', message: 'Failed to restore data quality issue' },
    }),
    parameters: {
      headers: Joi.object({
        authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
      }).unknown(),
      payload: Joi.object({
        assetId: Joi.string().uuid().required(),
        issue: Joi.string()
          .valid(...ISSUE_CODES)
          .required(),
      }),
      failAction: createValidationFailAction(reportsResponses.badRequest),
    },
  },
};

export default reportsDocs;
