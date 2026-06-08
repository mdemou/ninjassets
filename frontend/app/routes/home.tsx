import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AssetStatusBadge } from '~/components/AssetStatusBadge';
import { HistoryTable } from '~/components/HistoryTable';
import { PersonalDashboardSkeleton } from '~/components/LoadingSkeleton';
import { MyPendingHandoversPanel } from '~/components/MyPendingHandoversPanel';
import { LocationMap, type MapMarker } from '~/components/Map';
import { PageContent } from '~/components/PageContent';
import { Panel } from '~/components/Panel';
import { StatCard } from '~/components/StatCard';
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
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type {
  ApiResponse,
  ListMyAssetsData,
  ListMyTransactionsData,
  MyAssetListItem,
  MyTransactionListItem,
} from '~/types';
import { api } from '~/utils/api';
import { ASSET_STATUS_LABEL_KEYS } from '~/utils/assetStatus';

export const meta = pageMeta('dashboard.title');

const RECENT_ASSETS_LIMIT = 5;

const boxIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const arrowIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);

const importExportIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" />
  </svg>
);

export default function Home() {
  usePageTitle('dashboard.title');
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  // Personal dashboard — available to everyone, including admins (who also have
  // a separate analytics dashboard). It always scopes to the caller's own data.
  const isReady = isAuthReady && !userLoading;

  const [myAssets, setMyAssets] = useState<MyAssetListItem[]>([]);
  const [myAssetsTotal, setMyAssetsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [assetsRefreshKey, setAssetsRefreshKey] = useState(0);

  const [transactions, setTransactions] = useState<MyTransactionListItem[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);
  const [txLoading, setTxLoading] = useState(true);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ListMyAssetsData>('/api/me/assets?page=1');
      setMyAssets(res.data?.assets ?? []);
      setMyAssetsTotal(res.data?.total ?? 0);
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  const fetchHistory = useCallback(
    async (page: number) => {
      setTxLoading(true);
      try {
        const res = await api.get<ListMyTransactionsData>(`/api/me/transactions?page=${page}`);
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
    if (isReady) void fetchAssets();
  }, [isReady, fetchAssets, assetsRefreshKey]);

  useEffect(() => {
    if (isReady) void fetchHistory(txPage);
  }, [isReady, txPage, fetchHistory]);

  if (!isReady) return null;

  const markers: MapMarker[] = myAssets
    .filter((a) => a.effectiveLatitude != null && a.effectiveLongitude != null)
    .map((a) => ({
      id: a.id,
      lat: a.effectiveLatitude as number,
      lng: a.effectiveLongitude as number,
      label: a.siteName ? `${a.name} — ${a.siteName}` : a.name,
    }));

  const recentAssets = myAssets.slice(0, RECENT_ASSETS_LIMIT);
  const showEmptyAssets = !loading && myAssetsTotal === 0;
  const showRecentAssets = !loading && recentAssets.length > 0;
  const isAdmin = user?.roleName === 'ADMIN';

  return (
    <PageContent size="wide">
      <h1 className="text-3xl font-semibold mb-1">{t('dashboard.title')}</h1>
      <p className="text-sm text-muted mb-4">
        {t('dashboard.welcome')}
        {user?.displayName ? `, ${user.displayName}` : ''}!
      </p>

      <MyPendingHandoversPanel
        isReady={isReady}
        onChanged={() => {
          setAssetsRefreshKey((k) => k + 1);
          void fetchHistory(txPage);
        }}
      />

      {loading ? (
        <PersonalDashboardSkeleton className="mb-6" />
      ) : (
        <>
          <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 mb-6`}>
            <StatCard
              label={t('dashboard.myAssets')}
              value={myAssetsTotal}
              icon={boxIcon}
              accent="bg-primary/15 text-primary"
            />
            <Link to="/assets" className="no-underline">
              <StatCard
                label={t('dashboard.viewMyAssets')}
                value="→"
                icon={arrowIcon}
                accent="bg-secondary/15 text-secondary"
              />
            </Link>
            {isAdmin && (
              <Link to="/admin/import-export" className="no-underline">
                <StatCard
                  label={t('nav.adminImportExport')}
                  value="→"
                  icon={importExportIcon}
                  accent="bg-warning/15 text-warning"
                />
              </Link>
            )}
          </div>

          {showEmptyAssets && (
            <Panel className="mb-6">
              <p className="py-8 text-center text-muted">{t('assets.myEmpty')}</p>
            </Panel>
          )}

          {showRecentAssets && (
            <Panel title={t('dashboard.recentAssets')} className="mb-6">
              <Table>
                <TableHead>
                  <TableHeaderRow>
                    <TableHeaderCell>{t('assets.name')}</TableHeaderCell>
                    <TableHeaderCell>{t('assets.serialNumber')}</TableHeaderCell>
                    <TableHeaderCell>{t('assets.status')}</TableHeaderCell>
                    <TableHeaderCell last>{t('assets.location')}</TableHeaderCell>
                  </TableHeaderRow>
                </TableHead>
                <TableBody>
                  {recentAssets.map((asset) => (
                    <TableRow key={asset.id} striped>
                      <TableCell>
                        <TableCellText value={asset.name} />
                      </TableCell>
                      <TableCell className="font-mono">
                        <TableCellText value={asset.serialNumber} />
                      </TableCell>
                      <TableCell>
                        <AssetStatusBadge status={asset.status}>
                          {t(ASSET_STATUS_LABEL_KEYS[asset.status])}
                        </AssetStatusBadge>
                      </TableCell>
                      <TableCell last>
                        {asset.siteName ? (
                          <TableCellText value={asset.siteName} />
                        ) : (
                          <span className="text-muted">{t('assets.noLocation')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {myAssetsTotal > myAssets.length && (
                <p className="mt-4 text-sm text-muted text-center">
                  <Link to="/assets" className="text-primary hover:underline">
                    {t('dashboard.viewMyAssets')} ({myAssetsTotal})
                  </Link>
                </p>
              )}
            </Panel>
          )}

          {markers.length > 0 && (
            <div className="mb-6">
              <Panel title={t('dashboard.myAssetsMap')}>
                <LocationMap markers={markers} className="h-72 w-full rounded-lg z-0" />
              </Panel>
            </div>
          )}
        </>
      )}

      <Panel title={t('history.myTitle')}>
        <HistoryTable
          transactions={transactions}
          loading={txLoading}
          page={txPage}
          total={txTotal}
          pageSize={txPageSize}
          onPageChange={setTxPage}
        />
      </Panel>
    </PageContent>
  );
}
