import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '~/components/Button';
import { FormInput } from '~/components/FormInput';
import { TableSkeleton } from '~/components/LoadingSkeleton';
import { Modal } from '~/components/Modal';
import { PageContent } from '~/components/PageContent';
import { Pagination } from '~/components/Pagination';
import { Panel } from '~/components/Panel';
import { UnderlineTabBar } from '~/components/UnderlineTabBar';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '~/components/Table';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type { ApiResponse } from '~/types';
import { api } from '~/utils/api';
import { pageMeta } from '~/utils/pageTitle';
import type { TranslationKey } from '~/utils/translations';

export const meta = pageMeta('ie.title');

// --- Types mirroring the backend import/export domain -----------------------

type EntityType = 'ASSET' | 'SITE' | 'USER' | 'MANUFACTURER' | 'VENDOR';
type FileFormat = 'CSV' | 'XLSX' | 'JSON';
type Scope = 'FULL' | 'FILTERED';

interface CanonicalField {
  key: string;
  requiredOnCreate: boolean;
  hint: string;
}

interface ImportOptions {
  partialMode: 'ALL_OR_NOTHING' | 'VALID_ROWS_ONLY';
  force: boolean;
  createMissingSites: boolean;
  createMissingCatalog: boolean;
  allowAdminPromotion: boolean;
}

interface Mapping {
  columns: Record<string, string>;
  options: ImportOptions;
}

interface ImportJob {
  id: string;
  entityType: EntityType;
  status: string;
  fileFormat: FileFormat;
  originalFilename: string;
  dryRunSummary: { total: number; ok: number; warning: number; error: number } | null;
  commitSummary: { created: number; updated: number; skipped: number; failed: number } | null;
  errorArtifactPath: string | null;
  createdAt: string;
  createdByUserId: string | null;
}

interface ExportJob {
  id: string;
  entityType: EntityType;
  status: string;
  fileFormat: FileFormat;
  scope: Scope;
  rowCount: number | null;
  createdAt: string;
  artifactPath?: string | null;
}

interface JobHistoryItem {
  kind: 'import' | 'export';
  id: string;
  entityType: EntityType;
  status: string;
  fileFormat: FileFormat;
  createdAt: string;
  errorArtifactPath: string | null;
  artifactPath: string | null;
}

interface ListJobHistoryData {
  items: JobHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface ImportRow {
  rowNumber: number;
  severity: 'OK' | 'WARNING' | 'ERROR';
  messages: { code: string; field: string | null; message: string }[];
}

interface Preset {
  id: string;
  name: string;
  entityType: EntityType;
  mapping: Mapping;
}

const ENTITY_TYPES: EntityType[] = ['ASSET', 'SITE', 'USER', 'MANUFACTURER', 'VENDOR'];
const FILE_FORMATS: FileFormat[] = ['CSV', 'XLSX', 'JSON'];

type ImportExportTab = 'import' | 'export' | 'history';

const TAB_KEYS: Record<ImportExportTab, TranslationKey> = {
  import: 'ie.tab.import',
  export: 'ie.tab.export',
  history: 'ie.tab.history',
};

const IE_TAB_ICONS = {
  import: (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  export: (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  history: (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
} as const;

const ENTITY_LABEL_KEYS: Record<EntityType, TranslationKey> = {
  ASSET: 'ie.entity.ASSET',
  SITE: 'ie.entity.SITE',
  USER: 'ie.entity.USER',
  MANUFACTURER: 'ie.entity.MANUFACTURER',
  VENDOR: 'ie.entity.VENDOR',
};

const DEFAULT_OPTIONS: ImportOptions = {
  partialMode: 'ALL_OR_NOTHING',
  force: false,
  createMissingSites: true,
  createMissingCatalog: true,
  allowAdminPromotion: false,
};

/** Authenticated binary download → triggers a browser save. */
async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function unwrap<T>(res: { data?: T }): T {
  return res.data as T;
}

// ---------------------------------------------------------------------------

export default function AdminImportExport() {
  usePageTitle('ie.title');
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { t } = useLanguage();
  const { addToast } = useError();
  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const [tab, setTab] = useState<ImportExportTab>('import');

  const ieTabs = (['import', 'export', 'history'] as const).map((key) => ({
    id: key,
    label: t(TAB_KEYS[key]),
    icon: IE_TAB_ICONS[key],
  }));

  if (!isAdmin) return null;

  return (
    <PageContent size="wide">
      <h1 className="text-3xl font-semibold mb-2">{t('ie.title')}</h1>
      <p className="text-sm text-muted mb-4">{t('ie.subtitle')}</p>

      <UnderlineTabBar
        className="mb-4"
        idPrefix="ie"
        ariaLabel={t('ie.title')}
        tabs={ieTabs}
        active={tab}
        onChange={setTab}
      />

      <div
        role="tabpanel"
        id={`ie-panel-${tab}`}
        aria-labelledby={`ie-tab-${tab}`}
      >
      {tab === 'import' && (
        <ImportWizard
          t={t}
          addToast={addToast}
        />
      )}
      {tab === 'export' && (
        <ExportPanel
          t={t}
          addToast={addToast}
        />
      )}
      {tab === 'history' && (
        <HistoryTab
          t={t}
          addToast={addToast}
        />
      )}
      </div>
    </PageContent>
  );
}

type T = (key: TranslationKey) => string;
type AddToast = ReturnType<typeof useError>['addToast'];

// --- Import wizard ----------------------------------------------------------

const STEP_KEYS: TranslationKey[] = [
  'ie.step.entity',
  'ie.step.upload',
  'ie.step.map',
  'ie.step.options',
  'ie.step.dryRun',
  'ie.step.commit',
  'ie.step.done',
];

function ImportWizard({ t, addToast }: { t: T; addToast: AddToast }) {
  const [step, setStep] = useState(0);
  const [entityType, setEntityType] = useState<EntityType>('ASSET');
  const [fileFormat, setFileFormat] = useState<FileFormat>('CSV');
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fields, setFields] = useState<CanonicalField[]>([]);
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_OPTIONS);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(0);
    setFile(null);
    setJob(null);
    setHeaders([]);
    setColumns({});
    setOptions(DEFAULT_OPTIONS);
    setRows([]);
  };

  const fail = (e: unknown) => addToast({ type: 'error', title: t('common.error'), message: (e as Error).message });

  // Detect format from extension as a convenience.
  const onPickFile = (f: File | null) => {
    setFile(f);
    if (!f) return;
    const ext = f.name.split('.').pop()?.toUpperCase();
    if (ext === 'CSV' || ext === 'XLSX' || ext === 'JSON') setFileFormat(ext);
  };

  const downloadTemplate = async () => {
    try {
      await downloadFile(
        `/api/p/import-templates/${entityType}?format=${fileFormat.toLowerCase()}`,
        `${entityType.toLowerCase()}-template.${fileFormat.toLowerCase()}`,
      );
    } catch (e) {
      fail(e);
    }
  };

  const upload = async () => {
    if (!file) return addToast({ type: 'error', title: t('common.error'), message: t('ie.requiredFile') });
    setBusy(true);
    try {
      const q = `entityType=${entityType}&fileFormat=${fileFormat}&filename=${encodeURIComponent(file.name)}`;
      const res = await api.upload<{ job: ImportJob; headers: string[]; canonicalFields: CanonicalField[] }>(
        `/api/p/import-jobs?${q}`,
        file,
      );
      const data = unwrap(res);
      setJob(data.job);
      setHeaders(data.headers);
      setFields(data.canonicalFields);
      // Auto-map exact header matches against canonical keys.
      const auto: Record<string, string> = {};
      for (const h of data.headers) {
        if (data.canonicalFields.some((f) => f.key === h)) auto[h] = h;
      }
      setColumns(auto);
      const presetRes = await api.get<{ presets: Preset[] }>(`/api/p/import-mapping-presets?entityType=${entityType}`);
      setPresets(unwrap(presetRes).presets);
      setStep(2);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const saveMapping = async (): Promise<boolean> => {
    if (!job) return false;
    setBusy(true);
    try {
      await api.patch(`/api/p/import-jobs/${job.id}/mapping`, { columns, options });
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const pollJob = useCallback(async (id: string, until: (s: string) => boolean): Promise<ImportJob> => {
    for (;;) {
      const res = await api.get<{ job: ImportJob }>(`/api/p/import-jobs/${id}`);
      const j = unwrap(res).job;
      if (until(j.status)) return j;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }, []);

  const runDryRun = async () => {
    if (!job) return;
    if (!(await saveMapping())) return;
    setBusy(true);
    try {
      await api.post(`/api/p/import-jobs/${job.id}/dry-run`);
      const done = await pollJob(job.id, (s) => s === 'DRY_RUN_SUCCEEDED' || s === 'DRY_RUN_FAILED');
      setJob(done);
      const rowsRes = await api.get<{ rows: ImportRow[] }>(`/api/p/import-jobs/${job.id}/rows`);
      setRows(unwrap(rowsRes).rows);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    if (!job) return;
    setBusy(true);
    try {
      await api.post(`/api/p/import-jobs/${job.id}/commit`);
      const done = await pollJob(job.id, (s) => ['SUCCEEDED', 'PARTIAL_SUCCEEDED', 'FAILED'].includes(s));
      setJob(done);
      setStep(6);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const savePreset = async () => {
    if (!presetName.trim()) return;
    try {
      await api.post('/api/p/import-mapping-presets', {
        name: presetName.trim(),
        entityType,
        mapping: { columns, options },
      });
      addToast({ type: 'success', title: t('common.success'), message: t('ie.presetSaved') });
      setShowPresetModal(false);
      setPresetName('');
      const presetRes = await api.get<{ presets: Preset[] }>(`/api/p/import-mapping-presets?entityType=${entityType}`);
      setPresets(unwrap(presetRes).presets);
    } catch (e) {
      fail(e);
    }
  };

  const dryRunOk = job?.status === 'DRY_RUN_SUCCEEDED';

  return (
    <Panel>
      <WizardStepper
        step={step}
        t={t}
      />

      <div className="mt-6">
        {step === 0 && (
          <div className="flex flex-col gap-4 max-w-md">
            <FormInput
              label={t('ie.entity')}
              name="entityType"
              type="select"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as EntityType)}
              options={ENTITY_TYPES.map((v) => ({ value: v, label: t(ENTITY_LABEL_KEYS[v]) }))}
            />
            <div className="flex justify-end">
              <Button onClick={() => setStep(1)}>{t('ie.next')}</Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4 max-w-lg">
            <div className="flex items-center gap-3">
              <FormInput
                label={t('ie.format')}
                name="fileFormat"
                type="select"
                value={fileFormat}
                onChange={(e) => setFileFormat(e.target.value as FileFormat)}
                options={FILE_FORMATS.map((v) => ({ value: v, label: v }))}
              />
              <Button
                variant="tertiary"
                onClick={() => void downloadTemplate()}
                className="mt-6"
              >
                {t('ie.downloadTemplate')}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-7 rounded-lg p-8 text-center text-neutral-11 hover:border-primary-8 transition"
            >
              {file ? `${t('ie.upload.selected')}: ${file.name}` : t('ie.upload.prompt')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.json"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex justify-between">
              <Button
                variant="tertiary"
                onClick={() => setStep(0)}
              >
                {t('ie.back')}
              </Button>
              <Button
                onClick={() => void upload()}
                disabled={busy || !file}
              >
                {t('ie.next')}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            {presets.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-11">{t('ie.map.preset')}:</span>
                {presets.map((p) => (
                  <Button
                    key={p.id}
                    variant="tertiary"
                    onClick={() => {
                      setColumns(p.mapping.columns);
                      setOptions({ ...DEFAULT_OPTIONS, ...p.mapping.options });
                    }}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            )}
            <Table>
              <TableHead>
                <TableHeaderRow>
                  <TableHeaderCell>{t('ie.map.source')}</TableHeaderCell>
                  <TableHeaderCell>{t('ie.map.target')}</TableHeaderCell>
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {headers.map((h) => (
                  <TableRow key={h}>
                    <TableCell>{h}</TableCell>
                    <TableCell>
                      <select
                        className="border border-neutral-7 rounded px-2 py-1 bg-surface"
                        value={columns[h] ?? ''}
                        onChange={(e) => setColumns((prev) => ({ ...prev, [h]: e.target.value }))}
                      >
                        <option value="">{t('ie.map.ignore')}</option>
                        {fields.map((f) => (
                          <option
                            key={f.key}
                            value={f.key}
                          >
                            {f.key}
                            {f.requiredOnCreate ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-between">
              <Button
                variant="tertiary"
                onClick={() => setStep(1)}
              >
                {t('ie.back')}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="tertiary"
                  onClick={() => setShowPresetModal(true)}
                >
                  {t('ie.map.savePreset')}
                </Button>
                <Button onClick={() => setStep(3)}>{t('ie.next')}</Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4 max-w-lg">
            <FormInput
              label={t('ie.options.partialMode')}
              name="partialMode"
              type="select"
              value={options.partialMode}
              onChange={(e) =>
                setOptions((o) => ({ ...o, partialMode: e.target.value as ImportOptions['partialMode'] }))
              }
              options={[
                { value: 'ALL_OR_NOTHING', label: t('ie.options.allOrNothing') },
                { value: 'VALID_ROWS_ONLY', label: t('ie.options.validRowsOnly') },
              ]}
            />
            <OptionToggle
              label={t('ie.options.force')}
              checked={options.force}
              onChange={(v) => setOptions((o) => ({ ...o, force: v }))}
            />
            <OptionToggle
              label={t('ie.options.createMissingSites')}
              checked={options.createMissingSites}
              onChange={(v) => setOptions((o) => ({ ...o, createMissingSites: v }))}
            />
            <OptionToggle
              label={t('ie.options.createMissingCatalog')}
              checked={options.createMissingCatalog}
              onChange={(v) => setOptions((o) => ({ ...o, createMissingCatalog: v }))}
            />
            <OptionToggle
              label={t('ie.options.allowAdminPromotion')}
              checked={options.allowAdminPromotion}
              onChange={(v) => setOptions((o) => ({ ...o, allowAdminPromotion: v }))}
            />
            <div className="flex justify-between">
              <Button
                variant="tertiary"
                onClick={() => setStep(2)}
              >
                {t('ie.back')}
              </Button>
              <Button onClick={() => setStep(4)}>{t('ie.next')}</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => void runDryRun()}
                disabled={busy}
              >
                {busy ? t('ie.dryRun.running') : t('ie.dryRun.run')}
              </Button>
              {job?.dryRunSummary && (
                <SummaryChips
                  summary={job.dryRunSummary}
                  t={t}
                />
              )}
            </div>
            {rows.length > 0 && (
              <RowsTable
                rows={rows}
                t={t}
              />
            )}
            <div className="flex justify-between">
              <Button
                variant="tertiary"
                onClick={() => setStep(3)}
              >
                {t('ie.back')}
              </Button>
              <Button
                onClick={() => setStep(5)}
                disabled={!dryRunOk}
              >
                {t('ie.next')}
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-4 max-w-lg">
            {job?.dryRunSummary && (
              <SummaryChips
                summary={job.dryRunSummary}
                t={t}
              />
            )}
            <div className="flex justify-between">
              <Button
                variant="tertiary"
                onClick={() => setStep(4)}
              >
                {t('ie.back')}
              </Button>
              <Button
                onClick={() => void runCommit()}
                disabled={busy || !dryRunOk}
              >
                {busy ? t('ie.commit.running') : t('ie.commit.run')}
              </Button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-4 max-w-lg">
            <div className="text-lg font-medium">{job?.status}</div>
            {job?.commitSummary && (
              <div className="flex flex-wrap gap-2">
                <Chip
                  label={t('ie.summary.created')}
                  value={job.commitSummary.created}
                  tone="ok"
                />
                <Chip
                  label={t('ie.summary.updated')}
                  value={job.commitSummary.updated}
                  tone="ok"
                />
                <Chip
                  label={t('ie.summary.skipped')}
                  value={job.commitSummary.skipped}
                  tone="warn"
                />
                <Chip
                  label={t('ie.summary.failed')}
                  value={job.commitSummary.failed}
                  tone="err"
                />
              </div>
            )}
            {job?.errorArtifactPath && (
              <Button
                variant="tertiary"
                onClick={() =>
                  void downloadFile(`/api/p/import-jobs/${job.id}/errors`, `import-${job.id}-errors.csv`)
                }
              >
                {t('ie.downloadErrors')}
              </Button>
            )}
            <div>
              <Button onClick={reset}>{t('ie.startOver')}</Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showPresetModal}
        onClose={() => setShowPresetModal(false)}
        title={t('ie.map.savePreset')}
      >
        <div className="flex flex-col gap-4">
          <FormInput
            label={t('ie.map.presetName')}
            name="presetName"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="tertiary"
              onClick={() => setShowPresetModal(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void savePreset()}>{t('ie.map.savePreset')}</Button>
          </div>
        </div>
      </Modal>
    </Panel>
  );
}

function WizardStepper({ step, t }: { step: number; t: T }) {
  const columnCount = STEP_KEYS.length * 2 - 1;

  return (
    <nav
      aria-label="Progress"
      className="mb-6 w-full"
    >
      <ol
        className="grid w-full items-start"
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
      >
        {STEP_KEYS.map((key, i) => {
          const done = i < step;
          const active = i === step;
          const connectorDone = i < step;
          const label = t(key);

          return (
            <Fragment key={key}>
              <li className="flex min-w-0 flex-col items-center px-0.5 sm:px-1">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold transition-colors sm:h-8 sm:w-8 sm:text-xs md:h-9 md:w-9 md:text-sm ${
                    active
                      ? 'bg-primary text-white shadow-md'
                      : done
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                  aria-current={active ? 'step' : undefined}
                  title={label}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span
                  className={`mt-1.5 hidden w-full px-0.5 text-center text-[0.65rem] font-medium leading-tight line-clamp-2 sm:mt-2 sm:block md:text-xs ${
                    active ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </li>
              {i < STEP_KEYS.length - 1 && (
                <li
                  className="flex items-start px-0.5 pt-[0.875rem] sm:px-1 sm:pt-[1.125rem]"
                  aria-hidden
                >
                  <div
                    className={`h-0.5 w-full rounded-full transition-colors ${
                      connectorDone ? 'bg-primary/40' : 'bg-border'
                    }`}
                  />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
      <p
        className="mt-2 text-center text-xs font-medium text-foreground sm:hidden"
        aria-live="polite"
      >
        {t(STEP_KEYS[step])}
      </p>
    </nav>
  );
}

function OptionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function SummaryChips({
  summary,
  t,
}: {
  summary: { total: number; ok: number; warning: number; error: number };
  t: T;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        label={t('ie.summary.total')}
        value={summary.total}
        tone="neutral"
      />
      <Chip
        label={t('ie.summary.ok')}
        value={summary.ok}
        tone="ok"
      />
      <Chip
        label={t('ie.summary.warning')}
        value={summary.warning}
        tone="warn"
      />
      <Chip
        label={t('ie.summary.error')}
        value={summary.error}
        tone="err"
      />
    </div>
  );
}

function Chip({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'ok' | 'warn' | 'err' }) {
  const toneClass = {
    neutral: 'bg-neutral-3 text-neutral-11',
    ok: 'bg-green-3 text-green-11',
    warn: 'bg-amber-3 text-amber-11',
    err: 'bg-red-3 text-red-11',
  }[tone];
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${toneClass}`}>
      {label}: {value}
    </span>
  );
}

function RowsTable({ rows, t }: { rows: ImportRow[]; t: T }) {
  return (
    <Table>
      <TableHead>
        <TableHeaderRow>
          <TableHeaderCell>{t('ie.rows.row')}</TableHeaderCell>
          <TableHeaderCell>{t('ie.rows.severity')}</TableHeaderCell>
          <TableHeaderCell>{t('ie.rows.messages')}</TableHeaderCell>
        </TableHeaderRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.rowNumber}>
            <TableCell>{r.rowNumber}</TableCell>
            <TableCell>
              <span
                className={
                  r.severity === 'ERROR' ? 'text-red-11' : r.severity === 'WARNING' ? 'text-amber-11' : 'text-green-11'
                }
              >
                {r.severity}
              </span>
            </TableCell>
            <TableCell>
              {r.messages.map((m) => (m.field ? `${m.field}: ${m.message}` : m.message)).join('; ')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// --- Export panel -----------------------------------------------------------

function ExportPanel({ t, addToast }: { t: T; addToast: AddToast }) {
  const [entityType, setEntityType] = useState<EntityType>('ASSET');
  const [fileFormat, setFileFormat] = useState<FileFormat>('CSV');
  const [scope, setScope] = useState<Scope>('FULL');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ job: ExportJob }>('/api/p/export-jobs', {
        entityType,
        fileFormat,
        scope,
        filter: null,
      });
      const id = unwrap(res).job.id;
      // Poll until the artifact is ready, then download.
      for (;;) {
        const jobRes = await api.get<{ job: ExportJob }>(`/api/p/export-jobs/${id}`);
        const j = unwrap(jobRes).job;
        if (j.status === 'SUCCEEDED') {
          await downloadFile(
            `/api/p/export-jobs/${id}/download`,
            `${entityType.toLowerCase()}-export.${fileFormat.toLowerCase()}`,
          );
          break;
        }
        if (j.status === 'FAILED') throw new Error('Export failed');
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      addToast({ type: 'error', title: t('common.error'), message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <div className="flex flex-col gap-4 max-w-md">
        <FormInput
          label={t('ie.entity')}
          name="entityType"
          type="select"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value as EntityType)}
          options={ENTITY_TYPES.map((v) => ({ value: v, label: t(ENTITY_LABEL_KEYS[v]) }))}
        />
        <FormInput
          label={t('ie.format')}
          name="fileFormat"
          type="select"
          value={fileFormat}
          onChange={(e) => setFileFormat(e.target.value as FileFormat)}
          options={FILE_FORMATS.map((v) => ({ value: v, label: v }))}
        />
        <FormInput
          label={t('ie.export.scope')}
          name="scope"
          type="select"
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
          options={[{ value: 'FULL', label: t('ie.export.full') }]}
        />
        <div>
          <Button
            onClick={() => void run()}
            disabled={busy}
          >
            {busy ? t('ie.export.preparing') : t('ie.export.run')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

// --- History tab ------------------------------------------------------------

function HistoryTab({ t, addToast }: { t: T; addToast: AddToast }) {
  const [items, setItems] = useState<JobHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchHistory = useCallback(
    async (opts: { page: number }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(opts.page));
        const res = await api.get<ListJobHistoryData>(`/api/p/import-export/history?${params.toString()}`);
        setItems(res.data?.items ?? []);
        setTotal(res.data?.total ?? 0);
        if (res.data?.pageSize) setPageSize(res.data.pageSize);
      } catch (err) {
        const error = err as ApiResponse;
        addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
      } finally {
        setLoading(false);
      }
    },
    [addToast, t],
  );

  useEffect(() => {
    void fetchHistory({ page });
  }, [page, fetchHistory]);

  return (
    <Panel>
      {loading ? (
        <TableSkeleton columns={5} />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>{t('ie.history.type')}</TableHeaderCell>
                <TableHeaderCell>{t('ie.entity')}</TableHeaderCell>
                <TableHeaderCell>{t('ie.history.status')}</TableHeaderCell>
                <TableHeaderCell>{t('ie.history.started')}</TableHeaderCell>
                <TableHeaderCell>{t('ie.history.actions')}</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {items.map((j) => (
                <TableRow key={`${j.kind}-${j.id}`}>
                  <TableCell>{j.kind === 'import' ? t('ie.history.import') : t('ie.history.export')}</TableCell>
                  <TableCell>{t(ENTITY_LABEL_KEYS[j.entityType])}</TableCell>
                  <TableCell>{j.status}</TableCell>
                  <TableCell>{new Date(j.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {j.kind === 'export' && j.status === 'SUCCEEDED' && (
                      <Button
                        variant="tertiary"
                        onClick={() =>
                          void downloadFile(
                            `/api/p/export-jobs/${j.id}/download`,
                            `${j.entityType.toLowerCase()}-export.${j.fileFormat.toLowerCase()}`,
                          )
                        }
                      >
                        {t('ie.export.download')}
                      </Button>
                    )}
                    {j.kind === 'import' && j.errorArtifactPath && (
                      <Button
                        variant="tertiary"
                        onClick={() =>
                          void downloadFile(`/api/p/import-jobs/${j.id}/errors`, `import-${j.id}-errors.csv`)
                        }
                      >
                        {t('ie.downloadErrors')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {total === 0 && <p className="py-8 text-center text-muted">{t('ie.history.empty')}</p>}
          <Pagination
            page={page}
            total={total}
            resultsPerPage={pageSize}
            onPageChange={setPage}
            disabled={loading}
          />
        </>
      )}
    </Panel>
  );
}
