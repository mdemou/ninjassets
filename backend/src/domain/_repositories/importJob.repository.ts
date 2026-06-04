import {
  ICreateImportJob,
  ICreateImportJobRow,
  IImportJob,
  IImportJobRow,
  IImportJobStatus,
  IJobHistoryItem,
  IListImportJobRowsParams,
  IUpdateImportJob,
} from '@domain/_interfaces/importExport.interface';

export interface ImportJobRepository {
  create(data: ICreateImportJob): Promise<IImportJob>;
  findById(id: string): Promise<IImportJob | null>;
  list(params: { page: number }): Promise<{ jobs: IImportJob[]; total: number }>;
  listHistory(params: { page: number }): Promise<{ items: IJobHistoryItem[]; total: number }>;
  update(id: string, patch: IUpdateImportJob): Promise<void>;
  /** Oldest job in any of the given statuses — DB-poll fallback for the worker. */
  findNextProcessable(statuses: IImportJobStatus[]): Promise<IImportJob | null>;

  // Staging rows.
  replaceRows(importJobId: string, rows: ICreateImportJobRow[]): Promise<void>;
  listRows(
    importJobId: string,
    params: IListImportJobRowsParams,
  ): Promise<{ rows: IImportJobRow[]; total: number }>;
  /** All rows in source order — used by the worker during dry-run/commit. */
  allRows(importJobId: string): Promise<IImportJobRow[]>;
  updateRow(
    id: string,
    patch: { severity?: IImportJobRow['severity']; messages?: IImportJobRow['messages']; targetEntityId?: string | null },
  ): Promise<void>;
}
