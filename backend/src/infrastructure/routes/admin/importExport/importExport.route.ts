import config from '@config/config';
import type { ServerRoute } from '@hapi/hapi';
import { CapabilityEnum } from '@infrastructure/roles/capabilities';
import { importExportController } from './importExport.controller';
import importExportDocs from './importExport.doc';

const RUN = CapabilityEnum.IMPORT_EXPORT_RUN;

// Raw file upload: Hapi delivers the body as bytes (no multipart parsing).
const uploadPayload = {
  maxBytes: config.importExport.maxFileBytes,
  output: 'data' as const,
  parse: false,
};

export const adminCreateImportJobRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/import-jobs',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Upload a file and create an import job (admin only)',
    handler: importExportController.createImportJob,
    payload: uploadPayload,
    plugins: { 'hapi-swagger': { responses: importExportDocs.createImportJob.responses } },
    validate: importExportDocs.createImportJob.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminSetImportMappingRoute: ServerRoute = {
  method: 'PATCH',
  path: '/api/p/import-jobs/{id}/mapping',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Set column mapping + options for an import job',
    handler: importExportController.setMapping,
    plugins: { 'hapi-swagger': { responses: importExportDocs.setMapping.responses } },
    validate: importExportDocs.setMapping.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDryRunImportJobRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/import-jobs/{id}/dry-run',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Start a dry-run validation',
    handler: importExportController.dryRun,
    plugins: { 'hapi-swagger': { responses: importExportDocs.dryRun.responses } },
    validate: importExportDocs.dryRun.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCommitImportJobRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/import-jobs/{id}/commit',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Commit a dry-run-validated import job',
    handler: importExportController.commit,
    plugins: { 'hapi-swagger': { responses: importExportDocs.commit.responses } },
    validate: importExportDocs.commit.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCancelImportJobRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/import-jobs/{id}/cancel',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Cancel an import job before commit',
    handler: importExportController.cancel,
    plugins: { 'hapi-swagger': { responses: importExportDocs.cancel.responses } },
    validate: importExportDocs.cancel.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminListImportJobsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/import-jobs',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'List import jobs',
    handler: importExportController.listImportJobs,
    plugins: { 'hapi-swagger': { responses: importExportDocs.listImportJobs.responses } },
    validate: importExportDocs.listImportJobs.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetImportJobRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/import-jobs/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Get import job status + summaries',
    handler: importExportController.getImportJob,
    plugins: { 'hapi-swagger': { responses: importExportDocs.getImportJob.responses } },
    validate: importExportDocs.getImportJob.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminListImportJobRowsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/import-jobs/{id}/rows',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'List staging rows (paginated, severity filter)',
    handler: importExportController.listRows,
    plugins: { 'hapi-swagger': { responses: importExportDocs.listRows.responses } },
    validate: importExportDocs.listRows.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetImportJobErrorsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/import-jobs/{id}/errors',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Download the row-error report',
    handler: importExportController.getErrors,
    plugins: { 'hapi-swagger': { responses: importExportDocs.getErrors.responses } },
    validate: importExportDocs.getErrors.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCreateExportJobRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/export-jobs',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Create an export job',
    handler: importExportController.createExportJob,
    plugins: { 'hapi-swagger': { responses: importExportDocs.createExportJob.responses } },
    validate: importExportDocs.createExportJob.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminListExportJobsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/export-jobs',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'List export jobs',
    handler: importExportController.listExportJobs,
    plugins: { 'hapi-swagger': { responses: importExportDocs.listExportJobs.responses } },
    validate: importExportDocs.listExportJobs.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminListJobHistoryRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/import-export/history',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'List import and export jobs (merged, paginated)',
    handler: importExportController.listJobHistory,
    plugins: { 'hapi-swagger': { responses: importExportDocs.listJobHistory.responses } },
    validate: importExportDocs.listJobHistory.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetExportJobRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/export-jobs/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Get export job status',
    handler: importExportController.getExportJob,
    plugins: { 'hapi-swagger': { responses: importExportDocs.getExportJob.responses } },
    validate: importExportDocs.getExportJob.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDownloadExportJobRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/export-jobs/{id}/download',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Download the export artifact',
    handler: importExportController.downloadExport,
    plugins: { 'hapi-swagger': { responses: importExportDocs.downloadExport.responses } },
    validate: importExportDocs.downloadExport.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminListImportPresetsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/import-mapping-presets',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'List mapping presets for an entity type',
    handler: importExportController.listPresets,
    plugins: { 'hapi-swagger': { responses: importExportDocs.listPresets.responses } },
    validate: importExportDocs.listPresets.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCreateImportPresetRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/import-mapping-presets',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Create a mapping preset',
    handler: importExportController.createPreset,
    plugins: { 'hapi-swagger': { responses: importExportDocs.createPreset.responses } },
    validate: importExportDocs.createPreset.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteImportPresetRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/import-mapping-presets/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Delete a mapping preset',
    handler: importExportController.deletePreset,
    plugins: { 'hapi-swagger': { responses: importExportDocs.deletePreset.responses } },
    validate: importExportDocs.deletePreset.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetImportTemplateRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/import-templates/{entityType}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    app: { capability: RUN },
    description: 'Download an import template',
    handler: importExportController.getTemplate,
    plugins: { 'hapi-swagger': { responses: importExportDocs.getTemplate.responses } },
    validate: importExportDocs.getTemplate.parameters,
    tags: ['api', 'admin'],
  },
};
