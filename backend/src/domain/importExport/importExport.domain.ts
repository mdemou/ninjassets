import {
  DEFAULT_IMPORT_OPTIONS,
  ICommitSummary,
  ICreateExportJob,
  IDryRunSummary,
  IImportEntityType,
  IImportFileFormat,
  IImportJob,
  IImportJobRow,
  IImportMapping,
  IImportMappingPreset,
  IImportRowSeverity,
  IExportJob,
  IExportJobStatus,
  IImportJobStatus,
  IJobHistoryItem,
  IPartialMode,
  IRowMessage,
} from '@domain/_interfaces/importExport.interface';
import type { ExportJobRepository } from '@domain/_repositories/exportJob.repository';
import type { ImportJobRepository } from '@domain/_repositories/importJob.repository';
import type { ImportMappingPresetRepository } from '@domain/_repositories/importMappingPreset.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import { importFileStorage } from '@services/importExport/importFileStorage.service';
import { parseFile } from '@services/importExport/fileParser.service';
import { writeFile, type ExportRow } from '@services/importExport/fileWriter.service';
import config from '@config/config';
import eventBus from '@services/events/eventBus';
import { EventType } from '@services/events/eventCatalog';
import type { EventActor } from '@services/events/event.types';
import type { UserRepository } from '@domain/_repositories/user.repository';
import { canonicalKeysFor, canonicalFieldsFor } from './canonicalFields';
import {
  CanonicalRow,
  ENTITY_IMPORTERS,
  EntityDomains,
  ImportContext,
  Requester,
} from './entityImporters';
import { ExportRepos, exportEntity } from './entityExporters';

export interface ImportExportDeps {
  importJobRepository: ImportJobRepository;
  exportJobRepository: ExportJobRepository;
  presetRepository: ImportMappingPresetRepository;
  /** Entity domains + lookup repos shared by importers (built at the composition root). */
  domains: EntityDomains;
  repos: ImportContext['repos'];
  exportRepos: ExportRepos;
  /** Optional Redis fast-trigger; the worker's DB sweep is authoritative. */
  enqueue?: (message: string) => Promise<void>;
}

const COMMIT_REQUIRED = IImportJobStatus.DRY_RUN_SUCCEEDED;

const IMPORT_EXPORT_HUB_LINK = `${config.frontendUrl}/admin/import-export`;

function nowIso(): string {
  return new Date().toISOString();
}

async function resolveEventActor(
  userRepository: UserRepository,
  userId: string | null,
): Promise<EventActor | null> {
  if (!userId) return null;
  const user = await userRepository.findById(userId);
  if (!user) return { id: userId, name: null };
  return { id: user.id, name: user.displayName };
}

async function publishImportJobEvent(
  userRepository: UserRepository,
  type: Extract<EventType, 'import.dry_run_completed' | 'import.commit_completed'>,
  job: IImportJob,
  detail: string,
): Promise<void> {
  try {
    const actor = await resolveEventActor(userRepository, job.createdByUserId);
    eventBus.publish({
      type,
      occurredAt: nowIso(),
      actor,
      subject: {
        kind: 'import',
        id: job.id,
        name: `${job.entityType} — ${job.originalFilename}`,
      },
      detail,
      link: IMPORT_EXPORT_HUB_LINK,
    });
  } catch (error) {
    logger.warn(__filename, 'publishImportJobEvent', 'failed to publish event', error);
  }
}

async function publishExportJobEvent(
  userRepository: UserRepository,
  job: IExportJob,
  detail: string,
): Promise<void> {
  try {
    const actor = await resolveEventActor(userRepository, job.createdByUserId);
    eventBus.publish({
      type: 'export.completed',
      occurredAt: nowIso(),
      actor,
      subject: {
        kind: 'export',
        id: job.id,
        name: `${job.entityType} export (${job.fileFormat})`,
      },
      detail,
      link: IMPORT_EXPORT_HUB_LINK,
    });
  } catch (error) {
    logger.warn(__filename, 'publishExportJobEvent', 'failed to publish event', error);
  }
}

function coerceMappedValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return null;
}

/** Builds the canonical row (canonicalField → value) from a raw row via the column map. */
function applyMapping(raw: Record<string, unknown>, mapping: IImportMapping): CanonicalRow {
  const out: CanonicalRow = {};
  for (const [sourceHeader, canonicalField] of Object.entries(mapping.columns)) {
    if (!canonicalField) continue;
    out[canonicalField] = coerceMappedValue(raw[sourceHeader]);
  }
  return out;
}

function importExportDomainFactory(deps: ImportExportDeps) {
  const { importJobRepository, exportJobRepository, presetRepository } = deps;

  function buildContext(actor: Requester, mapping: IImportMapping): ImportContext {
    return {
      actor,
      options: mapping.options,
      domains: deps.domains,
      repos: deps.repos,
    };
  }

  async function enqueue(kind: 'import' | 'export', id: string): Promise<void> {
    if (!deps.enqueue) return;
    try {
      await deps.enqueue(JSON.stringify({ kind, id }));
    } catch (error) {
      // Non-fatal: the worker's DB sweep still picks the job up.
      logger.warn(__filename, 'enqueue', 'redis enqueue failed (DB sweep will handle)', error);
    }
  }

  function requireJob(job: IImportJob | null): IImportJob {
    if (!job) throw Boom.notFound('Import job not found', { code: 'IEX4041' });
    return job;
  }

  return {
    // -----------------------------------------------------------------------
    // Import job lifecycle
    // -----------------------------------------------------------------------

    async createImportJob(
      actor: Requester,
      input: { entityType: IImportEntityType; fileFormat: IImportFileFormat; originalFilename: string; buffer: Buffer },
    ): Promise<{ job: IImportJob; headers: string[] }> {
      if (input.buffer.length > config.importExport.maxFileBytes) {
        throw Boom.entityTooLarge('File exceeds the configured size limit', { code: 'IEX4131' });
      }
      const parsed = await parseFile(input.fileFormat, input.buffer);
      if (parsed.rows.length > config.importExport.maxRows) {
        throw Boom.badRequest(`File exceeds the ${config.importExport.maxRows}-row limit`, { code: 'IEX4221' });
      }
      const ext = input.fileFormat.toLowerCase();
      const storedName = await importFileStorage.store(input.buffer, ext);

      const job = await importJobRepository.create({
        createdByUserId: actor.id,
        entityType: input.entityType,
        fileFormat: input.fileFormat,
        originalFilename: input.originalFilename,
        storagePath: storedName,
      });

      // Stage raw rows immediately so mapping/dry-run never re-reads the file.
      await importJobRepository.replaceRows(
        job.id,
        parsed.rows.map((raw, index) => ({
          importJobId: job.id,
          rowNumber: index + 1,
          raw,
          mapped: null,
          severity: IImportRowSeverity.OK,
          messages: [],
        })),
      );

      return { job, headers: parsed.headers };
    },

    async getImportJob(id: string): Promise<IImportJob> {
      return requireJob(await importJobRepository.findById(id));
    },

    async listImportJobs(page: number): Promise<{
      jobs: IImportJob[];
      total: number;
      page: number;
      pageSize: number;
    }> {
      const pageNum = Math.max(1, page);
      const { jobs, total } = await importJobRepository.list({ page: pageNum });
      return { jobs, total, page: pageNum, pageSize: config.pagination.pageSize };
    },

    async listJobHistory(page: number): Promise<{
      items: IJobHistoryItem[];
      total: number;
      page: number;
      pageSize: number;
    }> {
      const pageNum = Math.max(1, page);
      const { items, total } = await importJobRepository.listHistory({ page: pageNum });
      return { items, total, page: pageNum, pageSize: config.pagination.pageSize };
    },

    async listImportJobRows(
      id: string,
      params: { page: number; severity?: IImportRowSeverity },
    ): Promise<{ rows: IImportJobRow[]; total: number }> {
      await this.getImportJob(id);
      return importJobRepository.listRows(id, params);
    },

    async setMapping(id: string, mapping: IImportMapping): Promise<IImportJob> {
      const job = await this.getImportJob(id);
      const allowed: IImportJobStatus[] = [
        IImportJobStatus.QUEUED,
        IImportJobStatus.PARSING,
        IImportJobStatus.MAPPED,
        IImportJobStatus.DRY_RUN_FAILED,
        IImportJobStatus.DRY_RUN_SUCCEEDED,
      ];
      if (!allowed.includes(job.status)) {
        throw Boom.conflict(`Cannot set mapping while job is ${job.status}`, { code: 'IEX4090' });
      }
      const merged: IImportMapping = {
        columns: mapping.columns,
        options: { ...DEFAULT_IMPORT_OPTIONS, ...mapping.options },
      };
      await importJobRepository.update(id, { mapping: merged, status: IImportJobStatus.MAPPED });
      return this.getImportJob(id);
    },

    async requestDryRun(id: string): Promise<IImportJob> {
      const job = await this.getImportJob(id);
      if (!job.mapping) throw Boom.badRequest('Set a column mapping first', { code: 'IEX4001' });
      const allowed: IImportJobStatus[] = [
        IImportJobStatus.MAPPED,
        IImportJobStatus.DRY_RUN_FAILED,
        IImportJobStatus.DRY_RUN_SUCCEEDED,
      ];
      if (!allowed.includes(job.status)) {
        throw Boom.conflict(`Cannot dry-run while job is ${job.status}`, { code: 'IEX4091' });
      }
      await importJobRepository.update(id, { status: IImportJobStatus.DRY_RUNNING, startedAt: nowIso() });
      await enqueue('import', id);
      return this.getImportJob(id);
    },

    async requestCommit(id: string): Promise<IImportJob> {
      const job = await this.getImportJob(id);
      if (job.status !== COMMIT_REQUIRED) {
        throw Boom.conflict(`Commit requires status ${COMMIT_REQUIRED} (job is ${job.status})`, {
          code: 'IEX4092',
        });
      }
      await importJobRepository.update(id, { status: IImportJobStatus.COMMITTING, startedAt: nowIso() });
      await enqueue('import', id);
      return this.getImportJob(id);
    },

    async cancelImportJob(id: string): Promise<IImportJob> {
      const job = await this.getImportJob(id);
      const terminal: IImportJobStatus[] = [
        IImportJobStatus.SUCCEEDED,
        IImportJobStatus.PARTIAL_SUCCEEDED,
        IImportJobStatus.FAILED,
        IImportJobStatus.CANCELLED,
        IImportJobStatus.COMMITTING,
      ];
      if (terminal.includes(job.status)) {
        throw Boom.conflict(`Cannot cancel a job that is ${job.status}`, { code: 'IEX4093' });
      }
      await importJobRepository.update(id, { status: IImportJobStatus.CANCELLED, finishedAt: nowIso() });
      return this.getImportJob(id);
    },

    // -----------------------------------------------------------------------
    // Worker entry points (called by the DB sweep / Redis consumer)
    // -----------------------------------------------------------------------

    async runDryRun(id: string): Promise<void> {
      const job = await importJobRepository.findById(id);
      if (!job || job.status !== IImportJobStatus.DRY_RUNNING || !job.mapping) return;
      const importer = ENTITY_IMPORTERS[job.entityType];
      const ctx = buildContext({ id: job.createdByUserId ?? '', role: 'ADMIN' }, job.mapping);
      const rows = await importJobRepository.allRows(id);
      const summary: IDryRunSummary = { total: rows.length, ok: 0, warning: 0, error: 0 };
      const errorReport: ExportRow[] = [];

      for (const row of rows) {
        const canonical = applyMapping(row.raw, job.mapping);
        let messages: IRowMessage[] = [];
        try {
          const result = await importer.validate(canonical, ctx);
          messages = result.messages;
        } catch (error) {
          messages = [{ code: 'ROW_EXCEPTION', field: null, message: (error as Error).message }];
        }
        const severity = severityOf(messages);
        if (severity === IImportRowSeverity.ERROR) summary.error += 1;
        else if (severity === IImportRowSeverity.WARNING) summary.warning += 1;
        else summary.ok += 1;
        await importJobRepository.updateRow(row.id, { severity, messages });
        if (severity !== IImportRowSeverity.OK) {
          errorReport.push(rowReport(row, severity, messages));
        }
      }

      const errorArtifactPath = errorReport.length > 0 ? await writeErrorArtifact(errorReport) : null;
      const status =
        summary.error > 0 ? IImportJobStatus.DRY_RUN_FAILED : IImportJobStatus.DRY_RUN_SUCCEEDED;
      await importJobRepository.update(id, {
        status,
        dryRunSummary: summary,
        errorArtifactPath,
      });
      void publishImportJobEvent(
        deps.repos.user,
        'import.dry_run_completed',
        job,
        `${status} — ${summary.ok} ok, ${summary.error} error, ${summary.warning} warning`,
      );
    },

    async runCommit(id: string): Promise<void> {
      const job = await importJobRepository.findById(id);
      if (!job || job.status !== IImportJobStatus.COMMITTING || !job.mapping) return;
      const importer = ENTITY_IMPORTERS[job.entityType];
      const mapping = job.mapping;
      const ctx = buildContext({ id: job.createdByUserId ?? '', role: 'ADMIN' }, mapping);
      const partialMode = mapping.options.partialMode;
      const rows = await importJobRepository.allRows(id);
      const summary: ICommitSummary = { created: 0, updated: 0, skipped: 0, failed: 0 };
      const errorReport: ExportRow[] = [];
      let aborted = false;

      for (const row of rows) {
        const canonical = applyMapping(row.raw, mapping);
        let messages: IRowMessage[] = [];
        try {
          const validation = await importer.validate(canonical, ctx);
          messages = validation.messages;
        } catch (error) {
          messages = [{ code: 'ROW_EXCEPTION', field: null, message: (error as Error).message }];
        }

        if (severityOf(messages) === IImportRowSeverity.ERROR) {
          if (partialMode === IPartialMode.ALL_OR_NOTHING) {
            // Gated by the dry-run, but guard against drift: abort the whole job.
            summary.failed += 1;
            errorReport.push(rowReport(row, IImportRowSeverity.ERROR, messages));
            await importJobRepository.updateRow(row.id, { severity: IImportRowSeverity.ERROR, messages });
            aborted = true;
            break;
          }
          summary.skipped += 1;
          errorReport.push(rowReport(row, IImportRowSeverity.ERROR, messages));
          await importJobRepository.updateRow(row.id, { severity: IImportRowSeverity.ERROR, messages });
          continue;
        }

        try {
          const applied = await importer.apply(canonical, ctx);
          if (applied.action === 'created') summary.created += 1;
          else summary.updated += 1;
          await importJobRepository.updateRow(row.id, {
            severity: IImportRowSeverity.OK,
            messages: [],
            targetEntityId: applied.targetEntityId,
          });
        } catch (error) {
          const message = (error as Error).message;
          summary.failed += 1;
          const m: IRowMessage[] = [{ code: 'COMMIT_FAILED', field: null, message }];
          errorReport.push(rowReport(row, IImportRowSeverity.ERROR, m));
          await importJobRepository.updateRow(row.id, { severity: IImportRowSeverity.ERROR, messages: m });
          if (partialMode === IPartialMode.ALL_OR_NOTHING) {
            aborted = true;
            break;
          }
        }
      }

      const errorArtifactPath = errorReport.length > 0 ? await writeErrorArtifact(errorReport) : null;
      const status = resolveCommitStatus(partialMode, summary, aborted);
      await importJobRepository.update(id, {
        status,
        commitSummary: summary,
        errorArtifactPath,
        finishedAt: nowIso(),
      });
      void publishImportJobEvent(
        deps.repos.user,
        'import.commit_completed',
        job,
        `${status} — created ${summary.created}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}`,
      );
    },

    // -----------------------------------------------------------------------
    // Export
    // -----------------------------------------------------------------------

    async createExportJob(actor: Requester, input: ICreateExportJob): Promise<IExportJob> {
      const job = await exportJobRepository.create({ ...input, createdByUserId: actor.id });
      await enqueue('export', job.id);
      return job;
    },

    async getExportJob(id: string): Promise<IExportJob> {
      const job = await exportJobRepository.findById(id);
      if (!job) throw Boom.notFound('Export job not found', { code: 'IEX4042' });
      return job;
    },

    async listExportJobs(page: number): Promise<{
      jobs: IExportJob[];
      total: number;
      page: number;
      pageSize: number;
    }> {
      const pageNum = Math.max(1, page);
      const { jobs, total } = await exportJobRepository.list({ page: pageNum });
      return { jobs, total, page: pageNum, pageSize: config.pagination.pageSize };
    },

    async runExport(id: string): Promise<void> {
      const claimed = await exportJobRepository.findById(id);
      if (!claimed || claimed.status !== IExportJobStatus.QUEUED) return;
      await exportJobRepository.update(id, { status: IExportJobStatus.PROCESSING });
      try {
        const { headers, rows } = await exportEntity(claimed.entityType, deps.exportRepos, claimed.filter);
        const { buffer, ext } = await writeFile(claimed.fileFormat, headers, rows);
        const artifactPath = await importFileStorage.store(buffer, ext);
        await exportJobRepository.update(id, {
          status: IExportJobStatus.SUCCEEDED,
          artifactPath,
          rowCount: rows.length,
          finishedAt: nowIso(),
        });
        void publishExportJobEvent(
          deps.repos.user,
          { ...claimed, status: IExportJobStatus.SUCCEEDED, rowCount: rows.length },
          `${IExportJobStatus.SUCCEEDED} — ${rows.length} rows`,
        );
      } catch (error) {
        logger.error(__filename, 'runExport', 'export failed', error);
        await exportJobRepository.update(id, { status: IExportJobStatus.FAILED, finishedAt: nowIso() });
        void publishExportJobEvent(
          deps.repos.user,
          { ...claimed, status: IExportJobStatus.FAILED },
          IExportJobStatus.FAILED,
        );
      }
    },

    async downloadExportArtifact(id: string): Promise<{ buffer: Buffer; filename: string; format: IImportFileFormat }> {
      const job = await this.getExportJob(id);
      if (job.status !== IExportJobStatus.SUCCEEDED || !job.artifactPath) {
        throw Boom.conflict('Export is not ready for download', { code: 'IEX4094' });
      }
      const buffer = await importFileStorage.read(job.artifactPath);
      const filename = `${job.entityType.toLowerCase()}-export.${job.fileFormat.toLowerCase()}`;
      return { buffer, filename, format: job.fileFormat };
    },

    async downloadErrorArtifact(id: string): Promise<{ buffer: Buffer; filename: string }> {
      const job = await this.getImportJob(id);
      if (!job.errorArtifactPath) throw Boom.notFound('No error report for this job', { code: 'IEX4043' });
      const buffer = await importFileStorage.read(job.errorArtifactPath);
      return { buffer, filename: `import-${id}-errors.csv` };
    },

    // -----------------------------------------------------------------------
    // Templates + presets
    // -----------------------------------------------------------------------

    async buildTemplate(
      entityType: IImportEntityType,
      format: IImportFileFormat,
    ): Promise<{ buffer: Buffer; filename: string }> {
      const headers = canonicalKeysFor(entityType);
      // A single hint row helps admins fill the file; it is skipped on re-import
      // unless mapped (hints are not valid data).
      const hintRow: ExportRow = {};
      for (const field of canonicalFieldsFor(entityType)) hintRow[field.key] = field.hint;
      const { buffer, ext } = await writeFile(format, headers, [hintRow]);
      return { buffer, filename: `${entityType.toLowerCase()}-template.${ext}` };
    },

    async listPresets(entityType: IImportEntityType): Promise<IImportMappingPreset[]> {
      return presetRepository.listByEntityType(entityType);
    },

    async createPreset(
      actor: Requester,
      input: { name: string; entityType: IImportEntityType; mapping: IImportMapping },
    ): Promise<IImportMappingPreset> {
      return presetRepository.create({ ...input, createdByUserId: actor.id });
    },

    async deletePreset(id: string): Promise<void> {
      const preset = await presetRepository.findById(id);
      if (!preset) throw Boom.notFound('Preset not found', { code: 'IEX4044' });
      await presetRepository.delete(id);
    },

    // -----------------------------------------------------------------------
    // Worker DB sweep — process every job in a transient state.
    // -----------------------------------------------------------------------

    async processPending(): Promise<boolean> {
      let didWork = false;
      const importJob = await importJobRepository.findNextProcessable([
        IImportJobStatus.DRY_RUNNING,
        IImportJobStatus.COMMITTING,
      ]);
      if (importJob) {
        didWork = true;
        if (importJob.status === IImportJobStatus.DRY_RUNNING) await this.runDryRun(importJob.id);
        else await this.runCommit(importJob.id);
      }
      const exportJob = await exportJobRepository.findNextProcessable([IExportJobStatus.QUEUED]);
      if (exportJob) {
        didWork = true;
        await this.runExport(exportJob.id);
      }
      return didWork;
    },
  };
}

// ---------------------------------------------------------------------------
// Module helpers
// ---------------------------------------------------------------------------

function severityOf(messages: IRowMessage[]): IImportRowSeverity {
  if (messages.length === 0) return IImportRowSeverity.OK;
  // Any non-warning message is blocking; warnings use the explicit WARNING code.
  if (messages.some((m) => m.code !== 'WARNING')) return IImportRowSeverity.ERROR;
  return IImportRowSeverity.WARNING;
}

function rowReport(row: IImportJobRow, severity: IImportRowSeverity, messages: IRowMessage[]): ExportRow {
  return {
    row_number: row.rowNumber,
    severity,
    errors: messages.map((m) => (m.field ? `${m.field}: ${m.message}` : m.message)).join('; '),
  };
}

async function writeErrorArtifact(rows: ExportRow[]): Promise<string> {
  const { buffer, ext } = await writeFile(IImportFileFormat.CSV, ['row_number', 'severity', 'errors'], rows);
  return importFileStorage.store(buffer, ext);
}

function resolveCommitStatus(
  partialMode: IPartialMode,
  summary: ICommitSummary,
  aborted: boolean,
): IImportJobStatus {
  if (partialMode === IPartialMode.ALL_OR_NOTHING) {
    return aborted || summary.failed > 0 ? IImportJobStatus.FAILED : IImportJobStatus.SUCCEEDED;
  }
  return summary.failed > 0 || summary.skipped > 0
    ? IImportJobStatus.PARTIAL_SUCCEEDED
    : IImportJobStatus.SUCCEEDED;
}

export type ImportExportDomain = ReturnType<typeof importExportDomainFactory>;

export default importExportDomainFactory;
