import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { Button } from '~/components/Button';
import { FormFieldSpan, FormFieldsGrid } from '~/components/FormFieldsGrid';
import { FormInput } from '~/components/FormInput';
import { TableSkeleton } from '~/components/LoadingSkeleton';
import { LocationMap, LocationPicker, type MapMarker } from '~/components/Map';
import { Modal } from '~/components/Modal';
import { PageContent } from '~/components/PageContent';
import { Pagination } from '~/components/Pagination';
import { Panel } from '~/components/Panel';
import { SearchInput } from '~/components/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '~/components/Table';
import { TableRowActions } from '~/components/TableActionButtons';
import { TableCellText } from '~/components/TableCellText';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type { ApiResponse, ListSitesData, Site } from '~/types';
import { api } from '~/utils/api';

export const meta = pageMeta('sites.title');

export default function AdminSites() {
  usePageTitle('sites.title');
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const [sites, setSites] = useState<Site[]>([]);
  const [total, setTotal] = useState(0);
  // Page size is decided by the server (config) and echoed back in the response.
  const [pageSize, setPageSize] = useState(20);
  // Full list backing the overview map (the table is searched + paged separately).
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deletingSite, setDeletingSite] = useState<Site | null>(null);
  const [alsoDeleteAssets, setAlsoDeleteAssets] = useState(false);

  // Shared form state.
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Searched + paginated list for the table.
  const fetchSites = useCallback(
    async (opts: { search: string; page: number }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        params.set('page', String(opts.page));
        const res = await api.get<ListSitesData>(`/api/p/sites?${params.toString()}`);
        setSites(res.data?.sites ?? []);
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

  // Full, unpaginated list for the overview map.
  const fetchAllSites = useCallback(async () => {
    try {
      const res = await api.get<ListSitesData>('/api/p/sites');
      setAllSites(res.data?.sites ?? []);
    } catch {
      // Non-fatal: the overview map will simply be empty.
    }
  }, []);

  const refreshSites = useCallback(
    (opts: { search: string; page: number }) => {
      void fetchSites(opts);
      void fetchAllSites();
    },
    [fetchSites, fetchAllSites],
  );

  useEffect(() => {
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/', { replace: true });
    }
  }, [userLoading, user, navigate]);

  // The overview map's full list only needs (re)loading on mount + after mutations.
  useEffect(() => {
    if (isAdmin) void fetchAllSites();
  }, [isAdmin, fetchAllSites]);

  // Debounced server-side search + pagination for the table.
  useEffect(() => {
    if (!isAdmin) return;
    const handle = setTimeout(() => {
      void fetchSites({ search, page });
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdmin, search, page, fetchSites]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormAddress('');
    setFormLat('');
    setFormLng('');
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (site: Site) => {
    setEditingSite(site);
    setFormName(site.name);
    setFormDescription(site.description ?? '');
    setFormAddress(site.address ?? '');
    setFormLat(String(site.latitude));
    setFormLng(String(site.longitude));
    setShowEditModal(true);
  };

  const openDeleteModal = (site: Site) => {
    setDeletingSite(site);
    setAlsoDeleteAssets(false);
    setShowDeleteModal(true);
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

  const validate = (): boolean => {
    if (!pickerValue) {
      addToast({ type: 'error', title: t('common.error'), message: t('sites.coordinatesRequired') });
      return false;
    }
    return true;
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post('/api/p/sites', buildPayload());
      addToast({ type: 'success', title: t('common.success'), message: t('sites.createSuccess') });
      setShowCreateModal(false);
      setPage(1);
      refreshSites({ search, page: 1 });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.patch(`/api/p/sites/${editingSite.id}`, buildPayload());
      addToast({ type: 'success', title: t('common.success'), message: t('sites.updateSuccess') });
      setShowEditModal(false);
      setEditingSite(null);
      refreshSites({ search, page });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!deletingSite) return;
    setDeleteSubmitting(true);
    try {
      await api.delete(`/api/p/sites/${deletingSite.id}?deleteAssets=${alsoDeleteAssets ? 'true' : 'false'}`);
      addToast({ type: 'success', title: t('common.success'), message: t('sites.deleteSuccess') });
      setShowDeleteModal(false);
      setDeletingSite(null);
      refreshSites({ search, page });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // The overview map always shows every site; the table is searched + paged.
  const markers: MapMarker[] = allSites.map((s) => ({
    id: s.id,
    lat: s.latitude,
    lng: s.longitude,
    label: s.name,
  }));

  const renderFormFields = () => (
    <FormFieldsGrid>
      <FormInput
        label={t('sites.name')}
        name="name"
        value={formName}
        onChange={(e) => setFormName(e.target.value)}
        required
      />
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
  );

  if (!isAdmin) return null;

  return (
    <PageContent size="wide">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold">{t('sites.title')}</h1>
        <Button onClick={openCreateModal}>{t('sites.create')}</Button>
      </div>

      {markers.length > 0 && (
        <Panel title={t('sites.overview')}>
          <LocationMap markers={markers} />
        </Panel>
      )}

      <SearchInput
        className="mt-6"
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t('sites.searchPlaceholder')}
      />

      <div>
        <Panel>
          {loading ? (
            <TableSkeleton columns={6} actionsColumn />
          ) : (
            <>
            <Table>
              <TableHead>
                <TableHeaderRow>
                  <TableHeaderCell>{t('sites.name')}</TableHeaderCell>
                  <TableHeaderCell>{t('sites.address')}</TableHeaderCell>
                  <TableHeaderCell>{t('sites.description')}</TableHeaderCell>
                  <TableHeaderCell>{t('sites.coordinates')}</TableHeaderCell>
                  <TableHeaderCell>{t('sites.assetCount')}</TableHeaderCell>
                  <TableHeaderCell last />
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {sites.map((site) => (
                  <TableRow
                    key={site.id}
                    striped
                    onClick={() => void navigate(`/admin/sites/${site.id}`)}
                  >
                    <TableCell>
                      <TableCellText value={site.name} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <TableCellText value={site.address} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <TableCellText value={site.description} />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)}
                    </TableCell>
                    <TableCell>{site.assetCount}</TableCell>
                    <TableCell last onClick={(e) => e.stopPropagation()}>
                      <TableRowActions
                        onEdit={() => openEditModal(site)}
                        onDelete={() => openDeleteModal(site)}
                        editLabel={t('sites.edit')}
                        deleteLabel={t('sites.delete')}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              {total === 0 && <p className="py-8 text-center text-muted">{t('sites.empty')}</p>}
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
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('sites.create')}
        size="lg"
      >
        <form onSubmit={(e) => void handleCreateSubmit(e)}>
          {renderFormFields()}
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => setShowCreateModal(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
            >
              {submitting ? t('common.loading') : t('sites.create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingSite(null);
        }}
        title={t('sites.edit')}
        size="lg"
      >
        <form onSubmit={(e) => void handleEditSubmit(e)}>
          {renderFormFields()}
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditingSite(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
            >
              {submitting ? t('common.loading') : t('profile.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingSite(null);
        }}
        title={t('sites.delete')}
        size="lg"
      >
        <p className="mb-4">{t('sites.deleteConfirm')}</p>
        {deletingSite && <p className="mb-4 text-muted">{deletingSite.name}</p>}
        {deletingSite && deletingSite.assetCount > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-warning">
              {deletingSite.assetCount} {t('sites.deleteLinkedAssets')}
            </p>
            <FormInput
              label={t('sites.deleteAlsoAssets')}
              name="alsoDeleteAssets"
              type="checkbox"
              value={alsoDeleteAssets}
              onChange={(e) => setAlsoDeleteAssets((e.target as HTMLInputElement).checked)}
            />
          </div>
        )}
        <form onSubmit={(e) => void handleDeleteSubmit(e)}>
          <div className="flex gap-2 justify-end">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingSite(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              type="submit"
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? t('common.loading') : t('sites.delete')}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContent>
  );
}
