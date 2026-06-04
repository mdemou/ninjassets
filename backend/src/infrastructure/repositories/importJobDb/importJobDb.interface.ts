import {
  ICommitSummary,
  IDryRunSummary,
  IImportMapping,
  IRowMessage,
} from '@domain/_interfaces/importExport.interface';

export interface IImportJobDB {
  id: string;
  created_by_user_id: string | null;
  entity_type: string;
  status: string;
  file_format: string;
  original_filename: string;
  storage_path: string;
  mapping_json: IImportMapping | null;
  preset_id: string | null;
  dry_run_summary: IDryRunSummary | null;
  commit_summary: ICommitSummary | null;
  error_artifact_path: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface IImportJobRowDB {
  id: string;
  import_job_id: string;
  row_number: number;
  raw_json: Record<string, unknown>;
  mapped_json: Record<string, unknown> | null;
  severity: string;
  messages: IRowMessage[];
  target_entity_id: string | null;
}
