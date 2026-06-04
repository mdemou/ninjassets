import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { Button } from '~/components/Button';
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
import type {
  ApiResponse,
  Category,
  CategoryField,
  CategoryFieldType,
  ListCategoriesData,
} from '~/types';
import { api } from '~/utils/api';

const FIELD_TYPES: CategoryFieldType[] = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'BOOLEAN',
  'DATE',
  'SELECT',
  'MULTI_SELECT',
];

const needsOptions = (type: CategoryFieldType) => type === 'SELECT' || type === 'MULTI_SELECT';

/** A field as edited in the form; options held as raw comma-separated text. */
interface FieldRow {
  key: number;
  label: string;
  dataType: CategoryFieldType;
  required: boolean;
  optionsText: string;
}

let fieldRowSeq = 0;
const newFieldRow = (): FieldRow => ({
  key: fieldRowSeq++,
  label: '',
  dataType: 'TEXT',
  required: false,
  optionsText: '',
});

const toFieldRow = (f: CategoryField): FieldRow => ({
  key: fieldRowSeq++,
  label: f.label,
  dataType: f.dataType,
  required: f.required,
  optionsText: (f.options ?? []).join(', '),
});

function buildFieldsPayload(rows: FieldRow[]) {
  return rows
    .filter((r) => r.label.trim() !== '')
    .map((r) => ({
      label: r.label.trim(),
      dataType: r.dataType,
      required: r.required,
      options: needsOptions(r.dataType)
        ? r.optionsText
            .split(',')
            .map((o) => o.trim())
            .filter((o) => o !== '')
        : null,
    }));
}

export const meta = pageMeta('categories.title');

export default function AdminCategories() {
  usePageTitle('categories.title');
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const [items, setItems] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFields, setFormFields] = useState<FieldRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchItems = useCallback(
    async (opts: { search: string; page: number }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        params.set('page', String(opts.page));
        const res = await api.get<ListCategoriesData>(`/api/p/categories?${params.toString()}`);
        setItems(res.data?.categories ?? []);
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

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormFields([]);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = async (row: Category) => {
    setEditing(row);
    setFormName(row.name);
    setFormDescription(row.description ?? '');
    setFormFields([]);
    setShowEditModal(true);
    try {
      const res = await api.get<{ category: Category }>(`/api/p/categories/${row.id}`);
      const fields = res.data?.category.fields ?? [];
      setFormFields(fields.map(toFieldRow));
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    }
  };

  const openDeleteModal = (row: Category) => {
    setDeleting(row);
    setShowDeleteModal(true);
  };

  // Field-row editing helpers
  const updateField = (key: number, patch: Partial<FieldRow>) =>
    setFormFields((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addField = () => setFormFields((rows) => [...rows, newFieldRow()]);
  const removeField = (key: number) => setFormFields((rows) => rows.filter((r) => r.key !== key));

  const submitPayload = () => ({
    name: formName.trim(),
    description: formDescription.trim() || null,
    fields: buildFieldsPayload(formFields),
  });

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/p/categories', submitPayload());
      addToast({ type: 'success', title: t('common.success'), message: t('categories.createSuccess') });
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
      await api.patch(`/api/p/categories/${editing.id}`, submitPayload());
      addToast({ type: 'success', title: t('common.success'), message: t('categories.updateSuccess') });
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
      await api.delete(`/api/p/categories/${deleting.id}`);
      addToast({ type: 'success', title: t('common.success'), message: t('categories.deleteSuccess') });
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

  const typeOptions = FIELD_TYPES.map((ty) => ({
    value: ty,
    label: t(`categories.type.${ty}`),
  }));

  const renderFieldsEditor = () => (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium">{t('categories.fields')}</p>
        <Button variant="tertiary" type="button" onClick={addField}>
          {t('categories.addField')}
        </Button>
      </div>
      <p className="text-xs text-muted mb-3">{t('categories.fieldsHint')}</p>

      {formFields.length === 0 ? (
        <p className="text-sm text-muted py-2">{t('categories.noFields')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {formFields.map((row) => (
            <div key={row.key} className="rounded border border-border p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <FormInput
                  label={t('categories.fieldLabel')}
                  name={`field-label-${row.key}`}
                  value={row.label}
                  onChange={(e) => updateField(row.key, { label: e.target.value })}
                  required
                />
                <FormInput
                  label={t('categories.fieldType')}
                  name={`field-type-${row.key}`}
                  type="select"
                  value={row.dataType}
                  onChange={(e) =>
                    updateField(row.key, { dataType: e.target.value as CategoryFieldType })
                  }
                  options={typeOptions}
                />
              </div>
              {needsOptions(row.dataType) && (
                <FormInput
                  label={t('categories.fieldOptions')}
                  name={`field-options-${row.key}`}
                  value={row.optionsText}
                  onChange={(e) => updateField(row.key, { optionsText: e.target.value })}
                  placeholder={t('categories.fieldOptionsHint')}
                />
              )}
              <div className="flex items-center justify-between">
                <FormInput
                  label={t('categories.fieldRequired')}
                  name={`field-required-${row.key}`}
                  type="checkbox"
                  value={row.required}
                  onChange={(e) =>
                    updateField(row.key, { required: (e.target as HTMLInputElement).checked })
                  }
                />
                <Button variant="tertiary" type="button" onClick={() => removeField(row.key)}>
                  {t('categories.removeField')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderForm = (onSubmit: (e: FormEvent) => void, onCancel: () => void, submitLabel: string) => (
    <form onSubmit={(e) => void onSubmit(e)}>
      <FormInput
        label={t('categories.name')}
        name="name"
        value={formName}
        onChange={(e) => setFormName(e.target.value)}
        required
      />
      <FormInput
        label={t('categories.description')}
        name="description"
        type="textarea"
        value={formDescription}
        onChange={(e) => setFormDescription(e.target.value)}
      />
      {renderFieldsEditor()}
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="tertiary" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t('common.loading') : submitLabel}
        </Button>
      </div>
    </form>
  );

  return (
    <PageContent size="wide">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold">{t('categories.title')}</h1>
        <Button onClick={openCreateModal}>{t('categories.create')}</Button>
      </div>

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t('categories.searchPlaceholder')}
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
                  <TableHeaderCell>{t('categories.name')}</TableHeaderCell>
                  <TableHeaderCell>{t('categories.fieldCount')}</TableHeaderCell>
                  <TableHeaderCell>{t('categories.assetCount')}</TableHeaderCell>
                  <TableHeaderCell last />
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id} striped>
                    <TableCell>
                      <TableCellText value={row.name} />
                    </TableCell>
                    <TableCell>{row.fieldCount ?? 0}</TableCell>
                    <TableCell>
                      {(row.assetCount ?? 0) > 0 ? (
                        <Link
                          to={`/admin/assets?categoryId=${encodeURIComponent(row.id)}`}
                          className="text-primary hover:underline"
                        >
                          {row.assetCount}
                        </Link>
                      ) : (
                        row.assetCount ?? 0
                      )}
                    </TableCell>
                    <TableCell last>
                      <TableRowActions
                        onEdit={() => void openEditModal(row)}
                        onDelete={() => openDeleteModal(row)}
                        editLabel={t('categories.edit')}
                        deleteLabel={t('categories.delete')}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              {total === 0 && <p className="py-8 text-center text-muted">{t('categories.empty')}</p>}
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

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('categories.create')}>
        {renderForm((e) => void handleCreateSubmit(e), () => setShowCreateModal(false), t('categories.create'))}
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditing(null);
        }}
        title={t('categories.edit')}
      >
        {renderForm(
          (e) => void handleEditSubmit(e),
          () => {
            setShowEditModal(false);
            setEditing(null);
          },
          t('profile.save'),
        )}
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleting(null);
        }}
        title={t('categories.delete')}
      >
        <p className="mb-4">{t('categories.deleteConfirm')}</p>
        {deleting && <p className="mb-4 text-muted">{deleting.name}</p>}
        {deleting && (deleting.assetCount ?? 0) > 0 && (
          <p className="mb-4 text-warning">
            {deleting.assetCount} {t('categories.deleteInUse')}
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
            <Button
              variant="danger"
              type="submit"
              disabled={deleteSubmitting || (deleting?.assetCount ?? 0) > 0}
            >
              {deleteSubmitting ? t('common.loading') : t('categories.delete')}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContent>
  );
}
