import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { Button } from '~/components/Button';
import { CatalogImage } from '~/components/CatalogImage';
import { CatalogImageHoverPreview } from '~/components/CatalogImageHoverPreview';
import { CatalogImageUploader } from '~/components/CatalogImageUploader';
import { FormInput } from '~/components/FormInput';
import { TableSkeleton } from '~/components/LoadingSkeleton';
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
import type { ApiResponse, ListManufacturersData, Manufacturer } from '~/types';
import { api } from '~/utils/api';

export const meta = pageMeta('manufacturers.title');

export default function AdminManufacturers() {
  usePageTitle('manufacturers.title');
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const [items, setItems] = useState<Manufacturer[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editing, setEditing] = useState<Manufacturer | null>(null);
  const [deleting, setDeleting] = useState<Manufacturer | null>(null);
  const [formName, setFormName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);

  const fetchItems = useCallback(
    async (opts: { search: string; page: number }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        params.set('page', String(opts.page));
        const res = await api.get<ListManufacturersData>(`/api/p/manufacturers?${params.toString()}`);
        setItems(res.data?.manufacturers ?? []);
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
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/', { replace: true });
    }
  }, [userLoading, user, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const handle = setTimeout(() => {
      void fetchItems({ search, page });
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdmin, search, page, fetchItems]);

  const openCreateModal = () => {
    setFormName('');
    setShowCreateModal(true);
  };

  const openEditModal = (row: Manufacturer) => {
    setEditing(row);
    setFormName(row.name);
    setShowEditModal(true);
  };

  const openDeleteModal = (row: Manufacturer) => {
    setDeleting(row);
    setShowDeleteModal(true);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/p/manufacturers', { name: formName });
      addToast({ type: 'success', title: t('common.success'), message: t('manufacturers.createSuccess') });
      setShowCreateModal(false);
      setPage(1);
      void fetchItems({ search, page: 1 });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    try {
      await api.patch(`/api/p/manufacturers/${editing.id}`, { name: formName });
      addToast({ type: 'success', title: t('common.success'), message: t('manufacturers.updateSuccess') });
      setShowEditModal(false);
      setEditing(null);
      void fetchItems({ search, page });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!deleting) return;
    setDeleteSubmitting(true);
    try {
      await api.delete(`/api/p/manufacturers/${deleting.id}`);
      addToast({ type: 'success', title: t('common.success'), message: t('manufacturers.deleteSuccess') });
      setShowDeleteModal(false);
      setDeleting(null);
      void fetchItems({ search, page });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <PageContent size="wide">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold">{t('manufacturers.title')}</h1>
        <Button onClick={openCreateModal}>{t('manufacturers.create')}</Button>
      </div>

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t('manufacturers.searchPlaceholder')}
      />

      <div className="mt-6">
        <Panel>
          {loading ? (
            <TableSkeleton columns={3} actionsColumn />
          ) : (
            <>
            <Table>
              <TableHead>
                <TableHeaderRow>
                  <TableHeaderCell className="w-12" />
                  <TableHeaderCell>{t('manufacturers.name')}</TableHeaderCell>
                  <TableHeaderCell>{t('manufacturers.assetCount')}</TableHeaderCell>
                  <TableHeaderCell last />
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id} striped>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <CatalogImageHoverPreview
                        kind="manufacturers"
                        entityId={row.id}
                        name={row.name}
                        hasImage={row.imageFilename}
                        version={imageVersion}
                        size={32}
                      />
                    </TableCell>
                    <TableCell>
                      <TableCellText value={row.name} />
                    </TableCell>
                    <TableCell>
                      {row.assetCount > 0 ? (
                        <Link
                          to={`/admin/assets?manufacturerId=${encodeURIComponent(row.id)}`}
                          className="text-primary hover:underline"
                        >
                          {row.assetCount}
                        </Link>
                      ) : (
                        row.assetCount
                      )}
                    </TableCell>
                    <TableCell last>
                      <TableRowActions
                        onEdit={() => openEditModal(row)}
                        onDelete={() => openDeleteModal(row)}
                        editLabel={t('manufacturers.edit')}
                        deleteLabel={t('manufacturers.delete')}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              {total === 0 && <p className="py-8 text-center text-muted">{t('manufacturers.empty')}</p>}
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

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('manufacturers.create')}>
        <form onSubmit={(e) => void handleCreateSubmit(e)}>
          <FormInput
            label={t('manufacturers.name')}
            name="name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
          />
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="tertiary" type="button" onClick={() => setShowCreateModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.loading') : t('manufacturers.create')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditing(null);
        }}
        title={t('manufacturers.edit')}
      >
        <form onSubmit={(e) => void handleEditSubmit(e)}>
          <FormInput
            label={t('manufacturers.name')}
            name="name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
          />
          {editing && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex gap-4 items-start min-w-0">
                {editing.imageFilename && (
                  <CatalogImage
                    kind="manufacturers"
                    entityId={editing.id}
                    name={editing.name}
                    hasImage={editing.imageFilename}
                    size={112}
                    version={imageVersion}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-2">{t('assets.image')}</p>
                  <CatalogImageUploader
                    kind="manufacturers"
                    entityId={editing.id}
                    hasImage={editing.imageFilename}
                    onChanged={() => {
                      setImageVersion((v) => v + 1);
                      void fetchItems({ search, page });
                      void api
                        .get<{ manufacturer: Manufacturer }>(`/api/p/manufacturers/${editing.id}`)
                        .then((res) => {
                          if (res.data?.manufacturer) setEditing(res.data.manufacturer);
                        });
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditing(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.loading') : t('profile.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleting(null);
        }}
        title={t('manufacturers.delete')}
      >
        <p className="mb-4">{t('manufacturers.deleteConfirm')}</p>
        {deleting && <p className="mb-4 text-muted">{deleting.name}</p>}
        {deleting && deleting.assetCount > 0 && (
          <p className="mb-4 text-warning">
            {deleting.assetCount} {t('manufacturers.deleteInUse')}
          </p>
        )}
        <form onSubmit={(e) => void handleDeleteSubmit(e)}>
          <div className="flex gap-2 justify-end">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleting(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="danger" type="submit" disabled={deleteSubmitting || (deleting?.assetCount ?? 0) > 0}>
              {deleteSubmitting ? t('common.loading') : t('manufacturers.delete')}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContent>
  );
}
