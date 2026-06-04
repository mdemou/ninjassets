import {
  ICreateExportJob,
  IExportFilter,
  IExportJob,
  IExportJobStatus,
  IImportEntityType,
  IImportExportScope,
  IImportFileFormat,
  IUpdateExportJob,
} from '@domain/_interfaces/importExport.interface';
import { ExportJobRepository } from '@domain/_repositories/exportJob.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';

interface IExportJobDB {
  id: string;
  created_by_user_id: string | null;
  entity_type: string;
  status: string;
  file_format: string;
  scope: string;
  filter_json: IExportFilter | null;
  artifact_path: string | null;
  row_count: number | null;
  created_at: string;
  finished_at: string | null;
}

function adapt(row: IExportJobDB): IExportJob {
  return {
    id: row.id,
    createdByUserId: row.created_by_user_id,
    entityType: row.entity_type as IImportEntityType,
    status: row.status as IExportJobStatus,
    fileFormat: row.file_format as IImportFileFormat,
    scope: row.scope as IImportExportScope,
    filter: row.filter_json,
    artifactPath: row.artifact_path,
    rowCount: row.row_count,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

function fail(error: unknown, method: string): never {
  logger.error(__filename, method, 'error', error);
  throw Boom.badImplementation('Export job repository error', { code: 'IEX5002' });
}

const exportJobDbRepository: ExportJobRepository = {
  async create(data: ICreateExportJob): Promise<IExportJob> {
    try {
      const [row]: IExportJobDB[] = await sqlService
        .myDb('export_job')
        .insert({
          created_by_user_id: data.createdByUserId,
          entity_type: data.entityType,
          status: IExportJobStatus.QUEUED,
          file_format: data.fileFormat,
          scope: data.scope,
          filter_json: data.filter ? JSON.stringify(data.filter) : null,
        })
        .returning('*');
      return adapt(row);
    } catch (error) {
      fail(error, 'create');
    }
  },

  async findById(id: string): Promise<IExportJob | null> {
    try {
      const row: IExportJobDB | undefined = await sqlService.myDb('export_job').where({ id }).first();
      return row ? adapt(row) : null;
    } catch (error) {
      fail(error, 'findById');
    }
  },

  async list(params: { page: number }): Promise<{ jobs: IExportJob[]; total: number }> {
    try {
      const pageSize = config.pagination.pageSize;
      const countRow = await sqlService.myDb('export_job').count('* as count').first();
      const total = Number((countRow as { count: string } | undefined)?.count ?? 0);
      const rows: IExportJobDB[] = await sqlService
        .myDb('export_job')
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(pageSize)
        .offset((params.page - 1) * pageSize);
      return { jobs: rows.map(adapt), total };
    } catch (error) {
      fail(error, 'list');
    }
  },

  async update(id: string, patch: IUpdateExportJob): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {};
      if (patch.status !== undefined) updateData.status = patch.status;
      if (patch.artifactPath !== undefined) updateData.artifact_path = patch.artifactPath;
      if (patch.rowCount !== undefined) updateData.row_count = patch.rowCount;
      if (patch.finishedAt !== undefined) updateData.finished_at = patch.finishedAt;
      if (Object.keys(updateData).length === 0) return;
      await sqlService.myDb('export_job').where({ id }).update(updateData);
    } catch (error) {
      fail(error, 'update');
    }
  },

  async findNextProcessable(statuses: IExportJobStatus[]): Promise<IExportJob | null> {
    try {
      const row: IExportJobDB | undefined = await sqlService
        .myDb('export_job')
        .whereIn('status', statuses)
        .orderBy('created_at', 'asc')
        .first();
      return row ? adapt(row) : null;
    } catch (error) {
      fail(error, 'findNextProcessable');
    }
  },
};

export default exportJobDbRepository;
