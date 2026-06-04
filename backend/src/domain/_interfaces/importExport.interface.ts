import type { IUserStatus } from '@domain/_interfaces/users.interface';

/**
 * Import / export hub domain types (SPEC-IMPORT-001). Entity-agnostic job model:
 * import jobs stage rows then commit through existing entity domains; export jobs
 * query an entity and write an artifact.
 */

export enum IImportEntityType {
  ASSET = 'ASSET',
  SITE = 'SITE',
  USER = 'USER',
  MANUFACTURER = 'MANUFACTURER',
  VENDOR = 'VENDOR',
}

/** Import job lifecycle (§7.1). */
export enum IImportJobStatus {
  QUEUED = 'QUEUED',
  PARSING = 'PARSING',
  MAPPED = 'MAPPED',
  DRY_RUNNING = 'DRY_RUNNING',
  DRY_RUN_SUCCEEDED = 'DRY_RUN_SUCCEEDED',
  DRY_RUN_FAILED = 'DRY_RUN_FAILED',
  COMMITTING = 'COMMITTING',
  SUCCEEDED = 'SUCCEEDED',
  PARTIAL_SUCCEEDED = 'PARTIAL_SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum IExportJobStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum IImportFileFormat {
  CSV = 'CSV',
  XLSX = 'XLSX',
  JSON = 'JSON',
}

export enum IImportExportScope {
  FULL = 'FULL',
  FILTERED = 'FILTERED',
}

export enum IImportRowSeverity {
  OK = 'OK',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

/** Commit behaviour when some rows fail (§7.5). */
export enum IPartialMode {
  ALL_OR_NOTHING = 'ALL_OR_NOTHING',
  VALID_ROWS_ONLY = 'VALID_ROWS_ONLY',
}

/** Per-job options stored alongside the column map. */
export interface IImportOptions {
  partialMode: IPartialMode;
  /** Override the open-handover block on status/assignee changes (§7.3). */
  force: boolean;
  /** Auto-create sites referenced by name when missing (default true). */
  createMissingSites: boolean;
  /** Auto-create manufacturers/vendors referenced by name (default true). */
  createMissingCatalog: boolean;
  /** Permit role=ADMIN rows in user import (default false, §7.3). */
  allowAdminPromotion: boolean;
}

/** Column map: source header → canonical field, plus options. */
export interface IImportMapping {
  columns: Record<string, string>;
  options: IImportOptions;
}

export interface IRowMessage {
  code: string;
  field: string | null;
  message: string;
}

export interface IDryRunSummary {
  total: number;
  ok: number;
  warning: number;
  error: number;
}

export interface ICommitSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface IImportJob {
  id: string;
  createdByUserId: string | null;
  entityType: IImportEntityType;
  status: IImportJobStatus;
  fileFormat: IImportFileFormat;
  originalFilename: string;
  storagePath: string;
  mapping: IImportMapping | null;
  presetId: string | null;
  dryRunSummary: IDryRunSummary | null;
  commitSummary: ICommitSummary | null;
  errorArtifactPath: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ICreateImportJob {
  createdByUserId: string | null;
  entityType: IImportEntityType;
  fileFormat: IImportFileFormat;
  originalFilename: string;
  storagePath: string;
}

/** Mutable fields the worker/domain patch onto a job as it advances. */
export interface IUpdateImportJob {
  status?: IImportJobStatus;
  mapping?: IImportMapping;
  presetId?: string | null;
  dryRunSummary?: IDryRunSummary | null;
  commitSummary?: ICommitSummary | null;
  errorArtifactPath?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface IImportJobRow {
  id: string;
  importJobId: string;
  rowNumber: number;
  raw: Record<string, unknown>;
  mapped: Record<string, unknown> | null;
  severity: IImportRowSeverity;
  messages: IRowMessage[];
  targetEntityId: string | null;
}

export interface ICreateImportJobRow {
  importJobId: string;
  rowNumber: number;
  raw: Record<string, unknown>;
  mapped: Record<string, unknown> | null;
  severity: IImportRowSeverity;
  messages: IRowMessage[];
}

export interface IListImportJobRowsParams {
  page: number;
  severity?: IImportRowSeverity;
}

export interface IExportFilter {
  search?: string;
  siteId?: string;
  status?: string;
  manufacturerId?: string;
  vendorId?: string;
  categoryId?: string;
  role?: string;
  userStatus?: IUserStatus;
}

export interface IExportJob {
  id: string;
  createdByUserId: string | null;
  entityType: IImportEntityType;
  status: IExportJobStatus;
  fileFormat: IImportFileFormat;
  scope: IImportExportScope;
  filter: IExportFilter | null;
  artifactPath: string | null;
  rowCount: number | null;
  createdAt: string;
  finishedAt: string | null;
}

/** Unified import/export row for the admin history tab. */
export interface IJobHistoryItem {
  kind: 'import' | 'export';
  id: string;
  entityType: IImportEntityType;
  status: string;
  fileFormat: IImportFileFormat;
  createdAt: string;
  errorArtifactPath: string | null;
  artifactPath: string | null;
}

export interface ICreateExportJob {
  createdByUserId: string | null;
  entityType: IImportEntityType;
  fileFormat: IImportFileFormat;
  scope: IImportExportScope;
  filter: IExportFilter | null;
}

export interface IUpdateExportJob {
  status?: IExportJobStatus;
  artifactPath?: string | null;
  rowCount?: number | null;
  finishedAt?: string | null;
}

export interface IImportMappingPreset {
  id: string;
  name: string;
  entityType: IImportEntityType;
  mapping: IImportMapping;
  createdByUserId: string | null;
  createdAt: string;
}

export interface ICreateImportMappingPreset {
  name: string;
  entityType: IImportEntityType;
  mapping: IImportMapping;
  createdByUserId: string | null;
}

export const DEFAULT_IMPORT_OPTIONS: IImportOptions = {
  partialMode: IPartialMode.ALL_OR_NOTHING,
  force: false,
  createMissingSites: true,
  createMissingCatalog: true,
  allowAdminPromotion: false,
};
