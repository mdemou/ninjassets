import { useCallback, useEffect, useState } from 'react';
import { AssetStatusBadge } from '~/components/AssetStatusBadge';
import { CatalogImageHoverPreview } from '~/components/CatalogImageHoverPreview';
import { MyPendingHandoversPanel } from '~/components/MyPendingHandoversPanel';
import { TableSkeleton } from '~/components/LoadingSkeleton';
import { LocationMap, type MapMarker } from '~/components/Map';
import { PageContent } from '~/components/PageContent';
import { Pagination } from '~/components/Pagination';
import { Panel } from '~/components/Panel';
import { SearchInput } from '~/components/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '~/components/Table';
import { TableCellText } from '~/components/TableCellText';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import type { ApiResponse, ListMyAssetsData, MyAssetListItem } from '~/types';
import { api } from '~/utils/api';
import { ASSET_STATUS_LABEL_KEYS } from '~/utils/assetStatus';

function formatAssignedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export const meta = pageMeta('assets.myTitle');

export default function MyAssets() {
  usePageTitle('assets.myTitle');
  const { isReady } = useRequireAuth();
  const { addToast } = useError();
  const { t } = useLanguage();

  const [assets, setAssets] = useState<MyAssetListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // Page size is decided by the server (config) and echoed back in the response.
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchAssets = useCallback(
    async (opts: { search: string; page: number }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        params.set('page', String(opts.page));
        const res = await api.get<ListMyAssetsData>(`/api/me/assets?${params.toString()}`);
        setAssets(res.data?.assets ?? []);
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
    if (!isReady) return;
    const handle = setTimeout(() => {
      void fetchAssets({ search, page });
    }, 300);
    return () => clearTimeout(handle);
  }, [isReady, search, page, fetchAssets, refreshKey]);

  const markers: MapMarker[] = assets
    .filter((a) => a.effectiveLatitude != null && a.effectiveLongitude != null)
    .map((a) => ({
      id: a.id,
      lat: a.effectiveLatitude as number,
      lng: a.effectiveLongitude as number,
      label: a.siteName ? `${a.name} — ${a.siteName}` : a.name,
    }));

  if (!isReady) return null;

  return (
    <PageContent size="wide">
      <h1 className="text-3xl font-semibold mb-6">{t('assets.myTitle')}</h1>

      <MyPendingHandoversPanel
        isReady={isReady}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />

      {markers.length > 0 && (
        <div className="mb-6">
          <Panel title={t('assets.locationsMap')}>
            <LocationMap markers={markers} />
          </Panel>
        </div>
      )}

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t('assets.searchPlaceholder')}
      />

      <Panel>
        {loading ? (
          <TableSkeleton columns={7} />
        ) : (
          <>
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>{t('assets.name')}</TableHeaderCell>
                <TableHeaderCell className="whitespace-nowrap">{t('assets.assignedAt')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.model')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.manufacturer')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.serialNumber')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.status')}</TableHeaderCell>
                <TableHeaderCell last>{t('assets.location')}</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id} striped>
                  <TableCell>
                    <TableCellText value={asset.name} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted">
                    {formatAssignedAt(asset.assignedAt) ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted">
                    <TableCellText value={asset.model} />
                  </TableCell>
                  <TableCell className="text-muted">
                    <div className="flex items-center gap-2 min-w-0">
                      {asset.manufacturerId && (
                        <CatalogImageHoverPreview
                          kind="manufacturers"
                          entityId={asset.manufacturerId}
                          name={asset.manufacturerName ?? ''}
                          hasImage={asset.manufacturerImageFilename}
                          scope="user"
                          size={32}
                        />
                      )}
                      <TableCellText value={asset.manufacturerName} />
                    </div>
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
                    ) : asset.effectiveLatitude != null && asset.effectiveLongitude != null ? (
                      <span className="font-mono text-sm">
                        {asset.effectiveLatitude.toFixed(4)}, {asset.effectiveLongitude.toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-muted">{t('assets.noLocation')}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            {assets.length === 0 && <p className="py-8 text-center text-muted">{t('assets.myEmpty')}</p>}
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
    </PageContent>
  );
}
