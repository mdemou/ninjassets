import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { usePageTitleSection } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { AssetStatusBadge } from '~/components/AssetStatusBadge';
import { Avatar } from '~/components/Avatar';
import { Button } from '~/components/Button';
import { FormFieldSpan, FormFieldsGrid } from '~/components/FormFieldsGrid';
import { FormInput } from '~/components/FormInput';
import { DetailPanelSkeleton, TableSkeleton } from '~/components/LoadingSkeleton';
import { LocationMap, LocationPicker, type MapMarker } from '~/components/Map';
import { PageContent } from '~/components/PageContent';
import { Pagination } from '~/components/Pagination';
import { Panel } from '~/components/Panel';
import { SearchInput } from '~/components/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '~/components/Table';
import { TableCellText } from '~/components/TableCellText';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type { ApiResponse, Asset, ListAssetsData, Site } from '~/types';
import { api } from '~/utils/api';
import { ASSET_STATUS_LABEL_KEYS } from '~/utils/assetStatus';

export const meta = pageMeta('sites.detailTitle');

export default function AdminSiteDetail() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const [site, setSite] = useState<Site | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);

  const pageTitleSection = useMemo(
    () => (site?.name ? `${t('sites.detailTitle')} — ${site.name}` : t('sites.detailTitle')),
    [site?.name, t],
  );
  usePageTitleSection(pageTitleSection);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [assetsPage, setAssetsPage] = useState(1);
  const [assetsPageSize, setAssetsPageSize] = useState(20);
  const [assetsSearch, setAssetsSearch] = useState('');
  const [assetsLoading, setAssetsLoading] = useState(true);

  const fetchSite = useCallback(async () => {
    if (!siteId) return;
    setSiteLoading(true);
    try {
      const res = await api.get<{ site: Site }>(`/api/p/sites/${siteId}`);
      setSite(res.data?.site ?? null);
    } catch (err) {
      const error = err as ApiResponse;
      addToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || t('common.error'),
      });
      void navigate('/admin/sites', { replace: true });
    } finally {
      setSiteLoading(false);
    }
  }, [siteId, addToast, t, navigate]);

  const fetchAssets = useCallback(
    async (opts: { search: string; page: number }) => {
      if (!siteId) return;
      setAssetsLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        params.set('page', String(opts.page));
        const res = await api.get<ListAssetsData>(`/api/p/sites/${siteId}/assets?${params.toString()}`);
        setAssets(res.data?.assets ?? []);
        setAssetsTotal(res.data?.total ?? 0);
        if (res.data?.pageSize) setAssetsPageSize(res.data.pageSize);
      } catch (err) {
        const error = err as ApiResponse;
        addToast({
          type: 'error',
          title: t('common.error'),
          message: error.message || t('common.error'),
        });
      } finally {
        setAssetsLoading(false);
      }
    },
    [siteId, addToast, t],
  );

  useEffect(() => {
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/', { replace: true });
    }
  }, [userLoading, user, navigate]);

  useEffect(() => {
    if (!isAdmin || !siteId) return;
    void fetchSite();
  }, [isAdmin, siteId, fetchSite]);

  useEffect(() => {
    if (!site) return;
    setFormName(site.name);
    setFormDescription(site.description ?? '');
    setFormAddress(site.address ?? '');
    setFormLat(String(site.latitude));
    setFormLng(String(site.longitude));
  }, [site]);

  useEffect(() => {
    if (!isAdmin || !siteId) return;
    const handle = setTimeout(() => {
      void fetchAssets({ search: assetsSearch, page: assetsPage });
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdmin, siteId, assetsSearch, assetsPage, fetchAssets]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  const pickerValue =
    formLat !== '' && formLng !== '' && !Number.isNaN(Number(formLat)) && !Number.isNaN(Number(formLng))
      ? { lat: Number(formLat), lng: Number(formLng) }
      : null;

  const onPick = (coords: { lat: number; lng: number }) => {
    setFormLat(coords.lat.toFixed(6));
    setFormLng(coords.lng.toFixed(6));
  };

  const buildPayload = () => ({
    name: formName,
    description: formDescription || null,
    address: formAddress || null,
    latitude: Number(formLat),
    longitude: Number(formLng),
  });

  const isFormDirty =
    site != null &&
    (formName !== site.name ||
      (formDescription || '') !== (site.description ?? '') ||
      (formAddress || '') !== (site.address ?? '') ||
      Number(formLat) !== site.latitude ||
      Number(formLng) !== site.longitude);

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!siteId || !site) return;
    if (!pickerValue) {
      addToast({ type: 'error', title: t('common.error'), message: t('sites.coordinatesRequired') });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.patch<{ site: Site }>(`/api/p/sites/${siteId}`, buildPayload());
      setSite(res.data?.site ?? null);
      addToast({ type: 'success', title: t('common.success'), message: t('sites.updateSuccess') });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || t('common.error'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const markers: MapMarker[] = pickerValue
    ? [{ id: site?.id ?? 'preview', lat: pickerValue.lat, lng: pickerValue.lng, label: formName || site?.name || '' }]
    : [];

  if (!isAdmin) return null;

  return (
    <PageContent size="wide">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="tertiary"
          type="button"
          onClick={() => void navigate('/admin/sites')}
        >
          {t('sites.backToList')}
        </Button>
      </div>

      {siteLoading ? (
        <DetailPanelSkeleton withMap className="mb-6" />
      ) : site ? (
        <>
          <Panel title={t('sites.detailTitle')}>
            <form onSubmit={(e) => void handleEditSubmit(e)}>
              <FormFieldsGrid>
                <FormInput
                  label={t('sites.name')}
                  name="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
                <div>
                  <p className="text-sm text-muted mb-1">{t('sites.assetCount')}</p>
                  <p className="font-medium">{site.assetCount}</p>
                </div>
                <FormFieldSpan>
                  <FormInput
                    label={t('sites.address')}
                    name="address"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                  />
                </FormFieldSpan>
                <FormFieldSpan>
                  <FormInput
                    label={t('sites.description')}
                    name="description"
                    type="textarea"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </FormFieldSpan>
                <FormFieldSpan>
                  <p className="text-sm text-muted mb-2">{t('sites.pickHint')}</p>
                  <LocationPicker
                    value={pickerValue}
                    onChange={onPick}
                  />
                </FormFieldSpan>
                <FormInput
                  label={t('sites.latitude')}
                  name="latitude"
                  type="number"
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                  required
                />
                <FormInput
                  label={t('sites.longitude')}
                  name="longitude"
                  type="number"
                  value={formLng}
                  onChange={(e) => setFormLng(e.target.value)}
                  required
                />
              </FormFieldsGrid>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-muted">
                <div>
                  {t('sites.createdAt')}: {formatDate(site.dateCreated)}
                </div>
                <div>
                  {t('sites.updatedAt')}: {formatDate(site.dateUpdated)}
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button
                  type="submit"
                  disabled={submitting || !isFormDirty}
                >
                  {submitting ? t('common.loading') : t('profile.save')}
                </Button>
              </div>
            </form>
            {markers.length > 0 && (
              <div className="mt-6">
                <LocationMap markers={markers} />
              </div>
            )}
          </Panel>
        </>
      ) : null}

      <h2 className="text-xl font-semibold mt-8 mb-4">{t('sites.siteAssets')}</h2>
      <SearchInput
        value={assetsSearch}
        onChange={(value) => {
          setAssetsSearch(value);
          setAssetsPage(1);
        }}
        placeholder={t('assets.searchPlaceholder')}
      />
      <Panel>
        {assetsLoading ? (
          <TableSkeleton columns={5} />
        ) : (
          <>
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>{t('assets.name')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.model')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.serialNumber')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.status')}</TableHeaderCell>
                <TableHeaderCell last>{t('assets.assignedUser')}</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {assets.map((asset) => (
                <TableRow
                  key={asset.id}
                  striped
                  onClick={() => void navigate(`/admin/assets/${asset.id}`)}
                >
                  <TableCell>
                    <TableCellText value={asset.name} />
                  </TableCell>
                  <TableCell className="text-muted">
                    <TableCellText value={asset.model} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <TableCellText value={asset.serialNumber} />
                  </TableCell>
                  <TableCell>
                    <AssetStatusBadge status={asset.status}>
                      {t(ASSET_STATUS_LABEL_KEYS[asset.status])}
                    </AssetStatusBadge>
                  </TableCell>
                  <TableCell last>
                    {asset.assignedUserName ? (
                      <span className="flex items-center gap-2">
                        <Avatar
                          userId={asset.assignedUserId!}
                          name={asset.assignedUserName}
                          hasAvatar={asset.assignedUserAvatarFilename}
                          size={24}
                        />
                        <TableCellText value={asset.assignedUserName} />
                      </span>
                    ) : (
                      <span className="text-muted">{t('assets.unassigned')}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            {assets.length === 0 && (
              <p className="py-8 text-center text-muted">{t('sites.noSiteAssets')}</p>
            )}
            <Pagination
              page={assetsPage}
              total={assetsTotal}
              resultsPerPage={assetsPageSize}
              onPageChange={setAssetsPage}
              disabled={assetsLoading}
            />
          </>
        )}
      </Panel>
    </PageContent>
  );
}
