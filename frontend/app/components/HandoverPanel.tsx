import { useCallback, useEffect, useState } from 'react';
import { Button } from '~/components/Button';
import { Panel } from '~/components/Panel';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import type { ApiResponse } from '~/types';
import { api } from '~/utils/api';

interface HandoverRecord {
  id: string;
  dateCreated: string;
  type: 'CHECK_OUT' | 'CHECK_IN';
  status: 'OPEN' | 'CONSUMED' | 'CANCELLED' | 'EXPIRED';
  targetUserId: string;
  expiresAt: string;
  targetUserName: string | null;
  targetUserEmail: string | null;
}

interface HandoverPanelProps {
  assetId: string;
  status: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  /** Reload the parent asset + history after a custody change. */
  onChanged: () => void;
  /** Omit outer Panel wrapper when nested inside asset detail tabs. */
  embedded?: boolean;
}

export function HandoverPanel({
  assetId,
  status,
  assignedUserId,
  assignedUserName,
  onChanged,
  embedded = false,
}: HandoverPanelProps) {
  const { t } = useLanguage();
  const { addToast } = useError();
  const [handovers, setHandovers] = useState<HandoverRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [copyLink, setCopyLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!assetId) return;
    try {
      const res = await api.get<{ handovers: HandoverRecord[]; total: number }>(
        `/api/p/assets/${assetId}/handovers`,
      );
      setHandovers(res.data?.handovers ?? []);
    } catch {
      // Non-fatal: the section just shows no history.
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = handovers.find((h) => h.status === 'OPEN' && new Date(h.expiresAt) > new Date());
  const canCheckin = status === 'ASSIGNED' && !!assignedUserId;

  const refresh = async () => {
    await load();
    onChanged();
  };

  const fail = (err: unknown) =>
    addToast({
      type: 'error',
      title: t('common.error'),
      message: (err as ApiResponse).message || t('common.error'),
    });

  const startHandover = async (type: 'CHECK_OUT' | 'CHECK_IN') => {
    const recipient = type === 'CHECK_IN' ? assignedUserId : null;
    if (!recipient) return;
    setBusy(true);
    setCopyLink(null);
    setCopied(false);
    try {
      const res = await api.post<{ acceptUrl?: string }>(`/api/p/assets/${assetId}/handovers`, {
        type,
        targetUserId: recipient,
        sendEmail: true,
      });
      if (res.data?.acceptUrl) setCopyLink(res.data.acceptUrl);
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const cancelHandover = async (id: string) => {
    if (!window.confirm(t('handover.admin.confirmCancel'))) return;
    setBusy(true);
    try {
      await api.post(`/api/p/handovers/${id}/cancel`);
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const completeHandover = async (id: string) => {
    if (!window.confirm(t('handover.admin.confirmComplete'))) return;
    setBusy(true);
    try {
      await api.post(`/api/p/handovers/${id}/complete`);
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = async () => {
    if (!copyLink) return;
    try {
      await navigator.clipboard.writeText(copyLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const typeLabel = (type: HandoverRecord['type']) =>
    type === 'CHECK_OUT' ? t('handover.admin.typeCheckout') : t('handover.admin.typeCheckin');

  const STATUS_KEYS = {
    OPEN: 'handover.admin.statusOPEN',
    CONSUMED: 'handover.admin.statusCONSUMED',
    CANCELLED: 'handover.admin.statusCANCELLED',
    EXPIRED: 'handover.admin.statusEXPIRED',
  } as const;

  const body = (
      <div className="space-y-4 text-sm">
        {open ? (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{t('handover.admin.openTitle')}</span>
              <span className="text-xs rounded-full bg-primary text-white px-2 py-0.5">
                {typeLabel(open.type)}
              </span>
            </div>
            <div className="text-muted">
              <div>
                {t('handover.admin.target')}: {open.targetUserName ?? open.targetUserEmail ?? '—'}
              </div>
              <div>
                {t('handover.admin.expires')}: {new Date(open.expiresAt).toLocaleString()}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={() => void completeHandover(open.id)} disabled={busy}>
                {t('handover.admin.complete')}
              </Button>
              <Button variant="danger" onClick={() => void cancelHandover(open.id)} disabled={busy}>
                {t('handover.admin.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted">{t('handover.admin.noOpen')}</p>

            {canCheckin && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="font-medium">{t('handover.admin.startCheckin')}</p>
                <p className="text-xs text-muted">{t('handover.admin.checkinHint')}</p>
                <div className="text-muted">
                  {t('handover.admin.target')}: {assignedUserName ?? '—'}
                </div>
                <Button onClick={() => void startHandover('CHECK_IN')} disabled={busy}>
                  {busy ? t('handover.admin.starting') : t('handover.admin.submit')}
                </Button>
              </div>
            )}
          </div>
        )}

        {copyLink && (
          <div className="rounded-lg border border-border bg-surface-alt p-3 space-y-2">
            <div className="break-all text-xs text-muted">{copyLink}</div>
            <Button variant="secondary" onClick={() => void copyToClipboard()}>
              {copied ? t('handover.admin.linkCopied') : t('handover.admin.copyLink')}
            </Button>
          </div>
        )}

        <div>
          <p className="font-medium mb-1">{t('handover.admin.historyTitle')}</p>
          {handovers.length === 0 ? (
            <p className="text-muted">{t('handover.admin.none')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {handovers.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2">
                  <span className="text-muted">
                    {typeLabel(h.type)} · {h.targetUserName ?? h.targetUserEmail ?? '—'}
                  </span>
                  <span className="text-xs text-muted">{t(STATUS_KEYS[h.status])}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
  );

  if (embedded) return body;
  return (
    <Panel title={t('handover.admin.title')} className="mt-6">
      {body}
    </Panel>
  );
}
