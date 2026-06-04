import {
  ICreateExportJob,
  IImportEntityType,
  IImportExportScope,
  IImportFileFormat,
  IImportMapping,
  IImportRowSeverity,
} from '@domain/_interfaces/importExport.interface';
import Boom from '@hapi/boom';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import importExportDomain from '@infrastructure/composition/importExport.composition';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';
import { canonicalFieldsFor } from '@domain/importExport/canonicalFields';
import importExportResponses from './importExport.responses';

function getRequester(request: Request): { id: string; role: string } {
  const credentials = request.auth.credentials as { id: string; role: string };
  return { id: credentials.id, role: credentials.role };
}

function pageOf(request: Request): number {
  const { page } = request.query as { page?: number };
  return Math.max(1, page ?? 1);
}

const CONTENT_TYPES: Record<IImportFileFormat, string> = {
  [IImportFileFormat.CSV]: 'text/csv',
  [IImportFileFormat.XLSX]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  [IImportFileFormat.JSON]: 'application/json',
};

export const importExportController = {
  async createImportJob(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { entityType, fileFormat, filename } = request.query as {
        entityType: IImportEntityType;
        fileFormat: IImportFileFormat;
        filename: string;
      };
      const payload = request.payload as Buffer | undefined;
      if (!payload || !Buffer.isBuffer(payload) || payload.length === 0) {
        throw Boom.badRequest('No file data received', { code: 'IEX4002' });
      }
      const { job, headers } = await importExportDomain.createImportJob(getRequester(request), {
        entityType,
        fileFormat,
        originalFilename: filename,
        buffer: payload,
      });
      response = responsesService.createResponseData(importExportResponses.importJobCreated, {
        job,
        headers,
        canonicalFields: canonicalFieldsFor(entityType),
      });
    } catch (error) {
      logger.error(__filename, 'createImportJob', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async setMapping(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const job = await importExportDomain.setMapping(id, request.payload as IImportMapping);
      response = responsesService.createResponseData(importExportResponses.mappingOk, { job });
    } catch (error) {
      logger.error(__filename, 'setMapping', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async dryRun(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const job = await importExportDomain.requestDryRun(id);
      response = responsesService.createResponseData(importExportResponses.dryRunStarted, { job });
    } catch (error) {
      logger.error(__filename, 'dryRun', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async commit(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const job = await importExportDomain.requestCommit(id);
      response = responsesService.createResponseData(importExportResponses.commitStarted, { job });
    } catch (error) {
      logger.error(__filename, 'commit', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async cancel(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const job = await importExportDomain.cancelImportJob(id);
      response = responsesService.createResponseData(importExportResponses.cancelled, { job });
    } catch (error) {
      logger.error(__filename, 'cancel', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async listImportJobs(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const result = await importExportDomain.listImportJobs(pageOf(request));
      response = responsesService.createResponseData(importExportResponses.importJobsOk, result);
    } catch (error) {
      logger.error(__filename, 'listImportJobs', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async getImportJob(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const job = await importExportDomain.getImportJob(id);
      response = responsesService.createResponseData(importExportResponses.importJobOk, { job });
    } catch (error) {
      logger.error(__filename, 'getImportJob', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async listRows(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const { severity } = request.query as { severity?: IImportRowSeverity };
      const result = await importExportDomain.listImportJobRows(id, { page: pageOf(request), severity });
      response = responsesService.createResponseData(importExportResponses.rowsOk, result);
    } catch (error) {
      logger.error(__filename, 'listRows', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async getErrors(request: Request, h: ResponseToolkit) {
    try {
      const { id } = request.params as { id: string };
      const { buffer, filename } = await importExportDomain.downloadErrorArtifact(id);
      return h
        .response(buffer)
        .type('text/csv')
        .header('Content-Disposition', `attachment; filename="${filename}"`);
    } catch (error) {
      logger.error(__filename, 'getErrors', 'error', error);
      const response = responsesService.createGeneralError(error);
      return h.response(response.body).code(response.statusCode);
    }
  },

  async createExportJob(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const body = request.payload as Omit<ICreateExportJob, 'createdByUserId'>;
      const job = await importExportDomain.createExportJob(getRequester(request), {
        ...body,
        scope: body.scope ?? IImportExportScope.FULL,
        filter: body.filter ?? null,
        createdByUserId: null,
      });
      response = responsesService.createResponseData(importExportResponses.exportJobCreated, { job });
    } catch (error) {
      logger.error(__filename, 'createExportJob', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async listExportJobs(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const result = await importExportDomain.listExportJobs(pageOf(request));
      response = responsesService.createResponseData(importExportResponses.exportJobsOk, result);
    } catch (error) {
      logger.error(__filename, 'listExportJobs', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async listJobHistory(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const result = await importExportDomain.listJobHistory(pageOf(request));
      response = responsesService.createResponseData(importExportResponses.jobHistoryOk, result);
    } catch (error) {
      logger.error(__filename, 'listJobHistory', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async getExportJob(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const job = await importExportDomain.getExportJob(id);
      response = responsesService.createResponseData(importExportResponses.exportJobOk, { job });
    } catch (error) {
      logger.error(__filename, 'getExportJob', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async downloadExport(request: Request, h: ResponseToolkit) {
    try {
      const { id } = request.params as { id: string };
      const { buffer, filename, format } = await importExportDomain.downloadExportArtifact(id);
      return h
        .response(buffer)
        .type(CONTENT_TYPES[format])
        .header('Content-Disposition', `attachment; filename="${filename}"`);
    } catch (error) {
      logger.error(__filename, 'downloadExport', 'error', error);
      const response = responsesService.createGeneralError(error);
      return h.response(response.body).code(response.statusCode);
    }
  },

  async listPresets(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { entityType } = request.query as { entityType: IImportEntityType };
      const presets = await importExportDomain.listPresets(entityType);
      response = responsesService.createResponseData(importExportResponses.presetsOk, { presets });
    } catch (error) {
      logger.error(__filename, 'listPresets', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async createPreset(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const body = request.payload as { name: string; entityType: IImportEntityType; mapping: IImportMapping };
      const preset = await importExportDomain.createPreset(getRequester(request), body);
      response = responsesService.createResponseData(importExportResponses.presetCreated, { preset });
    } catch (error) {
      logger.error(__filename, 'createPreset', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async deletePreset(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await importExportDomain.deletePreset(id);
      response = responsesService.createResponseData(importExportResponses.presetDeleted);
    } catch (error) {
      logger.error(__filename, 'deletePreset', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async getTemplate(request: Request, h: ResponseToolkit) {
    try {
      const { entityType } = request.params as { entityType: IImportEntityType };
      const { format } = request.query as { format?: IImportFileFormat };
      const fmt = format ?? IImportFileFormat.CSV;
      const { buffer, filename } = await importExportDomain.buildTemplate(entityType, fmt);
      return h
        .response(buffer)
        .type(CONTENT_TYPES[fmt])
        .header('Content-Disposition', `attachment; filename="${filename}"`);
    } catch (error) {
      logger.error(__filename, 'getTemplate', 'error', error);
      const response = responsesService.createGeneralError(error);
      return h.response(response.body).code(response.statusCode);
    }
  },
};
