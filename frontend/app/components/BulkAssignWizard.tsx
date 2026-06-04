import { useEffect, useMemo, useState } from 'react';
import { Button } from '~/components/Button';
import { Modal } from '~/components/Modal';
import { SearchSelect, type SearchSelectOption } from '~/components/SearchSelect';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import type { ApiResponse, AssetStatus } from '~/types';
import { api, postForBlob } from '~/utils/api';
import type { AssetSelectionItem } from '~/utils/qrPrint';
import type { TranslationKey } from '~/utils/translations';

type Flow = 'CHECK_OUT' | 'CHECK_IN';
type Mode = 'direct' | 'verify';

interface BulkAssignResultData {
  succeeded: { assetId: string }[];
  failed: { assetId: string; code: string; message: string }[];
}

interface BulkAssignWizardProps {
  isOpen: boolean;
  onClose: () => void;
  items: AssetSelectionItem[];
  /** Reused from the assets list so the user picker matches the single-asset form. */
  fetchUserOptions: (search: string) => Promise<SearchSelectOption[]>;
  /** Called with the ids that were successfully assigned (parent clears + refetches). */
  onAssigned: (succeededIds: string[]) => void;
}

/** Decides whether a row can take part in the chosen flow/mode and, if not, why. */
function evaluate(
  item: AssetSelectionItem,
  flow: Flow,
  mode: Mode,
  targetUserId: string,
): { ok: boolean; reasonKey?: TranslationKey } {
  const status: AssetStatus = item.status;
  if (flow === 'CHECK_OUT') {
    if (mode === 'verify') {
      // Verified handover is STOCK-only (the backend enforces this too).
      return status === 'STOCK'
        ? { ok: true }
        : { ok: false, reasonKey: 'bulkAssign.reasonVerifyStockOnly' };
    }
    if (status === 'STOCK' || status === 'MAINTENANCE') return { ok: true };
    if (status === 'ASSIGNED') return { ok: false, reasonKey: 'bulkAssign.reasonAlreadyAssigned' };
    return { ok: false, reasonKey: 'bulkAssign.reasonArchived' };
  }
  // CHECK_IN (return)
  if (status !== 'ASSIGNED') return { ok: false, reasonKey: 'bulkAssign.reasonNotAssigned' };
  if (targetUserId && item.assignedUserId !== targetUserId) {
    return { ok: false, reasonKey: 'bulkAssign.reasonOtherUser' };
  }
  return { ok: true };
}

export function BulkAssignWizard({
  isOpen,
  onClose,
  items,
  fetchUserOptions,
  onAssigned,
}: BulkAssignWizardProps) {
  const { t, language } = useLanguage();
  const { addToast } = useError();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [flow, setFlow] = useState<Flow>('CHECK_OUT');
  const [mode, setMode] = useState<Mode>('direct');
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [targetUserId, setTargetUserId] = useState('');
  const [selectedUserOption, setSelectedUserOption] = useState<SearchSelectOption | null>(null);
  const [userResults, setUserResults] = useState<SearchSelectOption[]>([]);
  const [condition, setCondition] = useState('');
  const [accessories, setAccessories] = useState('');
  const [busy, setBusy] = useState(false);

  // Reset everything whenever the wizard is (re)opened.
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setFlow('CHECK_OUT');
    setMode('direct');
    setRemovedIds(new Set());
    setTargetUserId('');
    setSelectedUserOption(null);
    setUserResults([]);
    setCondition('');
    setAccessories('');
    setBusy(false);
  }, [isOpen]);

  // Returns only ever assign directly; verify is a checkout-only option.
  const effectiveMode: Mode = flow === 'CHECK_OUT' ? mode : 'direct';

  const workingItems = useMemo(
    () => items.filter((i) => !removedIds.has(i.id)),
    [items, removedIds],
  );

  const evaluated = useMemo(
    () => workingItems.map((item) => ({ item, ...evaluate(item, flow, effectiveMode, targetUserId) })),
    [workingItems, flow, effectiveMode, targetUserId],
  );

  const eligible = evaluated.filter((e) => e.ok);
  const ineligible = evaluated.filter((e) => !e.ok);
  const eligibleIds = eligible.map((e) => e.item.id);

  const fetchUsers = async (search: string) => {
    const opts = await fetchUserOptions(search);
    setUserResults(opts);
    return opts;
  };

  const userLabel = selectedUserOption?.label ?? '';

  const fmt = (key: TranslationKey, vars: Record<string, string | number>) => {
    let out = t(key);
    for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
    return out;
  };

  const generatePdf = async () => {
    const blob = await postForBlob(`/api/p/custody-documents/generate-batch?lang=${language}`, {
      type: flow,
      assetIds: eligibleIds,
      targetUserId: targetUserId || null,
      condition: condition || null,
      accessoriesNote: accessories || null,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custody-${flow === 'CHECK_IN' ? 'return' : 'checkout'}-batch.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const submit = async (withPdf: boolean) => {
    if (eligibleIds.length === 0) return;
    setBusy(true);
    try {
      // Generate the receipt before applying the change: a CHECK_IN receipt needs
      // the assets still ASSIGNED, and a CHECK_OUT receipt prints fine while STOCK.
      if (withPdf) await generatePdf();

      const res = await api.post<BulkAssignResultData>('/api/p/asset-assignments/bulk', {
        type: flow,
        mode: effectiveMode,
        targetUserId,
        assetIds: eligibleIds,
      });
      const succeeded = res.data?.succeeded ?? [];
      const failed = res.data?.failed ?? [];
      addToast({
        type: failed.length > 0 ? 'error' : 'success',
        title: t('bulkAssign.resultTitle'),
        message: fmt('bulkAssign.resultBody', { ok: succeeded.length, failed: failed.length }),
      });
      onAssigned(succeeded.map((s) => s.assetId));
      onClose();
    } catch (err) {
      addToast({
        type: 'error',
        title: t('common.error'),
        message: (err as ApiResponse).message || t('common.error'),
      });
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const canAdvanceFrom1 = eligibleIds.length > 0;
  const canAdvanceFrom2 = targetUserId !== '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('bulkAssign.title')}>
      {/* Stepper */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        {[
          { n: 1, label: t('bulkAssign.step1') },
          { n: 2, label: t('bulkAssign.step2') },
          { n: 3, label: t('bulkAssign.step3') },
        ].map((s) => (
          <span
            key={s.n}
            className={`rounded-full px-3 py-1 ${
              step === s.n ? 'bg-primary text-white' : 'bg-surface text-muted border border-border'
            }`}
          >
            {s.n}. {s.label}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm font-medium">{t('bulkAssign.flowLabel')}:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="bulk-flow"
                checked={flow === 'CHECK_OUT'}
                onChange={() => setFlow('CHECK_OUT')}
              />
              {t('bulkAssign.flowCheckout')}
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="bulk-flow"
                checked={flow === 'CHECK_IN'}
                onChange={() => setFlow('CHECK_IN')}
              />
              {t('bulkAssign.flowReturn')}
            </label>
          </div>

          <p className="mb-2 text-sm text-muted">
            {fmt('bulkAssign.eligibleCount', { count: eligible.length })} ·{' '}
            {fmt('bulkAssign.ineligibleCount', { count: ineligible.length })}
          </p>

          <div className="max-h-80 overflow-y-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th className="px-3 py-2 text-left">{t('assets.name')}</th>
                  <th className="px-3 py-2 text-left">{t('assets.serialNumber')}</th>
                  <th className="px-3 py-2 text-left">{t('assets.status')}</th>
                  <th className="px-3 py-2 text-left" />
                </tr>
              </thead>
              <tbody>
                {evaluated.map(({ item, ok, reasonKey }) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">{item.serialNumber}</td>
                    <td className="px-3 py-2">
                      {ok ? (
                        <span className="text-success">{t('bulkAssign.eligible')}</span>
                      ) : (
                        <span className="text-danger">
                          {t('bulkAssign.notEligible')}
                          {reasonKey ? ` — ${t(reasonKey)}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-muted hover:text-danger cursor-pointer"
                        onClick={() => setRemovedIds((prev) => new Set(prev).add(item.id))}
                      >
                        {t('bulkAssign.remove')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="tertiary" onClick={onClose}>
              {t('bulkAssign.cancel')}
            </Button>
            <Button type="button" disabled={!canAdvanceFrom1} onClick={() => setStep(2)}>
              {t('bulkAssign.next')}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <SearchSelect
            label={t('bulkAssign.pickUserLabel')}
            name="bulk-target-user"
            value={targetUserId}
            onChange={(v) => {
              setTargetUserId(v);
              setSelectedUserOption(userResults.find((o) => o.value === v) ?? null);
            }}
            fetchOptions={fetchUsers}
            selectedOption={selectedUserOption}
            emptyOption={{ label: t('assets.selectUser'), value: '' }}
            placeholder={t('assets.selectUser')}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="tertiary" onClick={() => setStep(1)}>
              {t('bulkAssign.back')}
            </Button>
            <Button type="button" disabled={!canAdvanceFrom2} onClick={() => setStep(3)}>
              {t('bulkAssign.next')}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          {flow === 'CHECK_OUT' && (
            <div className="mb-4">
              <span className="mb-1 block text-sm font-medium">{t('bulkAssign.modeLabel')}</span>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bulk-mode"
                  checked={mode === 'direct'}
                  onChange={() => setMode('direct')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{t('bulkAssign.modeDirect')}</span>
                  <span className="block text-sm text-muted">{t('bulkAssign.modeDirectDesc')}</span>
                </span>
              </label>
              <label className="mt-2 flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bulk-mode"
                  checked={mode === 'verify'}
                  onChange={() => setMode('verify')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{t('bulkAssign.modeVerify')}</span>
                  <span className="block text-sm text-muted">{t('bulkAssign.modeVerifyDesc')}</span>
                </span>
              </label>
            </div>
          )}

          {flow === 'CHECK_OUT' && mode === 'verify' && eligibleIds.length > 0 && (
            <p className="mb-3 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              {fmt('bulkAssign.emailWarning', { count: eligibleIds.length })}
            </p>
          )}

          <label className="mb-1 block text-sm font-medium">{t('bulkAssign.condition')}</label>
          <input
            type="text"
            className="mb-3 w-full rounded border border-border bg-input px-3 py-2 text-sm"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          />
          <label className="mb-1 block text-sm font-medium">{t('bulkAssign.accessories')}</label>
          <textarea
            className="mb-3 w-full rounded border border-border bg-input px-3 py-2 text-sm"
            rows={2}
            value={accessories}
            onChange={(e) => setAccessories(e.target.value)}
          />

          <p className="mb-4 text-sm">
            {fmt(flow === 'CHECK_OUT' ? 'bulkAssign.summaryCheckout' : 'bulkAssign.summaryReturn', {
              count: eligibleIds.length,
              user: userLabel,
            })}
          </p>
          {eligibleIds.length === 0 && (
            <p className="mb-3 text-sm text-danger">{t('bulkAssign.noEligible')}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="tertiary" onClick={() => setStep(2)} disabled={busy}>
              {t('bulkAssign.back')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void submit(true)}
              disabled={busy || eligibleIds.length === 0}
            >
              {t('bulkAssign.assignAndPdf')}
            </Button>
            <Button
              type="button"
              onClick={() => void submit(false)}
              disabled={busy || eligibleIds.length === 0}
            >
              {t('bulkAssign.assign')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
