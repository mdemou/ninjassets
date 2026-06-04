import {
  IImportEntityType,
  IImportFileFormat,
  IImportJob,
  IImportJobRow,
  IImportJobStatus,
  IImportRowSeverity,
} from '@domain/_interfaces/importExport.interface';
import { IImportJobDB, IImportJobRowDB } from './importJobDb.interface';

export function adaptImportJob(row: IImportJobDB): IImportJob {
  return {
    id: row.id,
    createdByUserId: row.created_by_user_id,
    entityType: row.entity_type as IImportEntityType,
    status: row.status as IImportJobStatus,
    fileFormat: row.file_format as IImportFileFormat,
    originalFilename: row.original_filename,
    storagePath: row.storage_path,
    mapping: row.mapping_json,
    presetId: row.preset_id,
    dryRunSummary: row.dry_run_summary,
    commitSummary: row.commit_summary,
    errorArtifactPath: row.error_artifact_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function adaptImportJobRow(row: IImportJobRowDB): IImportJobRow {
  return {
    id: row.id,
    importJobId: row.import_job_id,
    rowNumber: row.row_number,
    raw: row.raw_json,
    mapped: row.mapped_json,
    severity: row.severity as IImportRowSeverity,
    messages: row.messages ?? [],
    targetEntityId: row.target_entity_id,
  };
}
