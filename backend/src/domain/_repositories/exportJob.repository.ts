import {
  ICreateExportJob,
  IExportJob,
  IExportJobStatus,
  IUpdateExportJob,
} from '@domain/_interfaces/importExport.interface';

export interface ExportJobRepository {
  create(data: ICreateExportJob): Promise<IExportJob>;
  findById(id: string): Promise<IExportJob | null>;
  list(params: { page: number }): Promise<{ jobs: IExportJob[]; total: number }>;
  update(id: string, patch: IUpdateExportJob): Promise<void>;
  /** Oldest job in any of the given statuses — DB-poll fallback for the worker. */
  findNextProcessable(statuses: IExportJobStatus[]): Promise<IExportJob | null>;
}
