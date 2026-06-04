import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router';
import { Avatar } from '~/components/Avatar';
import { SeverityBadge, SEVERITY_ITEM_ACCENT, SEVERITY_ITEM_HOVER } from '~/components/SeverityBadge';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import type { ApiResponse, DataQualityIssue, DataQualityRow, ListAlertsData } from '~/types';
import { api } from '~/utils/api';
import { onAlertsChanged } from '~/utils/alertsBus';
import type { TranslationKey } from '~/utils/translations';

const ISSUE_LABEL_KEYS: Record<DataQualityIssue, TranslationKey> = {
  INACTIVE_USER_ASSIGNED: 'issues.INACTIVE_USER_ASSIGNED',
  ASSIGNED_WITHOUT_USER: 'issues.ASSIGNED_WITHOUT_USER',
  WARRANTY_EXPIRED: 'issues.WARRANTY_EXPIRED',
  WARRANTY_EXPIRING_SOON: 'issues.WARRANTY_EXPIRING_SOON',
  RETURN_OVERDUE: 'issues.RETURN_OVERDUE',
  RETURN_DUE_SOON: 'issues.RETURN_DUE_SOON',
};

function NotificationAssignee({
  row,
  onUserClick,
}: {
  row: DataQualityRow;
  onUserClick: (e: ReactMouseEvent) => void;
}) {
  const { t } = useLanguage();

  if (!row.assignedUserId || !row.assignedUserName) {
    return (
      <span className="text-xs text-muted">
        {t('reports.assignee')}: {t('assets.unassigned')}
      </span>
    );
  }

  const label = row.assignedUserEmail
    ? `${row.assignedUserName} (${row.assignedUserEmail})`
    : row.assignedUserName;

  return (
    <div className="flex items-center gap-2 min-w-0 text-xs">
      <span className="text-muted shrink-0">{t('reports.assignee')}:</span>
      <Link
        to={`/admin/users/${row.assignedUserId}`}
        className="flex items-center gap-1.5 min-w-0 no-underline text-foreground hover:text-primary"
        onClick={onUserClick}
      >
        <Avatar
          userId={row.assignedUserId}
          name={row.assignedUserName}
          hasAvatar={row.assignedUserAvatarFilename}
          size={20}
        />
        <span className="truncate" title={label}>
          {label}
        </span>
      </Link>
    </div>
  );
}

export function NotificationBell() {
  const { addToast } = useError();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [alerts, setAlerts] = useState<DataQualityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ListAlertsData>('/api/p/alerts?limit=15&excludeDismissed=true');
      setAlerts(res.data?.alerts ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  useEffect(() => {
    void fetchAlerts();
    const id = setInterval(() => void fetchAlerts(), 60_000);
    // Refetch immediately when a dismiss/undo elsewhere (e.g. the overview) changes the set,
    // so the badge count stays in sync without waiting for the poll or a reload.
    const off = onAlertsChanged(() => void fetchAlerts());
    return () => {
      clearInterval(id);
      off();
    };
  }, [fetchAlerts]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const stopNav = (e: ReactMouseEvent) => e.stopPropagation();

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        data-testid="notification-bell"
        className="relative p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-alt transition-colors cursor-pointer"
        aria-label={t('alerts.title')}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void fetchAlerts();
        }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {total > 0 && (
          <span
            data-testid="notification-bell-badge"
            className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center rounded-full bg-danger text-white text-[0.625rem] font-semibold"
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[min(28rem,calc(100vw-1.5rem))] max-h-[32rem] overflow-auto bg-surface border border-border rounded-lg shadow-lg z-[200]"
          data-testid="notification-panel"
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <span className="font-medium text-sm">{t('alerts.title')}</span>
            {total > 0 && (
              <span className="text-xs text-muted tabular-nums">
                {alerts.length < total ? `${alerts.length} / ${total}` : total}
              </span>
            )}
          </div>

          {loading && alerts.length === 0 ? (
            <p className="text-muted text-sm p-4">{t('common.loading')}</p>
          ) : alerts.length === 0 ? (
            <p className="text-muted text-sm p-4">{t('alerts.empty')}</p>
          ) : (
            <ul className="py-1">
              {alerts.map((row) => (
                <li key={`${row.issue}-${row.assetId}`}>
                  <Link
                    to={`/admin/assets/${row.assetId}`}
                    data-testid={`notification-item-${row.assetId}`}
                    className={`block mx-1 my-1 px-3 py-2.5 rounded-md no-underline text-foreground transition-colors ${SEVERITY_ITEM_ACCENT[row.severity]} ${SEVERITY_ITEM_HOVER[row.severity]}`}
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-xs font-medium leading-snug pr-1">{t(ISSUE_LABEL_KEYS[row.issue])}</span>
                      <SeverityBadge severity={row.severity} />
                    </div>
                    <div className="text-sm font-semibold leading-tight mb-0.5">{row.assetName}</div>
                    <div className="text-xs font-mono text-muted mb-1.5">{row.serialNumber}</div>
                    {row.detail && (
                      <p className="text-xs text-muted mb-1.5 line-clamp-2" title={row.detail}>
                        {row.detail}
                      </p>
                    )}
                    <NotificationAssignee row={row} onUserClick={stopNav} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-border p-3">
            <Link
              to="/admin/reports"
              className="block text-center text-sm text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              {t('alerts.viewAll')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
