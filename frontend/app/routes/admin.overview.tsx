import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AssetImageHoverPreview } from '~/components/AssetImageHoverPreview';
import { DataQualityAssigneeCell } from '~/components/DataQualityAssigneeCell';
import { HistoryTable } from '~/components/HistoryTable';
import { DashboardOverviewSkeleton } from '~/components/LoadingSkeleton';
import { LocationMap, type MapMarker } from '~/components/Map';
import { PageContent } from '~/components/PageContent';
import { Panel } from '~/components/Panel';
import { SeverityBadge } from '~/components/SeverityBadge';
import { StatCard } from '~/components/StatCard';
import { HandoverTypeBadge } from '~/components/HandoverTypeBadge';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '~/components/Table';
import { TableCellText } from '~/components/TableCellText';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type {
  ApiResponse,
  AssetMapMarker,
  AssetStatus,
  AttentionCounts,
  DashboardStats,
  DataQualityIssue,
  DataQualityRow,
  Handover,
  ListAlertsData,
  ListAssetMapMarkersData,
  ListHandoversData,
  ListTransactionsData,
  Site,
  Transaction,
} from '~/types';
import { api } from '~/utils/api';
import { emitAlertsChanged } from '~/utils/alertsBus';
import type { TranslationKey } from '~/utils/translations';

import {
  ASSET_STATUS_CHART_COLOR,
  ASSET_STATUS_LABEL_KEYS,
  ASSET_STATUS_ORDER,
} from '~/utils/assetStatus';

const ISSUE_LABEL_KEYS: Record<DataQualityIssue, TranslationKey> = {
  INACTIVE_USER_ASSIGNED: 'issues.INACTIVE_USER_ASSIGNED',
  ASSIGNED_WITHOUT_USER: 'issues.ASSIGNED_WITHOUT_USER',
  WARRANTY_EXPIRED: 'issues.WARRANTY_EXPIRED',
  WARRANTY_EXPIRING_SOON: 'issues.WARRANTY_EXPIRING_SOON',
  RETURN_OVERDUE: 'issues.RETURN_OVERDUE',
  RETURN_DUE_SOON: 'issues.RETURN_DUE_SOON',
};

const ATTENTION_TILES: { issue: DataQualityIssue; countKey: keyof AttentionCounts }[] = [
  { issue: 'RETURN_OVERDUE', countKey: 'returnOverdueCount' },
  { issue: 'INACTIVE_USER_ASSIGNED', countKey: 'inactiveUserAssignedCount' },
  { issue: 'ASSIGNED_WITHOUT_USER', countKey: 'assignedWithoutUserCount' },
  { issue: 'WARRANTY_EXPIRED', countKey: 'warrantyExpiredCount' },
  { issue: 'RETURN_DUE_SOON', countKey: 'returnDueSoon7DaysCount' },
  { issue: 'WARRANTY_EXPIRING_SOON', countKey: 'warrantyExpiring30DaysCount' },
];

const TOOLTIP_STYLE = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-foreground)',
} as const;

const AXIS_TICK = { fill: 'var(--color-muted)', fontSize: 12 } as const;

const COMPACT_PANEL = '!p-4 [&_h2]:!text-base [&_h2]:!mb-2';

function ChartFrame({ children, className = 'h-44' }: { children: ReactElement; className?: string }) {
  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const iconClass = 'w-5 h-5';
const boxIcon = (
  <svg
    className={iconClass}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line
      x1="12"
      y1="22.08"
      x2="12"
      y2="12"
    />
  </svg>
);
const userIcon = (
  <svg
    className={iconClass}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle
      cx="12"
      cy="7"
      r="4"
    />
  </svg>
);
const pinIcon = (
  <svg
    className={iconClass}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle
      cx="12"
      cy="10"
      r="3"
    />
  </svg>
);
const checkIcon = (
  <svg
    className={iconClass}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const factoryIcon = (
  <svg
    className={iconClass}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 20h20" />
    <path d="M7 20V10l5-3 5 3v10" />
    <path d="M7 14h10" />
  </svg>
);
const cartIcon = (
  <svg
    className={iconClass}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle
      cx="9"
      cy="21"
      r="1"
    />
    <circle
      cx="20"
      cy="21"
      r="1"
    />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

function DiscardIconButton({
  onClick,
  title,
  'data-testid': dataTestid,
}: {
  onClick: () => void;
  title: string;
  'data-testid'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      data-testid={dataTestid}
      className="inline-flex items-center justify-center p-1.5 rounded transition-colors cursor-pointer bg-transparent text-muted border border-border hover:not-disabled:bg-surface-alt hover:text-danger"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

export const meta = pageMeta('nav.overview');

export default function AdminOverview() {
  usePageTitle('nav.overview');
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [mapAssets, setMapAssets] = useState<AssetMapMarker[]>([]);
  const [attentionAlerts, setAttentionAlerts] = useState<DataQualityRow[]>([]);
  const [pendingHandovers, setPendingHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);
  const [txSearch, setTxSearch] = useState('');
  const [txLoading, setTxLoading] = useState(true);

  const statusLabel = useCallback((s: AssetStatus) => t(ASSET_STATUS_LABEL_KEYS[s]), [t]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, sitesRes, alertsRes, handoversRes, markersRes] = await Promise.all([
        api.get<DashboardStats>('/api/p/stats/overview'),
        api.get<{ sites: Site[] }>('/api/p/sites'),
        api.get<ListAlertsData>('/api/p/alerts?limit=10&excludeDismissed=true'),
        api.get<ListHandoversData>('/api/p/handovers'),
        api.get<ListAssetMapMarkersData>('/api/p/assets/map-markers'),
      ]);
      setStats(statsRes.data ?? null);
      setSites(sitesRes.data?.sites ?? []);
      setMapAssets(markersRes.data?.markers ?? []);
      setAttentionAlerts(alertsRes.data?.alerts ?? []);
      setPendingHandovers(
        (handoversRes.data?.handovers ?? []).filter(
          (h) => h.status === 'OPEN' && new Date(h.expiresAt) > new Date(),
        ),
      );
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  // Refresh only the needs-attention list (avoids reloading the whole dashboard,
  // which also refetches the map markers).
  const refetchAttentionAlerts = useCallback(async () => {
    try {
      const res = await api.get<ListAlertsData>('/api/p/alerts?limit=10&excludeDismissed=true');
      setAttentionAlerts(res.data?.alerts ?? []);
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    }
  }, [addToast, t]);

  const handleUndoDiscard = useCallback(
    async (assetId: string, issue: DataQualityIssue) => {
      try {
        await api.delete('/api/p/reports/data-quality/dismiss', { assetId, issue });
        await refetchAttentionAlerts();
        emitAlertsChanged();
      } catch (err) {
        const error = err as ApiResponse;
        addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
      }
    },
    [addToast, refetchAttentionAlerts, t],
  );

  const handleDiscard = useCallback(
    async (assetId: string, issue: DataQualityIssue) => {
      try {
        await api.post('/api/p/reports/data-quality/dismiss', { assetId, issue });
        await refetchAttentionAlerts();
        emitAlertsChanged();
        addToast({
          type: 'success',
          title: t('dashboard.discardReportSuccess'),
          message: '',
          action: { label: t('common.undo'), onClick: () => void handleUndoDiscard(assetId, issue) },
        });
      } catch (err) {
        const error = err as ApiResponse;
        addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
      }
    },
    [addToast, handleUndoDiscard, refetchAttentionAlerts, t],
  );

  const fetchTransactions = useCallback(
    async (opts: { search: string; page: number }) => {
      setTxLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        params.set('page', String(opts.page));
        const res = await api.get<ListTransactionsData>(`/api/p/transactions?${params.toString()}`);
        setTransactions(res.data?.transactions ?? []);
        setTxTotal(res.data?.total ?? 0);
        if (res.data?.pageSize) setTxPageSize(res.data.pageSize);
      } catch (err) {
        const error = err as ApiResponse;
        addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
      } finally {
        setTxLoading(false);
      }
    },
    [addToast, t],
  );

  useEffect(() => {
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/dashboard', { replace: true });
    }
  }, [userLoading, user, navigate]);

  useEffect(() => {
    if (isAdmin) void fetchAnalytics();
  }, [isAdmin, fetchAnalytics]);

  useEffect(() => {
    if (!isAdmin) return;
    const handle = setTimeout(() => {
      void fetchTransactions({ search: txSearch, page: txPage });
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdmin, txSearch, txPage, fetchTransactions]);

  const statusData = useMemo(
    () =>
      ASSET_STATUS_ORDER.map((s) => ({
        name: statusLabel(s),
        status: s,
        value: stats?.assetsByStatus.find((x) => x.status === s)?.count ?? 0,
        color: ASSET_STATUS_CHART_COLOR[s],
      })),
    [stats?.assetsByStatus, statusLabel],
  );

  const utilizationData = useMemo(
    () =>
      statusData.map((d) => ({
        name: d.name,
        count: d.value,
        color: d.color,
        status: d.status,
      })),
    [statusData],
  );

  const siteData = useMemo(
    () =>
      (stats?.assetsBySite ?? []).map((s) => ({ name: s.siteName ?? t('assets.noSite'), count: s.count })).slice(0, 5),
    [stats?.assetsBySite, t],
  );

  const manufacturerData = useMemo(() => {
    const rows = (stats?.assetsByManufacturer ?? [])
      .filter((m) => m.count > 0)
      .map((m) => ({
        name: m.manufacturerName ?? t('assets.noManufacturer'),
        count: m.count,
      }))
      .slice(0, 5);
    return rows;
  }, [stats?.assetsByManufacturer, t]);

  const vendorData = useMemo(() => {
    const rows = (stats?.assetsByVendor ?? [])
      .filter((v) => v.count > 0)
      .map((v) => ({
        name: v.vendorName ?? t('assets.noVendor'),
        count: v.count,
      }))
      .slice(0, 5);
    return rows;
  }, [stats?.assetsByVendor, t]);

  const siteMarkers: MapMarker[] = useMemo(
    () =>
      sites
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({ id: s.id, lat: s.latitude, lng: s.longitude, label: `${s.name} — ${s.assetCount}` })),
    [sites],
  );

  const assetMarkers: MapMarker[] = useMemo(
    // The endpoint only returns assets that resolve to a coordinate, so no filtering needed.
    () =>
      mapAssets.map((a) => ({
        id: a.id,
        lat: a.effectiveLatitude,
        lng: a.effectiveLongitude,
        label: a.siteName ? `${a.name} — ${a.siteName}` : a.name,
      })),
    [mapAssets],
  );

  const hasStatusData = statusData.some((d) => d.value > 0);
  const hasUtilizationData = utilizationData.some((d) => d.count > 0);
  const assignedRate = stats?.totals.assets
    ? Math.round(((stats.totals.assignedAssets ?? 0) / stats.totals.assets) * 100)
    : 0;

  if (!isAdmin) return null;

  return (
    <PageContent size="wide">
      <h1 className="text-3xl font-semibold mb-1">{t('dashboard.title')}</h1>
      <p className="text-muted mb-6">
        {t('dashboard.welcome')}
        {user?.displayName ? `, ${user.displayName}` : ''}!
      </p>

      {loading ? (
        <DashboardOverviewSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <StatCard
              label={t('dashboard.totalAssets')}
              value={stats?.totals.assets ?? 0}
              icon={boxIcon}
              accent="bg-primary/15 text-primary"
            />
            <StatCard
              label={t('dashboard.assignedAssets')}
              value={stats?.totals.assignedAssets ?? 0}
              icon={checkIcon}
              accent="bg-success/15 text-success"
            />
            <StatCard
              label={t('dashboard.totalSites')}
              value={stats?.totals.sites ?? 0}
              icon={pinIcon}
              accent="bg-warning/15 text-warning"
            />
            <StatCard
              label={t('dashboard.totalUsers')}
              value={stats?.totals.users ?? 0}
              icon={userIcon}
              accent="bg-secondary/15 text-secondary"
            />
            <StatCard
              label={t('dashboard.totalManufacturers')}
              value={stats?.totals.manufacturers ?? 0}
              icon={factoryIcon}
              accent="bg-primary/15 text-primary"
            />
            <StatCard
              label={t('dashboard.totalVendors')}
              value={stats?.totals.vendors ?? 0}
              icon={cartIcon}
              accent="bg-warning/15 text-warning"
            />
          </div>

          {stats?.attention && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              {ATTENTION_TILES.map(({ issue, countKey }) => {
                const count = stats.attention[countKey];
                return (
                  <Link
                    key={issue}
                    to={`/admin/reports?issue=${issue}`}
                    className="no-underline"
                    data-testid={`attention-tile-${issue}`}
                  >
                    <StatCard
                      label={t(ISSUE_LABEL_KEYS[issue])}
                      value={count}
                      accent={count > 0 ? 'bg-danger/15 text-danger' : 'bg-muted/15 text-muted'}
                    />
                  </Link>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <Panel title={t('dashboard.needsAttention')}>
              {attentionAlerts.length === 0 ? (
                <p className="text-muted text-sm py-6 text-center">{t('dashboard.attentionEmpty')}</p>
              ) : (
                <Table>
                  <TableHead>
                    <TableHeaderRow>
                      <TableHeaderCell>{t('reports.issue')}</TableHeaderCell>
                      <TableHeaderCell>{t('reports.severity')}</TableHeaderCell>
                      <TableHeaderCell>{t('reports.asset')}</TableHeaderCell>
                      <TableHeaderCell>{t('reports.serial')}</TableHeaderCell>
                      <TableHeaderCell>{t('reports.assignee')}</TableHeaderCell>
                      <TableHeaderCell last>{t('common.actions')}</TableHeaderCell>
                    </TableHeaderRow>
                  </TableHead>
                  <TableBody>
                    {attentionAlerts.map((row) => (
                      <TableRow
                        key={`${row.issue}-${row.assetId}`}
                        striped
                        data-testid={`attention-row-${row.assetId}`}
                        onClick={() => void navigate(`/admin/assets/${row.assetId}`)}
                      >
                        <TableCell>
                          <TableCellText value={t(ISSUE_LABEL_KEYS[row.issue])} />
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={row.severity} />
                        </TableCell>
                        <TableCell>
                          <TableCellText value={row.assetName} className="text-primary font-medium" />
                        </TableCell>
                        <TableCell className="font-mono">
                          <TableCellText value={row.serialNumber} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DataQualityAssigneeCell
                            userId={row.assignedUserId}
                            name={row.assignedUserName}
                            email={row.assignedUserEmail}
                            avatarFilename={row.assignedUserAvatarFilename}
                            onLinkClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell last onClick={(e) => e.stopPropagation()}>
                          <DiscardIconButton
                            title={t('dashboard.discardReport')}
                            onClick={() => void handleDiscard(row.assetId, row.issue)}
                            data-testid={`attention-dismiss-${row.issue}-${row.assetId}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-3 pt-2 border-t border-border">
                <Link to="/admin/reports" className="text-sm text-primary hover:underline">
                  {t('dashboard.viewAllReports')}
                </Link>
              </div>
            </Panel>

            <Panel title={t('handover.admin.pendingTitle')}>
              {pendingHandovers.length === 0 ? (
                <p className="text-muted text-sm py-6 text-center">{t('handover.admin.pendingEmpty')}</p>
              ) : (
                <Table>
                  <TableHead>
                    <TableHeaderRow>
                      <TableHeaderCell>{t('handover.admin.pendingType')}</TableHeaderCell>
                      <TableHeaderCell>{t('handover.admin.pendingAsset')}</TableHeaderCell>
                      <TableHeaderCell>{t('handover.admin.pendingSerial')}</TableHeaderCell>
                      <TableHeaderCell>{t('handover.admin.pendingRecipient')}</TableHeaderCell>
                      <TableHeaderCell last>{t('handover.admin.pendingExpires')}</TableHeaderCell>
                    </TableHeaderRow>
                  </TableHead>
                  <TableBody>
                    {pendingHandovers.map((h) => (
                      <TableRow
                        key={h.id}
                        striped
                        data-testid={`pending-handover-row-${h.id}`}
                        onClick={() => void navigate(`/admin/assets/${h.assetId}`)}
                      >
                        <TableCell>
                          <HandoverTypeBadge type={h.type} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Link
                            to={`/admin/assets/${h.assetId}`}
                            className="flex items-center gap-2 no-underline text-foreground hover:text-primary min-w-0"
                          >
                            <AssetImageHoverPreview
                              assetId={h.assetId}
                              name={h.assetName}
                              hasImage={h.assetImageFilename}
                              size={24}
                            />
                            <TableCellText value={h.assetName} className="font-medium" />
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono" onClick={(e) => e.stopPropagation()}>
                          <Link
                            to={`/admin/assets/${h.assetId}`}
                            className="no-underline text-foreground hover:text-primary"
                          >
                            <TableCellText value={h.assetSerialNumber} />
                          </Link>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DataQualityAssigneeCell
                            userId={h.targetUserId}
                            name={h.targetUserName ?? h.targetUserEmail}
                            email={h.targetUserEmail}
                            avatarFilename={h.targetUserAvatarFilename}
                            onLinkClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell last className="text-xs text-muted">
                          {new Date(h.expiresAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-3 pt-2 border-t border-border">
                <Link to="/admin/assets" className="text-sm text-primary hover:underline">
                  {t('handover.admin.viewAllHandovers')}
                </Link>
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <Panel
              title={t('dashboard.assetsByStatus')}
              className={COMPACT_PANEL}
            >
              {hasStatusData ? (
                <ChartFrame>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={32}
                      outerRadius={52}
                      paddingAngle={2}
                    >
                      {statusData.map((d) => (
                        <Cell
                          key={d.status}
                          fill={d.color}
                          stroke="var(--color-surface)"
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ChartFrame>
              ) : (
                <p className="text-muted text-sm py-4 text-center">{t('dashboard.noData')}</p>
              )}
            </Panel>

            <Panel
              title={t('dashboard.assetsBySite')}
              className={COMPACT_PANEL}
            >
              {siteData.length > 0 ? (
                <ChartFrame>
                  <BarChart
                    data={siteData}
                    margin={{ top: 4, right: 4, bottom: 4, left: -20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={AXIS_TICK}
                      interval={0}
                      tickLine={false}
                      height={28}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={AXIS_TICK}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: 'var(--color-surface-alt)' }}
                    />
                    <Bar
                      dataKey="count"
                      name={t('dashboard.totalAssets')}
                      fill="var(--color-primary)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ChartFrame>
              ) : (
                <p className="text-muted text-sm py-4 text-center">{t('dashboard.noData')}</p>
              )}
            </Panel>

            <Panel
              title={t('dashboard.utilization')}
              className={COMPACT_PANEL}
            >
              {hasUtilizationData ? (
                <>
                  <ChartFrame>
                    <BarChart
                      data={utilizationData}
                      margin={{ top: 4, right: 4, bottom: 4, left: -20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={AXIS_TICK}
                        interval={0}
                        tickLine={false}
                        height={28}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={AXIS_TICK}
                        width={28}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        cursor={{ fill: 'var(--color-surface-alt)' }}
                      />
                      <Bar
                        dataKey="count"
                        name={t('dashboard.totalAssets')}
                        radius={[3, 3, 0, 0]}
                      >
                        {utilizationData.map((d) => (
                          <Cell
                            key={d.status}
                            fill={d.color}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartFrame>
                  <p className="text-xs text-muted mt-1">
                    {t('dashboard.assignedAssets')}: {assignedRate}%
                  </p>
                </>
              ) : (
                <p className="text-muted text-sm py-4 text-center">{t('dashboard.noData')}</p>
              )}
            </Panel>

            <Panel
              title={t('dashboard.assetsByManufacturer')}
              className={COMPACT_PANEL}
            >
              {manufacturerData.length > 0 ? (
                <ChartFrame>
                  <BarChart
                    data={manufacturerData}
                    margin={{ top: 4, right: 4, bottom: 4, left: -20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={AXIS_TICK}
                      interval={0}
                      tickLine={false}
                      height={28}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={AXIS_TICK}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: 'var(--color-surface-alt)' }}
                    />
                    <Bar
                      dataKey="count"
                      name={t('manufacturers.assetCount')}
                      fill="var(--color-secondary)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ChartFrame>
              ) : (
                <p className="text-muted text-sm py-4 text-center">{t('dashboard.noData')}</p>
              )}
            </Panel>

            <Panel
              title={t('dashboard.assetsByVendor')}
              className={COMPACT_PANEL}
            >
              {vendorData.length > 0 ? (
                <ChartFrame>
                  <BarChart
                    data={vendorData}
                    margin={{ top: 4, right: 4, bottom: 4, left: -20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={AXIS_TICK}
                      interval={0}
                      tickLine={false}
                      height={28}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={AXIS_TICK}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: 'var(--color-surface-alt)' }}
                    />
                    <Bar
                      dataKey="count"
                      name={t('vendors.assetCount')}
                      fill="var(--color-warning)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ChartFrame>
              ) : (
                <p className="text-muted text-sm py-4 text-center">{t('dashboard.noData')}</p>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            {(siteMarkers.length > 0 || assetMarkers.length > 0) && (
              <div className="flex flex-col gap-6">
                {siteMarkers.length > 0 && (
                  <Panel title={t('dashboard.sitesMap')}>
                    <LocationMap
                      markers={siteMarkers}
                      className="h-64 w-full rounded-lg z-0"
                    />
                  </Panel>
                )}
                {assetMarkers.length > 0 && (
                  <Panel title={t('dashboard.assetsMap')}>
                    <LocationMap
                      markers={assetMarkers}
                      className="h-64 w-full rounded-lg z-0"
                    />
                  </Panel>
                )}
              </div>
            )}

            <Panel
              title={t('history.latestTitle')}
              className={siteMarkers.length === 0 && assetMarkers.length === 0 ? 'xl:col-span-2' : undefined}
            >
              <HistoryTable
                transactions={transactions}
                loading={txLoading}
                page={txPage}
                total={txTotal}
                pageSize={txPageSize}
                onPageChange={setTxPage}
                search={{
                  value: txSearch,
                  onChange: (v) => {
                    setTxSearch(v);
                    setTxPage(1);
                  },
                }}
                showActor
                showUser
                linkToDetails
              />
            </Panel>
          </div>
        </>
      )}
    </PageContent>
  );
}
