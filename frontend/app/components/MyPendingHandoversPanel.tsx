import { useCallback, useEffect, useState } from 'react';
import { Button } from '~/components/Button';
import { Panel } from '~/components/Panel';
import { HandoverTypeBadge } from '~/components/HandoverTypeBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from '~/components/Table';
import { TableCellText } from '~/components/TableCellText';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import type { ApiResponse, HandoverType, ListPendingHandoversData, PendingHandover } from '~/types';
import { api } from '~/utils/api';

const SUCCESS_KEY: Record<HandoverType, 'handover.my.confirmedCheckout' | 'handover.my.confirmedCheckin'> = {
  CHECK_OUT: 'handover.my.confirmedCheckout',
  CHECK_IN: 'handover.my.confirmedCheckin',
};

interface MyPendingHandoversPanelProps {
  isReady: boolean;
  className?: string;
  onChanged?: () => void;
}

export function MyPendingHandoversPanel({ isReady, className = 'mb-6', onChanged }: MyPendingHandoversPanelProps) {
  const { t } = useLanguage();
  const { addToast } = useError();
  const [handovers, setHandovers] = useState<PendingHandover[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const fetchHandovers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ListPendingHandoversData>('/api/me/handovers');
      setHandovers(res.data?.handovers ?? []);
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  useEffect(() => {
    if (!isReady) return;
    void fetchHandovers();
  }, [isReady, fetchHandovers]);

  const handleConfirm = async (handover: PendingHandover) => {
    setConfirmingId(handover.id);
    try {
      await api.post(`/api/me/handovers/${handover.id}/accept`);
      addToast({
        type: 'success',
        title: t('common.success'),
        message: t(SUCCESS_KEY[handover.type]),
      });
      await fetchHandovers();
      onChanged?.();
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setConfirmingId(null);
    }
  };

  if (loading || handovers.length === 0) return null;

  return (
    <Panel
      title={t('handover.my.pendingTitle')}
      className={className}
    >
      <p className="text-sm text-muted mb-4">{t('handover.my.pendingHint')}</p>
      <Table>
        <TableHead>
          <TableHeaderRow>
            <TableHeaderCell>{t('handover.my.pendingType')}</TableHeaderCell>
            <TableHeaderCell>{t('handover.my.pendingAsset')}</TableHeaderCell>
            <TableHeaderCell>{t('handover.my.pendingSerial')}</TableHeaderCell>
            <TableHeaderCell>{t('handover.my.pendingExpires')}</TableHeaderCell>
            <TableHeaderCell last />
          </TableHeaderRow>
        </TableHead>
        <TableBody>
          {handovers.map((h) => (
            <TableRow
              key={h.id}
              striped
              data-testid={`my-pending-handover-${h.id}`}
            >
              <TableCell>
                <HandoverTypeBadge type={h.type} />
              </TableCell>
              <TableCell>
                <TableCellText value={h.assetName} className="font-medium" />
              </TableCell>
              <TableCell className="font-mono">
                <TableCellText value={h.assetSerialNumber} />
              </TableCell>
              <TableCell className="text-xs text-muted whitespace-nowrap">
                {new Date(h.expiresAt).toLocaleString()}
              </TableCell>
              <TableCell last className="text-right">
                <Button
                  className="!px-4 !py-1.5 !text-sm"
                  disabled={confirmingId === h.id}
                  onClick={() => void handleConfirm(h)}
                >
                  {confirmingId === h.id ? t('handover.my.confirming') : t('handover.my.confirm')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
