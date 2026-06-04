import {
  ICreateImportJob,
  ICreateImportJobRow,
  IImportEntityType,
  IImportFileFormat,
  IImportJob,
  IImportJobRow,
  IImportJobStatus,
  IJobHistoryItem,
  IListImportJobRowsParams,
  IUpdateImportJob,
} from '@domain/_interfaces/importExport.interface';
import { ImportJobRepository } from '@domain/_repositories/importJob.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import { adaptImportJob, adaptImportJobRow } from './importJobDb.adapter';
import importJobDbErrors from './importJobDb.errors';
import { IImportJobDB, IImportJobRowDB } from './importJobDb.interface';

function fail(error: unknown, method: string): never {
  logger.error(__filename, method, 'error', error);
  throw Boom.badImplementation(importJobDbErrors.internalError.message, {
    code: importJobDbErrors.internalError.code,
  });
}

const importJobDbRepository: ImportJobRepository = {
  async create(data: ICreateImportJob): Promise<IImportJob> {
    try {
      const [row]: IImportJobDB[] = await sqlService
        .myDb('import_job')
        .insert({
          created_by_user_id: data.createdByUserId,
          entity_type: data.entityType,
          status: IImportJobStatus.QUEUED,
          file_format: data.fileFormat,
          original_filename: data.originalFilename,
          storage_path: data.storagePath,
        })
        .returning('*');
      return adaptImportJob(row);
    } catch (error) {
      fail(error, 'create');
    }
  },

  async findById(id: string): Promise<IImportJob | null> {
    try {
      const row: IImportJobDB | undefined = await sqlService.myDb('import_job').where({ id }).first();
      return row ? adaptImportJob(row) : null;
    } catch (error) {
      fail(error, 'findById');
    }
  },

  async list(params: { page: number }): Promise<{ jobs: IImportJob[]; total: number }> {
    try {
      const pageSize = config.pagination.pageSize;
      const countRow = await sqlService.myDb('import_job').count('* as count').first();
      const total = Number((countRow as { count: string } | undefined)?.count ?? 0);
      const rows: IImportJobDB[] = await sqlService
        .myDb('import_job')
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(pageSize)
        .offset((params.page - 1) * pageSize);
      return { jobs: rows.map(adaptImportJob), total };
    } catch (error) {
      fail(error, 'list');
    }
  },

  async listHistory(params: { page: number }): Promise<{ items: IJobHistoryItem[]; total: number }> {
    try {
      const pageSize = config.pagination.pageSize;
      const db = sqlService.myDb;
      const importPart = db('import_job').select(
        db.raw(`'import'::text as kind`),
        'id',
        'entity_type',
        db.raw('status::text as status'),
        'file_format',
        'created_at',
        'error_artifact_path',
        db.raw('null::text as artifact_path'),
      );
      const exportPart = db('export_job').select(
        db.raw(`'export'::text as kind`),
        'id',
        'entity_type',
        db.raw('status::text as status'),
        'file_format',
        'created_at',
        db.raw('null::text as error_artifact_path'),
        'artifact_path',
      );
      const merged = importPart.unionAll([exportPart]);
      const countRow = await db.from(merged.as('history')).count('* as count').first();
      const total = Number((countRow as { count: string } | undefined)?.count ?? 0);
      interface IHistoryRowDB {
        kind: string;
        id: string;
        entity_type: string;
        status: string;
        file_format: string;
        created_at: string;
        error_artifact_path: string | null;
        artifact_path: string | null;
      }
      const rows = (await db
        .from(merged.as('history'))
        .orderBy('created_at', 'desc')
        .limit(pageSize)
        .offset((params.page - 1) * pageSize)) as IHistoryRowDB[];
      const items: IJobHistoryItem[] = rows.map((row) => ({
        kind: row.kind as IJobHistoryItem['kind'],
        id: row.id,
        entityType: row.entity_type as IImportEntityType,
        status: row.status,
        fileFormat: row.file_format as IImportFileFormat,
        createdAt: row.created_at,
        errorArtifactPath: row.error_artifact_path,
        artifactPath: row.artifact_path,
      }));
      return { items, total };
    } catch (error) {
      fail(error, 'listHistory');
    }
  },

  async update(id: string, patch: IUpdateImportJob): Promise<void> {
    try {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.status !== undefined) updateData.status = patch.status;
      if (patch.mapping !== undefined) updateData.mapping_json = JSON.stringify(patch.mapping);
      if (patch.presetId !== undefined) updateData.preset_id = patch.presetId;
      if (patch.dryRunSummary !== undefined) {
        updateData.dry_run_summary = patch.dryRunSummary ? JSON.stringify(patch.dryRunSummary) : null;
      }
      if (patch.commitSummary !== undefined) {
        updateData.commit_summary = patch.commitSummary ? JSON.stringify(patch.commitSummary) : null;
      }
      if (patch.errorArtifactPath !== undefined) updateData.error_artifact_path = patch.errorArtifactPath;
      if (patch.startedAt !== undefined) updateData.started_at = patch.startedAt;
      if (patch.finishedAt !== undefined) updateData.finished_at = patch.finishedAt;
      await sqlService.myDb('import_job').where({ id }).update(updateData);
    } catch (error) {
      fail(error, 'update');
    }
  },

  async findNextProcessable(statuses: IImportJobStatus[]): Promise<IImportJob | null> {
    try {
      const row: IImportJobDB | undefined = await sqlService
        .myDb('import_job')
        .whereIn('status', statuses)
        .orderBy('created_at', 'asc')
        .first();
      return row ? adaptImportJob(row) : null;
    } catch (error) {
      fail(error, 'findNextProcessable');
    }
  },

  async replaceRows(importJobId: string, rows: ICreateImportJobRow[]): Promise<void> {
    try {
      await sqlService.myDb.transaction(async (trx) => {
        await trx('import_job_row').where({ import_job_id: importJobId }).del();
        if (rows.length === 0) return;
        const records = rows.map((r) => ({
          import_job_id: r.importJobId,
          row_number: r.rowNumber,
          raw_json: JSON.stringify(r.raw),
          mapped_json: r.mapped ? JSON.stringify(r.mapped) : null,
          severity: r.severity,
          messages: JSON.stringify(r.messages),
        }));
        // Chunk to stay well under Postgres parameter limits on large files.
        const CHUNK = 500;
        for (let i = 0; i < records.length; i += CHUNK) {
          await trx('import_job_row').insert(records.slice(i, i + CHUNK));
        }
      });
    } catch (error) {
      fail(error, 'replaceRows');
    }
  },

  async listRows(
    importJobId: string,
    params: IListImportJobRowsParams,
  ): Promise<{ rows: IImportJobRow[]; total: number }> {
    try {
      const pageSize = config.pagination.pageSize;
      const base = () => {
        const qb = sqlService.myDb('import_job_row').where({ import_job_id: importJobId });
        if (params.severity) qb.andWhere('severity', params.severity);
        return qb;
      };
      const countRow = await base().count('* as count').first();
      const total = Number((countRow as { count: string } | undefined)?.count ?? 0);
      const rows: IImportJobRowDB[] = await base()
        .select('*')
        .orderBy('row_number', 'asc')
        .limit(pageSize)
        .offset((params.page - 1) * pageSize);
      return { rows: rows.map(adaptImportJobRow), total };
    } catch (error) {
      fail(error, 'listRows');
    }
  },

  async allRows(importJobId: string): Promise<IImportJobRow[]> {
    try {
      const rows: IImportJobRowDB[] = await sqlService
        .myDb('import_job_row')
        .where({ import_job_id: importJobId })
        .orderBy('row_number', 'asc');
      return rows.map(adaptImportJobRow);
    } catch (error) {
      fail(error, 'allRows');
    }
  },

  async updateRow(
    id: string,
    patch: { severity?: IImportJobRow['severity']; messages?: IImportJobRow['messages']; targetEntityId?: string | null },
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {};
      if (patch.severity !== undefined) updateData.severity = patch.severity;
      if (patch.messages !== undefined) updateData.messages = JSON.stringify(patch.messages);
      if (patch.targetEntityId !== undefined) updateData.target_entity_id = patch.targetEntityId;
      if (Object.keys(updateData).length === 0) return;
      await sqlService.myDb('import_job_row').where({ id }).update(updateData);
    } catch (error) {
      fail(error, 'updateRow');
    }
  },
};

export default importJobDbRepository;
