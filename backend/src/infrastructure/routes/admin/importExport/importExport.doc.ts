import {
  IImportEntityType,
  IImportExportScope,
  IImportFileFormat,
  IImportRowSeverity,
  IPartialMode,
} from '@domain/_interfaces/importExport.interface';
import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import importExportResponses from './importExport.responses';

const ENTITY_TYPES = Object.values(IImportEntityType);
const FILE_FORMATS = Object.values(IImportFileFormat);
const SCOPES = Object.values(IImportExportScope);
const SEVERITIES = Object.values(IImportRowSeverity);
const PARTIAL_MODES = Object.values(IPartialMode);

const failAction = createValidationFailAction(importExportResponses.badRequest);

const mappingSchema = Joi.object({
  columns: Joi.object().pattern(Joi.string(), Joi.string().allow('')).required(),
  options: Joi.object({
    partialMode: Joi.string().valid(...PARTIAL_MODES).optional(),
    force: Joi.boolean().optional(),
    createMissingSites: Joi.boolean().optional(),
    createMissingCatalog: Joi.boolean().optional(),
    allowAdminPromotion: Joi.boolean().optional(),
  }).optional(),
});

const filterSchema = Joi.object({
  search: Joi.string().allow('').optional(),
  siteId: Joi.string().optional(),
  status: Joi.string().optional(),
  manufacturerId: Joi.string().optional(),
  vendorId: Joi.string().optional(),
  categoryId: Joi.string().optional(),
  role: Joi.string().optional(),
  userStatus: Joi.string().optional(),
})
  .allow(null)
  .optional();

const idParam = Joi.object({ id: Joi.string().uuid().required() });

const importExportDocs = {
  createImportJob: {
    responses: createResponseDoc('createImportJob', importExportResponses.importJobCreated, { 400: importExportResponses.badRequest(400, 'Invalid upload'), 401: true }),
    parameters: {
      query: Joi.object({
        entityType: Joi.string().valid(...ENTITY_TYPES).required(),
        fileFormat: Joi.string().valid(...FILE_FORMATS).required(),
        filename: Joi.string().required(),
      }),
      failAction,
    },
  },
  setMapping: {
    responses: createResponseDoc('setMapping', importExportResponses.mappingOk, { 400: importExportResponses.badRequest(400, 'Invalid mapping'), 401: true }),
    parameters: { params: idParam, payload: mappingSchema, failAction },
  },
  dryRun: {
    responses: createResponseDoc('dryRun', importExportResponses.dryRunStarted, { 401: true }),
    parameters: { params: idParam, failAction },
  },
  commit: {
    responses: createResponseDoc('commit', importExportResponses.commitStarted, { 401: true }),
    parameters: { params: idParam, failAction },
  },
  cancel: {
    responses: createResponseDoc('cancel', importExportResponses.cancelled, { 401: true }),
    parameters: { params: idParam, failAction },
  },
  listImportJobs: {
    responses: createResponseDoc('listImportJobs', importExportResponses.importJobsOk, {
      dataSchema: Joi.object({
        jobs: Joi.array().items(Joi.object().unknown(true)),
        total: Joi.number(),
        page: Joi.number(),
        pageSize: Joi.number(),
      }),
      401: true,
    }),
    parameters: { query: Joi.object({ page: Joi.number().integer().min(1).optional() }), failAction },
  },
  listJobHistory: {
    responses: createResponseDoc('listJobHistory', importExportResponses.jobHistoryOk, {
      dataSchema: Joi.object({
        items: Joi.array().items(
          Joi.object({
            kind: Joi.string().valid('import', 'export').required(),
            id: Joi.string().uuid().required(),
            entityType: Joi.string().valid(...ENTITY_TYPES).required(),
            status: Joi.string().required(),
            fileFormat: Joi.string().valid(...FILE_FORMATS).required(),
            createdAt: Joi.string().required(),
            errorArtifactPath: Joi.string().allow(null).required(),
            artifactPath: Joi.string().allow(null).required(),
          }),
        ),
        total: Joi.number(),
        page: Joi.number(),
        pageSize: Joi.number(),
      }),
      401: true,
    }),
    parameters: { query: Joi.object({ page: Joi.number().integer().min(1).optional() }), failAction },
  },
  getImportJob: {
    responses: createResponseDoc('getImportJob', importExportResponses.importJobOk, { 401: true }),
    parameters: { params: idParam, failAction },
  },
  listRows: {
    responses: createResponseDoc('listRows', importExportResponses.rowsOk, { 401: true }),
    parameters: {
      params: idParam,
      query: Joi.object({
        page: Joi.number().integer().min(1).optional(),
        severity: Joi.string().valid(...SEVERITIES).optional(),
      }),
      failAction,
    },
  },
  getErrors: {
    responses: createResponseDoc('getErrors', importExportResponses.importJobOk, { 401: true }),
    parameters: { params: idParam, failAction },
  },
  createExportJob: {
    responses: createResponseDoc('createExportJob', importExportResponses.exportJobCreated, { 400: importExportResponses.badRequest(400, 'Invalid request'), 401: true }),
    parameters: {
      payload: Joi.object({
        entityType: Joi.string().valid(...ENTITY_TYPES).required(),
        fileFormat: Joi.string().valid(...FILE_FORMATS).required(),
        scope: Joi.string().valid(...SCOPES).required(),
        filter: filterSchema,
      }),
      failAction,
    },
  },
  listExportJobs: {
    responses: createResponseDoc('listExportJobs', importExportResponses.exportJobsOk, {
      dataSchema: Joi.object({
        jobs: Joi.array().items(Joi.object().unknown(true)),
        total: Joi.number(),
        page: Joi.number(),
        pageSize: Joi.number(),
      }),
      401: true,
    }),
    parameters: { query: Joi.object({ page: Joi.number().integer().min(1).optional() }), failAction },
  },
  getExportJob: {
    responses: createResponseDoc('getExportJob', importExportResponses.exportJobOk, { 401: true }),
    parameters: { params: idParam, failAction },
  },
  downloadExport: {
    responses: createResponseDoc('downloadExport', importExportResponses.exportJobOk, { 401: true }),
    parameters: { params: idParam, failAction },
  },
  listPresets: {
    responses: createResponseDoc('listPresets', importExportResponses.presetsOk, { 401: true }),
    parameters: { query: Joi.object({ entityType: Joi.string().valid(...ENTITY_TYPES).required() }), failAction },
  },
  createPreset: {
    responses: createResponseDoc('createPreset', importExportResponses.presetCreated, { 400: importExportResponses.badRequest(400, 'Invalid preset'), 401: true }),
    parameters: {
      payload: Joi.object({
        name: Joi.string().required(),
        entityType: Joi.string().valid(...ENTITY_TYPES).required(),
        mapping: mappingSchema.required(),
      }),
      failAction,
    },
  },
  deletePreset: {
    responses: createResponseDoc('deletePreset', importExportResponses.presetDeleted, { 401: true }),
    parameters: { params: idParam, failAction },
  },
  getTemplate: {
    responses: createResponseDoc('getTemplate', importExportResponses.importJobOk, { 401: true }),
    parameters: {
      params: Joi.object({ entityType: Joi.string().valid(...ENTITY_TYPES).required() }),
      // Accept csv/xlsx/json in any case; coerce to the canonical uppercase enum.
      query: Joi.object({ format: Joi.string().uppercase().valid(...FILE_FORMATS).optional() }),
      failAction,
    },
  },
};

export default importExportDocs;
