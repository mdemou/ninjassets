import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AssetStatusBadge } from '~/components/AssetStatusBadge';
import { Badge } from '~/components/Badge';
import { AssetImage } from '~/components/AssetImage';
import { AssetImageHoverPreview } from '~/components/AssetImageHoverPreview';
import { AssetImageUploader } from '~/components/AssetImageUploader';
import { AssetQrPanel } from '~/components/AssetQrPanel';
import { BulkAssignWizard } from '~/components/BulkAssignWizard';
import { AssetQrHoverPreview } from '~/components/AssetQrHoverPreview';
import { Avatar } from '~/components/Avatar';
import { Button } from '~/components/Button';
import { FormFieldsGrid, FormFieldSpan } from '~/components/FormFieldsGrid';
import { FormInput } from '~/components/FormInput';
import { HoverTooltip } from '~/components/HoverTooltip';
import { TableSkeleton } from '~/components/LoadingSkeleton';
import { LocationPicker } from '~/components/Map';
import { Modal } from '~/components/Modal';
import { PageContent } from '~/components/PageContent';
import { Pagination } from '~/components/Pagination';
import { Panel } from '~/components/Panel';
import { SearchInput } from '~/components/SearchInput';
import { SearchSelect, type SearchSelectOption } from '~/components/SearchSelect';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '~/components/Table';
import { TableRowActions } from '~/components/TableActionButtons';
import { TableCellText } from '~/components/TableCellText';
import { useAssetTableSelection } from '~/hooks/useAssetTableSelection';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type {
  ApiResponse,
  Asset,
  AssetStatus,
  Category,
  CategoryField,
  Handover,
  ListAssetsData,
  ListCategoriesData,
  ListHandoversData,
  ListManufacturersData,
  ListSitesData,
  ListUsersData,
  ListVendorsData,
  Manufacturer,
  Vendor,
} from '~/types';
import { api } from '~/utils/api';
import {
  assetSerialAlreadyExistsMessage,
  isAssetSerialAlreadyExistsError,
  resolveAssetApiErrorMessage,
} from '~/utils/assetApiErrors';
import { ASSET_STATUS_BADGE_CLASS, ASSET_STATUS_OPTIONS } from '~/utils/assetStatus';
import { assetToSelectionItem, writePrintItems } from '~/utils/qrPrint';

type AssetListFetchOpts = {
  search: string;
  page: number;
  siteId: string;
  status: string;
  manufacturerId: string;
  vendorId: string;
  categoryId: string;
};

export const meta = pageMeta('assets.title');

export default function AdminAssets() {
  usePageTitle('assets.title');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // Page size is decided by the server (config) and echoed back in the response.
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterSiteSelected, setFilterSiteSelected] = useState<SearchSelectOption | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const filterManufacturerId = searchParams.get('manufacturerId') ?? '';
  const filterVendorId = searchParams.get('vendorId') ?? '';
  const filterCategoryId = searchParams.get('categoryId') ?? '';
  const [filterManufacturerSelected, setFilterManufacturerSelected] = useState<SearchSelectOption | null>(null);
  const [filterVendorSelected, setFilterVendorSelected] = useState<SearchSelectOption | null>(null);
  const [filterCategorySelected, setFilterCategorySelected] = useState<SearchSelectOption | null>(null);
  const siteFilterOptionsRef = useRef<SearchSelectOption[]>([]);
  const manufacturerFilterOptionsRef = useRef<SearchSelectOption[]>([]);
  const vendorFilterOptionsRef = useRef<SearchSelectOption[]>([]);
  const categoryFilterOptionsRef = useRef<SearchSelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  /** Open handovers keyed by asset id (for table pending badge). */
  const [pendingHandoversByAssetId, setPendingHandoversByAssetId] = useState<Record<string, Handover>>({});

  const [showCreateModal, setShowCreateModal] = useState(false);
  /** Set after a successful create so the modal can show image upload and QR before closing. */
  const [createModalAsset, setCreateModalAsset] = useState<Asset | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);

  // Shared form state (reused by create + edit).
  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formSerial, setFormSerial] = useState('');
  const [formStatus, setFormStatus] = useState<AssetStatus>('STOCK');
  const [formAssignedUserId, setFormAssignedUserId] = useState('');
  const [formSiteId, setFormSiteId] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formManufacturerId, setFormManufacturerId] = useState('');
  const [formVendorId, setFormVendorId] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formCategoryFields, setFormCategoryFields] = useState<CategoryField[]>([]);
  const [formCustomFields, setFormCustomFields] = useState<Record<string, unknown>>({});
  const [formCategorySelected, setFormCategorySelected] = useState<SearchSelectOption | null>(null);
  const [formPurchaseDate, setFormPurchaseDate] = useState('');
  const [formPurchaseCost, setFormPurchaseCost] = useState('');
  const [formSalvageValue, setFormSalvageValue] = useState('');
  const [formUsefulLifeMonths, setFormUsefulLifeMonths] = useState('');
  const [formWarrantyEndDate, setFormWarrantyEndDate] = useState('');
  const [formExpectedReturnDate, setFormExpectedReturnDate] = useState('');
  /** Set when creating a component from a parent detail page (hidden in modal). */
  const [presetParentAssetId, setPresetParentAssetId] = useState<string | null>(null);
  const [formVerifyHandover, setFormVerifyHandover] = useState(false);
  const [editModalHandover, setEditModalHandover] = useState<Handover | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [formSerialError, setFormSerialError] = useState<string | null>(null);

  const statusLabel = useCallback(
    (status: AssetStatus) => t(ASSET_STATUS_OPTIONS.find((s) => s.value === status)!.labelKey),
    [t],
  );

  const statusSelectOptions = useMemo(
    () =>
      ASSET_STATUS_OPTIONS.map((s) => ({
        label: t(s.labelKey),
        value: s.value,
        badgeClass: ASSET_STATUS_BADGE_CLASS[s.value],
      })),
    [t],
  );

  const pendingHandoverTooltip = useCallback(
    (handover: Handover) => {
      const type =
        handover.type === 'CHECK_OUT'
          ? t('handover.admin.typeCheckout')
          : t('handover.admin.typeCheckin');
      const recipient = handover.targetUserName ?? handover.targetUserEmail ?? '—';
      const expires = new Date(handover.expiresAt).toLocaleString();
      return `${t('handover.admin.pendingBlock')}\n${type} · ${recipient}\n${t('handover.admin.expires')}: ${expires}`;
    },
    [t],
  );

  const selection = useAssetTableSelection();
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const pageHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const pageIds = assets.map((a) => a.id);
  const pageSelectionItems = assets.map(assetToSelectionItem);
  const pageSelectState = selection.pageSelectionState(pageIds);

  useEffect(() => {
    const el = pageHeaderCheckboxRef.current;
    if (el) el.indeterminate = pageSelectState.some && !pageSelectState.all;
  }, [pageSelectState]);

  const handlePageSelectAll = useCallback(() => {
    if (pageSelectState.all) selection.deselectPage(pageIds);
    else selection.selectPage(pageSelectionItems);
  }, [pageSelectState.all, pageIds, pageSelectionItems, selection]);

  const handlePrintSelected = useCallback(() => {
    writePrintItems(selection.items);
    void navigate('/admin/assets/print-qr');
  }, [selection.items, navigate]);

  const getAssetListQuery = useCallback(
    (overrides?: Partial<AssetListFetchOpts>): AssetListFetchOpts => ({
      search,
      page,
      siteId: filterSiteId,
      status: filterStatus,
      manufacturerId: filterManufacturerId,
      vendorId: filterVendorId,
      categoryId: filterCategoryId,
      ...overrides,
    }),
    [search, page, filterSiteId, filterStatus, filterManufacturerId, filterVendorId, filterCategoryId],
  );

  const fetchAssets = useCallback(
    async (opts: AssetListFetchOpts) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        if (opts.siteId) params.set('siteId', opts.siteId);
        if (opts.status) params.set('status', opts.status);
        if (opts.manufacturerId) params.set('manufacturerId', opts.manufacturerId);
        if (opts.vendorId) params.set('vendorId', opts.vendorId);
        if (opts.categoryId) params.set('categoryId', opts.categoryId);
        params.set('page', String(opts.page));
        const [assetsRes, handoversRes] = await Promise.all([
          api.get<ListAssetsData>(`/api/p/assets?${params.toString()}`),
          api.get<ListHandoversData>('/api/p/handovers'),
        ]);
        setAssets(assetsRes.data?.assets ?? []);
        setTotal(assetsRes.data?.total ?? 0);
        if (assetsRes.data?.pageSize) setPageSize(assetsRes.data.pageSize);
        const pending: Record<string, Handover> = {};
        for (const h of handoversRes.data?.handovers ?? []) {
          if (h.status === 'OPEN' && new Date(h.expiresAt) > new Date()) {
            pending[h.assetId] = h;
          }
        }
        setPendingHandoversByAssetId(pending);
      } catch (err) {
        const error = err as ApiResponse;
        addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
      } finally {
        setLoading(false);
      }
    },
    [addToast, t],
  );

  const fetchUserOptions = useCallback(async (search: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', '1');
    const res = await api.get<ListUsersData>(`/api/p/users?${params.toString()}`);
    return (res.data?.users ?? []).map((u) => ({
      label: `${u.displayName} (${u.email})`,
      value: u.id,
    }));
  }, []);

  const fetchSiteOptions = useCallback(async (search: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', '1');
    const res = await api.get<ListSitesData>(`/api/p/sites?${params.toString()}`);
    return (res.data?.sites ?? []).map((s) => ({ label: s.name, value: s.id }));
  }, []);

  const fetchManufacturerOptions = useCallback(async (search: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', '1');
    const res = await api.get<ListManufacturersData>(`/api/p/manufacturers?${params.toString()}`);
    return (res.data?.manufacturers ?? []).map((m) => ({ label: m.name, value: m.id }));
  }, []);

  const fetchVendorOptions = useCallback(async (search: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', '1');
    const res = await api.get<ListVendorsData>(`/api/p/vendors?${params.toString()}`);
    return (res.data?.vendors ?? []).map((v) => ({ label: v.name, value: v.id }));
  }, []);

  const fetchCategoryOptions = useCallback(async (search: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', '1');
    const res = await api.get<ListCategoriesData>(`/api/p/categories?${params.toString()}`);
    return (res.data?.categories ?? []).map((c) => ({ label: c.name, value: c.id }));
  }, []);

  /** Loads a category's field schema and prunes any values it no longer defines. */
  const loadCategoryFields = useCallback(async (categoryId: string) => {
    if (!categoryId) {
      setFormCategoryFields([]);
      setFormCustomFields({});
      return;
    }
    try {
      const res = await api.get<{ category: Category }>(`/api/p/categories/${categoryId}`);
      const fields = res.data?.category.fields ?? [];
      setFormCategoryFields(fields);
      setFormCustomFields((prev) => {
        const allowed = new Set(fields.map((f) => f.fieldKey));
        const next: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (allowed.has(k)) next[k] = v;
        }
        return next;
      });
    } catch {
      setFormCategoryFields([]);
    }
  }, []);

  const handleCategoryChange = useCallback(
    (value: string) => {
      setFormCategoryId(value);
      setFormCategorySelected(null);
      void loadCategoryFields(value);
    },
    [loadCategoryFields],
  );

  /** Sets (or clears, when empty) one custom-field value. */
  const setCustomField = useCallback((key: string, value: unknown) => {
    setFormCustomFields((prev) => {
      const next = { ...prev };
      const isEmpty =
        value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
      if (isEmpty) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const fetchSiteFilterOptions = useCallback(
    async (q: string) => {
      const opts = await fetchSiteOptions(q);
      siteFilterOptionsRef.current = opts;
      return opts;
    },
    [fetchSiteOptions],
  );

  const fetchManufacturerFilterOptions = useCallback(
    async (q: string) => {
      const opts = await fetchManufacturerOptions(q);
      manufacturerFilterOptionsRef.current = opts;
      return opts;
    },
    [fetchManufacturerOptions],
  );

  const fetchVendorFilterOptions = useCallback(
    async (q: string) => {
      const opts = await fetchVendorOptions(q);
      vendorFilterOptionsRef.current = opts;
      return opts;
    },
    [fetchVendorOptions],
  );

  const fetchCategoryFilterOptions = useCallback(
    async (q: string) => {
      const opts = await fetchCategoryOptions(q);
      categoryFilterOptionsRef.current = opts;
      return opts;
    },
    [fetchCategoryOptions],
  );

  const applySiteFilter = useCallback((value: string) => {
    setFilterSiteId(value);
    setPage(1);
    if (!value) {
      setFilterSiteSelected(null);
      return;
    }
    const match = siteFilterOptionsRef.current.find((o) => o.value === value);
    setFilterSiteSelected(match ?? { value, label: value });
  }, []);

  const applyManufacturerFilter = useCallback(
    (value: string) => {
      setPage(1);
      const next = new URLSearchParams(searchParams);
      if (value) next.set('manufacturerId', value);
      else next.delete('manufacturerId');
      setSearchParams(next, { replace: true });
      if (!value) {
        setFilterManufacturerSelected(null);
        return;
      }
      const match = manufacturerFilterOptionsRef.current.find((o) => o.value === value);
      setFilterManufacturerSelected(match ?? { value, label: value });
    },
    [searchParams, setSearchParams],
  );

  const applyVendorFilter = useCallback(
    (value: string) => {
      setPage(1);
      const next = new URLSearchParams(searchParams);
      if (value) next.set('vendorId', value);
      else next.delete('vendorId');
      setSearchParams(next, { replace: true });
      if (!value) {
        setFilterVendorSelected(null);
        return;
      }
      const match = vendorFilterOptionsRef.current.find((o) => o.value === value);
      setFilterVendorSelected(match ?? { value, label: value });
    },
    [searchParams, setSearchParams],
  );

  const applyCategoryFilter = useCallback(
    (value: string) => {
      setPage(1);
      const next = new URLSearchParams(searchParams);
      if (value) next.set('categoryId', value);
      else next.delete('categoryId');
      setSearchParams(next, { replace: true });
      if (!value) {
        setFilterCategorySelected(null);
        return;
      }
      const match = categoryFilterOptionsRef.current.find((o) => o.value === value);
      setFilterCategorySelected(match ?? { value, label: value });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!isAdmin) return;
    const manufacturerId = searchParams.get('manufacturerId') ?? '';
    if (!manufacturerId) {
      setFilterManufacturerSelected(null);
      return;
    }
    if (filterManufacturerSelected?.value === manufacturerId) return;
    void api
      .get<{ manufacturer: Manufacturer }>(`/api/p/manufacturers/${manufacturerId}`)
      .then((res) => {
        const m = res.data?.manufacturer;
        if (m) setFilterManufacturerSelected({ value: m.id, label: m.name });
      })
      .catch(() => setFilterManufacturerSelected({ value: manufacturerId, label: manufacturerId }));
  }, [isAdmin, searchParams, filterManufacturerSelected?.value]);

  useEffect(() => {
    if (!isAdmin) return;
    const vendorId = searchParams.get('vendorId') ?? '';
    if (!vendorId) {
      setFilterVendorSelected(null);
      return;
    }
    if (filterVendorSelected?.value === vendorId) return;
    void api
      .get<{ vendor: Vendor }>(`/api/p/vendors/${vendorId}`)
      .then((res) => {
        const v = res.data?.vendor;
        if (v) setFilterVendorSelected({ value: v.id, label: v.name });
      })
      .catch(() => setFilterVendorSelected({ value: vendorId, label: vendorId }));
  }, [isAdmin, searchParams, filterVendorSelected?.value]);

  useEffect(() => {
    if (!isAdmin) return;
    const categoryId = searchParams.get('categoryId') ?? '';
    if (!categoryId) {
      setFilterCategorySelected(null);
      return;
    }
    if (filterCategorySelected?.value === categoryId) return;
    void api
      .get<{ category: Category }>(`/api/p/categories/${categoryId}`)
      .then((res) => {
        const c = res.data?.category;
        if (c) setFilterCategorySelected({ value: c.id, label: c.name });
      })
      .catch(() => setFilterCategorySelected({ value: categoryId, label: categoryId }));
  }, [isAdmin, searchParams, filterCategorySelected?.value]);

  useEffect(() => {
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/', { replace: true });
    }
  }, [userLoading, user, navigate]);

  const statusFilterOptions = statusSelectOptions;

  useLayoutEffect(() => {
    setPage(1);
  }, [filterManufacturerId, filterVendorId, filterCategoryId]);

  // Debounced search + pagination fetch.
  useEffect(() => {
    if (!isAdmin) return;
    const handle = setTimeout(() => {
      void fetchAssets(getAssetListQuery());
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdmin, getAssetListQuery, fetchAssets]);

  const resetForm = () => {
    setFormName('');
    setFormModel('');
    setFormSerial('');
    setFormStatus('STOCK');
    setFormAssignedUserId('');
    setFormSiteId('');
    setFormLat('');
    setFormLng('');
    setFormNote('');
    setFormManufacturerId('');
    setFormVendorId('');
    setFormCategoryId('');
    setFormCategoryFields([]);
    setFormCustomFields({});
    setFormCategorySelected(null);
    setFormPurchaseDate('');
    setFormPurchaseCost('');
    setFormSalvageValue('');
    setFormUsefulLifeMonths('');
    setFormWarrantyEndDate('');
    setFormExpectedReturnDate('');
    setPresetParentAssetId(null);
    setFormVerifyHandover(false);
    setEditModalHandover(null);
    setFormSerialError(null);
  };

  const handleAssetFormApiError = (err: unknown): void => {
    const error = err as ApiResponse;
    if (isAssetSerialAlreadyExistsError(error)) {
      setFormSerialError(assetSerialAlreadyExistsMessage(t));
    }
    addToast({
      type: 'error',
      title: t('common.error'),
      message: resolveAssetApiErrorMessage(error, t),
    });
  };

  // Picking an assignee implies the asset is ASSIGNED; clearing it leaves the
  // status untouched (the admin can then choose STOCK/MAINTENANCE/etc.).
  const handleAssigneeChange = (userId: string) => {
    setFormAssignedUserId(userId);
    if (userId) {
      setFormStatus('ASSIGNED');
      const custodyAvailable =
        !editModalHandover && (editingAsset === null || editingAsset.status === 'STOCK');
      if (custodyAvailable) setFormVerifyHandover(true);
    } else {
      setFormVerifyHandover(false);
    }
  };

  // Any non-ASSIGNED status drops the owner so the two never disagree.
  const handleStatusChange = (status: AssetStatus) => {
    setFormStatus(status);
    if (status !== 'ASSIGNED') {
      setFormAssignedUserId('');
      setFormVerifyHandover(false);
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateModalAsset(null);
  };

  const openCreateModal = () => {
    resetForm();
    setCreateModalAsset(null);
    setShowCreateModal(true);
  };

  const refreshModalAsset = useCallback(
    (assetId: string) => {
      setImageVersion((v) => v + 1);
      void fetchAssets(getAssetListQuery());
      void api.get<{ asset: Asset }>(`/api/p/assets/${assetId}`).then((res) => {
        const loaded = res.data?.asset;
        if (!loaded) return;
        setEditingAsset((prev) => (prev?.id === assetId ? loaded : prev));
        setCreateModalAsset((prev) => (prev?.id === assetId ? loaded : prev));
      });
    },
    [fetchAssets, getAssetListQuery],
  );

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setEditModalHandover(null);
    // Fetch whether this asset has an active handover (non-blocking).
    void api.get<ListHandoversData>(`/api/p/assets/${asset.id}/handovers`).then((res) => {
      const open = (res.data?.handovers ?? []).find(
        (h) => h.status === 'OPEN' && new Date(h.expiresAt) > new Date(),
      );
      setEditModalHandover(open ?? null);
    }).catch(() => setEditModalHandover(null));
    setFormName(asset.name);
    setFormModel(asset.model);
    setFormSerial(asset.serialNumber);
    setFormStatus(asset.status);
    setFormAssignedUserId(asset.assignedUserId ?? '');
    setFormSiteId(asset.siteId ?? '');
    setFormLat(asset.latitude != null ? String(asset.latitude) : '');
    setFormLng(asset.longitude != null ? String(asset.longitude) : '');
    setFormNote(asset.note ?? '');
    setFormManufacturerId(asset.manufacturerId ?? '');
    setFormVendorId(asset.vendorId ?? '');
    setFormCategoryId(asset.categoryId ?? '');
    setFormCustomFields({ ...(asset.customFields ?? {}) });
    setFormCategoryFields([]);
    setFormCategorySelected(
      asset.categoryId ? { value: asset.categoryId, label: asset.categoryName ?? asset.categoryId } : null,
    );
    void loadCategoryFields(asset.categoryId ?? '');
    setFormPurchaseDate(asset.purchaseDate ?? '');
    setFormPurchaseCost(asset.purchaseCost != null ? String(asset.purchaseCost) : '');
    setFormSalvageValue(asset.salvageValue != null ? String(asset.salvageValue) : '');
    setFormUsefulLifeMonths(asset.usefulLifeMonths != null ? String(asset.usefulLifeMonths) : '');
    setFormWarrantyEndDate(asset.warrantyEndDate ?? '');
    setFormExpectedReturnDate(asset.expectedReturnDate ?? '');
    setPresetParentAssetId(null);
    setShowEditModal(true);
  };

  const openDeleteModal = (asset: Asset) => {
    setDeletingAsset(asset);
    setShowDeleteModal(true);
  };

  const handleCancelEditModalHandover = async () => {
    if (!editModalHandover || !window.confirm(t('handover.admin.confirmCancel'))) return;
    setSubmitting(true);
    try {
      await api.post(`/api/p/handovers/${editModalHandover.id}/cancel`);
      setEditModalHandover(null);
      void fetchAssets(getAssetListQuery());
      addToast({ type: 'success', title: t('common.success'), message: t('handover.admin.cancel') });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setSubmitting(false);
    }
  };

  const buildPayload = (forCreate: boolean) => {
    const purchaseCost = formPurchaseCost !== '' ? Number(formPurchaseCost) : null;
    const hasFinancial =
      formPurchaseDate !== '' || purchaseCost != null || formSalvageValue !== '' || formUsefulLifeMonths !== '';
    const payload: Record<string, unknown> = {
      name: formName,
      model: formModel,
      serialNumber: formSerial,
      status: formStatus,
      assignedUserId: formStatus === 'ASSIGNED' ? formAssignedUserId : null,
      siteId: formSiteId || null,
      latitude: formLat !== '' ? Number(formLat) : null,
      longitude: formLng !== '' ? Number(formLng) : null,
      note: formNote.trim() || null,
      manufacturerId: formManufacturerId || null,
      vendorId: formVendorId || null,
      categoryId: formCategoryId || null,
      // Persist only values defined by the current category's schema.
      customFields: formCategoryId
        ? Object.fromEntries(
            formCategoryFields
              .filter((f) => formCustomFields[f.fieldKey] !== undefined)
              .map((f) => [f.fieldKey, formCustomFields[f.fieldKey]]),
          )
        : {},
      purchaseDate: formPurchaseDate || null,
      purchaseCost,
      salvageValue: formSalvageValue !== '' ? Number(formSalvageValue) : null,
      usefulLifeMonths: formUsefulLifeMonths !== '' ? Number(formUsefulLifeMonths) : null,
      depreciationMethod: hasFinancial && purchaseCost != null ? ('STRAIGHT_LINE' as const) : null,
      warrantyEndDate: formWarrantyEndDate || null,
      expectedReturnDate: formExpectedReturnDate || null,
    };
    if (forCreate && presetParentAssetId) {
      payload.parentAssetId = presetParentAssetId;
    }
    return payload;
  };

  const validateAssignment = (): boolean => {
    if (formStatus === 'ASSIGNED' && !formAssignedUserId) {
      addToast({ type: 'error', title: t('common.error'), message: t('assets.assignedUserRequired') });
      return false;
    }
    return true;
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (createModalAsset) return;

    if (formVerifyHandover && formStatus === 'ASSIGNED' && formAssignedUserId) {
      setSubmitting(true);
      setFormSerialError(null);
      try {
        // Create the asset as STOCK; the handover will apply the assignment once confirmed.
        const res = await api.post<{ asset: Asset }>('/api/p/assets', {
          ...buildPayload(true),
          status: 'STOCK',
          assignedUserId: null,
        });
        const created = res.data?.asset;
        if (created) {
          await api.post(`/api/p/assets/${created.id}/handovers`, {
            type: 'CHECK_OUT',
            targetUserId: formAssignedUserId,
            sendEmail: true,
          });
          addToast({ type: 'success', title: t('common.success'), message: t('assets.createSuccess') });
          setCreateModalAsset(created);
          setPage(1);
          void fetchAssets(getAssetListQuery({ page: 1 }));
        }
      } catch (err) {
        handleAssetFormApiError(err);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!validateAssignment()) return;
    setSubmitting(true);
    setFormSerialError(null);
    try {
      const res = await api.post<{ asset: Asset }>('/api/p/assets', buildPayload(true));
      const created = res.data?.asset ?? null;
      addToast({ type: 'success', title: t('common.success'), message: t('assets.createSuccess') });
      setCreateModalAsset(created);
      setPage(1);
      void fetchAssets(getAssetListQuery({ page: 1 }));
    } catch (err) {
      handleAssetFormApiError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;

    if (formVerifyHandover && formStatus === 'ASSIGNED' && formAssignedUserId && editingAsset.status === 'STOCK') {
      setSubmitting(true);
      try {
        // Save other field changes while keeping current status/assignee, then create handover.
        await api.patch(`/api/p/assets/${editingAsset.id}`, {
          ...buildPayload(false),
          status: editingAsset.status,
          assignedUserId: editingAsset.assignedUserId ?? null,
        });
        await api.post(`/api/p/assets/${editingAsset.id}/handovers`, {
          type: 'CHECK_OUT',
          targetUserId: formAssignedUserId,
          sendEmail: true,
        });
        addToast({ type: 'success', title: t('common.success'), message: t('assets.updateSuccess') });
        setShowEditModal(false);
        setEditingAsset(null);
        void fetchAssets(getAssetListQuery());
      } catch (err) {
        handleAssetFormApiError(err);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!validateAssignment()) return;
    setSubmitting(true);
    setFormSerialError(null);
    try {
      await api.patch(`/api/p/assets/${editingAsset.id}`, buildPayload(false));
      addToast({ type: 'success', title: t('common.success'), message: t('assets.updateSuccess') });
      setShowEditModal(false);
      setEditingAsset(null);
      void fetchAssets(getAssetListQuery());
    } catch (err) {
      handleAssetFormApiError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!deletingAsset) return;
    setDeleteSubmitting(true);
    try {
      await api.delete(`/api/p/assets/${deletingAsset.id}`);
      addToast({ type: 'success', title: t('common.success'), message: t('assets.deleteSuccess') });
      setShowDeleteModal(false);
      setDeletingAsset(null);
      void fetchAssets(getAssetListQuery());
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const assigneeSelectedOption =
    formAssignedUserId && editingAsset?.assignedUserId === formAssignedUserId
      ? {
          value: formAssignedUserId,
          label: editingAsset.assignedUserEmail
            ? `${editingAsset.assignedUserName} (${editingAsset.assignedUserEmail})`
            : (editingAsset.assignedUserName ?? formAssignedUserId),
        }
      : null;

  const siteSelectedOption =
    formSiteId && editingAsset?.siteId === formSiteId
      ? { value: formSiteId, label: editingAsset.siteName ?? formSiteId }
      : null;

  const manufacturerSelectedOption =
    formManufacturerId && editingAsset?.manufacturerId === formManufacturerId
      ? { value: formManufacturerId, label: editingAsset.manufacturerName ?? formManufacturerId }
      : null;

  const vendorSelectedOption =
    formVendorId && editingAsset?.vendorId === formVendorId
      ? { value: formVendorId, label: editingAsset.vendorName ?? formVendorId }
      : null;

  const pickerValue =
    formLat !== '' && formLng !== '' && !Number.isNaN(Number(formLat)) && !Number.isNaN(Number(formLng))
      ? { lat: Number(formLat), lng: Number(formLng) }
      : null;

  const onPick = (coords: { lat: number; lng: number }) => {
    setFormLat(coords.lat.toFixed(6));
    setFormLng(coords.lng.toFixed(6));
  };

  const categorySelectedOption =
    formCategoryId && formCategorySelected?.value === formCategoryId ? formCategorySelected : null;

  /** Renders the input for a single category custom field, by its data type. */
  const renderCustomFieldInput = (field: CategoryField) => {
    const value = formCustomFields[field.fieldKey];
    const name = `cf-${field.fieldKey}`;

    if (field.dataType === 'BOOLEAN') {
      return (
        <FormInput
          key={field.id}
          label={field.label}
          name={name}
          type="checkbox"
          value={value === true}
          onChange={(e) => setCustomField(field.fieldKey, (e.target as HTMLInputElement).checked)}
        />
      );
    }

    if (field.dataType === 'SELECT') {
      return (
        <FormInput
          key={field.id}
          label={field.label}
          name={name}
          type="select"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => setCustomField(field.fieldKey, e.target.value)}
          options={(field.options ?? []).map((o) => ({ label: o, value: o }))}
          emptyOption={{ label: '—', value: '' }}
          required={field.required}
        />
      );
    }

    if (field.dataType === 'MULTI_SELECT') {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (opt: string) =>
        setCustomField(
          field.fieldKey,
          selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt],
        );
      return (
        <FormFieldSpan key={field.id}>
          <span className="text-sm font-medium text-foreground">{field.label}</span>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {(field.options ?? []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </FormFieldSpan>
      );
    }

    const inputType =
      field.dataType === 'NUMBER' ? 'number' : field.dataType === 'DATE' ? 'date' : field.dataType === 'TEXTAREA' ? 'textarea' : 'text';
    const fieldNode = (
      <FormInput
        key={field.id}
        label={field.label}
        name={name}
        type={inputType}
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        onChange={(e) => setCustomField(field.fieldKey, e.target.value)}
        placeholder={field.placeholder ?? undefined}
        required={field.required}
      />
    );
    return field.dataType === 'TEXTAREA' ? <FormFieldSpan key={field.id}>{fieldNode}</FormFieldSpan> : fieldNode;
  };

  // Shared form fields for create + edit modals (section layout matches asset detail page).
  const renderFormFields = (opts?: { imagesAsset: Asset | null }) => (
    <div className="space-y-3">
      <details className="rounded-lg border border-border p-3" open>
        <summary className="cursor-pointer text-sm font-medium">{t('assets.generalSection')}</summary>
        <div className="mt-3">
          {editingAsset !== null && editModalHandover && (
            <div className="mb-4 rounded-lg border border-warning/50 bg-warning/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-medium text-warning">{t('handover.admin.pendingBlock')}</p>
                  <p className="text-muted">
                    {editModalHandover.type === 'CHECK_OUT' ? t('handover.admin.typeCheckout') : t('handover.admin.typeCheckin')}
                    {' · '}
                    {editModalHandover.targetUserName ?? editModalHandover.targetUserEmail ?? '—'}
                  </p>
                  <p className="text-xs text-muted">
                    {t('handover.admin.expires')}: {new Date(editModalHandover.expiresAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted">{t('handover.admin.pendingBlockSubtext')}</p>
                  <div className="flex gap-2 pt-1">
                    <Button variant="danger" onClick={() => void handleCancelEditModalHandover()} disabled={submitting}>
                      {t('handover.admin.cancel')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <FormFieldsGrid>
            <FormInput
              label={t('assets.name')}
              name="name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
            <FormInput
              label={t('assets.model')}
              name="model"
              value={formModel}
              onChange={(e) => setFormModel(e.target.value)}
            />
            <FormInput
              label={t('assets.serialNumber')}
              name="serialNumber"
              value={formSerial}
              onChange={(e) => {
                setFormSerial(e.target.value);
                if (formSerialError) setFormSerialError(null);
              }}
              error={formSerialError ?? undefined}
              required
            />
            <FormInput
              label={t('assets.status')}
              name="status"
              type="select"
              value={formStatus}
              onChange={(e) => handleStatusChange(e.target.value as AssetStatus)}
              options={statusSelectOptions}
              disabled={!!(editingAsset !== null && editModalHandover)}
            />
            <FormInput
              label={t('assets.assignedUser')}
              name="assignedUserId"
              type="select"
              value={formAssignedUserId}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              fetchOptions={fetchUserOptions}
              emptyOption={{ label: t('assets.selectUser'), value: '' }}
              selectedOption={assigneeSelectedOption}
              required={formStatus === 'ASSIGNED' && !formVerifyHandover}
              disabled={!!(editingAsset !== null && editModalHandover)}
            />
            {formStatus === 'ASSIGNED' &&
              formAssignedUserId &&
              (editingAsset === null || editingAsset.status === 'STOCK') &&
              !editModalHandover && (
                <FormFieldSpan>
                  <label className="flex items-start gap-2 cursor-pointer select-none mt-1">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-primary"
                      checked={formVerifyHandover}
                      onChange={(e) => setFormVerifyHandover(e.target.checked)}
                    />
                    <span className="text-sm">
                      {t('handover.admin.verifyAssignment')}
                      {formVerifyHandover && (
                        <span className="block text-xs text-muted mt-0.5">
                          {t('handover.admin.verifyAssignmentHint')}
                        </span>
                      )}
                    </span>
                  </label>
                </FormFieldSpan>
              )}
            <FormInput
              label={t('assets.expectedReturnDate')}
              name="expectedReturnDate"
              type="date"
              testId="asset-expected-return-date"
              value={formExpectedReturnDate}
              onChange={(e) => setFormExpectedReturnDate(e.target.value)}
            />
            <FormInput
              label={t('assets.site')}
              name="siteId"
              type="select"
              value={formSiteId}
              onChange={(e) => setFormSiteId(e.target.value)}
              fetchOptions={fetchSiteOptions}
              emptyOption={{ label: t('assets.noSite'), value: '' }}
              selectedOption={siteSelectedOption}
            />
            <FormInput
              label={t('assets.manufacturer')}
              name="manufacturerId"
              type="select"
              value={formManufacturerId}
              onChange={(e) => setFormManufacturerId(e.target.value)}
              fetchOptions={fetchManufacturerOptions}
              emptyOption={{ label: t('assets.noManufacturer'), value: '' }}
              selectedOption={manufacturerSelectedOption}
            />
            <FormInput
              label={t('assets.vendor')}
              name="vendorId"
              type="select"
              value={formVendorId}
              onChange={(e) => setFormVendorId(e.target.value)}
              fetchOptions={fetchVendorOptions}
              emptyOption={{ label: t('assets.noVendor'), value: '' }}
              selectedOption={vendorSelectedOption}
            />
            <FormInput
              label={t('assets.category')}
              name="categoryId"
              type="select"
              value={formCategoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              fetchOptions={fetchCategoryOptions}
              emptyOption={{ label: t('assets.categoryNone'), value: '' }}
              selectedOption={categorySelectedOption}
            />
            <FormFieldSpan>
              <FormInput
                label={t('assets.note')}
                name="note"
                type="textarea"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
              />
            </FormFieldSpan>
          </FormFieldsGrid>
        </div>
      </details>

      {formCategoryId && (
        <details className="rounded-lg border border-border p-3" open>
          <summary className="cursor-pointer text-sm font-medium">{t('assets.customFields')}</summary>
          <div className="mt-3">
            {formCategoryFields.length === 0 ? (
              <p className="text-sm text-muted">{t('assets.noCustomFields')}</p>
            ) : (
              <FormFieldsGrid>{formCategoryFields.map(renderCustomFieldInput)}</FormFieldsGrid>
            )}
          </div>
        </details>
      )}

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{t('assets.locationSection')}</summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted">
            {t('assets.overrideHint')} {t('sites.pickHint')}
          </p>
          <LocationPicker value={pickerValue} onChange={onPick} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 [&>div]:mb-0">
            <FormInput
              label={t('assets.latitude')}
              name="latitude"
              type="number"
              value={formLat}
              onChange={(e) => setFormLat(e.target.value)}
            />
            <FormInput
              label={t('assets.longitude')}
              name="longitude"
              type="number"
              value={formLng}
              onChange={(e) => setFormLng(e.target.value)}
            />
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{t('assets.financialSection')}</summary>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormInput
            label={t('assets.purchaseDate')}
            name="purchaseDate"
            type="date"
            value={formPurchaseDate}
            onChange={(e) => setFormPurchaseDate(e.target.value)}
          />
          <FormInput
            label={t('assets.purchaseCost')}
            name="purchaseCost"
            type="number"
            value={formPurchaseCost}
            onChange={(e) => setFormPurchaseCost(e.target.value)}
          />
          <FormInput
            label={t('assets.salvageValue')}
            name="salvageValue"
            type="number"
            value={formSalvageValue}
            onChange={(e) => setFormSalvageValue(e.target.value)}
          />
          <FormInput
            label={t('assets.usefulLifeMonths')}
            name="usefulLifeMonths"
            type="number"
            value={formUsefulLifeMonths}
            onChange={(e) => setFormUsefulLifeMonths(e.target.value)}
          />
          <FormInput
            label={t('assets.warrantyEndDate')}
            name="warrantyEndDate"
            type="date"
            testId="asset-warranty-end-date"
            value={formWarrantyEndDate}
            onChange={(e) => setFormWarrantyEndDate(e.target.value)}
          />
        </div>
      </details>

      <details
        className="rounded-lg border border-border p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <summary className="cursor-pointer text-sm font-medium">{t('assets.imagesSection')}</summary>
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          {opts?.imagesAsset ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex gap-4 items-start min-w-0">
                <AssetImage
                  assetId={opts.imagesAsset.id}
                  name={opts.imagesAsset.name}
                  hasImage={opts.imagesAsset.imageFilename}
                  size={112}
                  version={imageVersion}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-1">{t('assets.image')}</p>
                  <AssetImageUploader
                    assetId={opts.imagesAsset.id}
                    hasImage={opts.imagesAsset.imageFilename}
                    onChanged={() => refreshModalAsset(opts.imagesAsset!.id)}
                  />
                </div>
              </div>
              <AssetQrPanel
                compact
                assetId={opts.imagesAsset.id}
                assetName={opts.imagesAsset.name}
                siteName={opts.imagesAsset.siteName}
                detailUrl={opts.imagesAsset.detailUrl ?? ''}
              />
            </div>
          ) : (
            <p className="text-sm text-muted">{t('assets.imagesSaveFirstHint')}</p>
          )}
        </div>
      </details>
    </div>
  );

  if (!isAdmin) return null;

  return (
    <PageContent size="wide">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold">{t('assets.title')}</h1>
        <Button onClick={openCreateModal}>{t('assets.create')}</Button>
      </div>

      <div className="mb-4 flex flex-row flex-wrap items-center gap-3">
        <SearchInput
          className="mb-0! h-10 min-w-0 flex-1 basis-full sm:basis-auto"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={t('assets.searchPlaceholder')}
        />
        <SearchSelect
          name="statusFilter"
          ariaLabel={t('assets.status')}
          value={filterStatus}
          onChange={(value) => {
            setFilterStatus(value);
            setPage(1);
          }}
          options={statusFilterOptions}
          emptyOption={{ label: t('assets.allStatuses'), value: '' }}
          hideSearch
          className="mb-0! w-56 shrink-0"
        />
        <SearchSelect
          name="siteFilter"
          ariaLabel={t('assets.site')}
          value={filterSiteId}
          onChange={applySiteFilter}
          fetchOptions={fetchSiteFilterOptions}
          emptyOption={{ label: t('assets.allSites'), value: '' }}
          selectedOption={filterSiteSelected}
          searchPlaceholder={t('sites.searchPlaceholder')}
          className="mb-0! w-56 shrink-0"
        />
        <SearchSelect
          name="manufacturerFilter"
          ariaLabel={t('assets.manufacturer')}
          value={filterManufacturerId}
          onChange={applyManufacturerFilter}
          fetchOptions={fetchManufacturerFilterOptions}
          emptyOption={{ label: t('assets.allManufacturers'), value: '' }}
          selectedOption={filterManufacturerSelected}
          searchPlaceholder={t('manufacturers.searchPlaceholder')}
          className="mb-0! w-56 shrink-0"
        />
        <SearchSelect
          name="vendorFilter"
          ariaLabel={t('assets.vendor')}
          value={filterVendorId}
          onChange={applyVendorFilter}
          fetchOptions={fetchVendorFilterOptions}
          emptyOption={{ label: t('assets.allVendors'), value: '' }}
          selectedOption={filterVendorSelected}
          searchPlaceholder={t('vendors.searchPlaceholder')}
          className="mb-0! w-56 shrink-0"
        />
        <SearchSelect
          name="categoryFilter"
          ariaLabel={t('assets.category')}
          value={filterCategoryId}
          onChange={applyCategoryFilter}
          fetchOptions={fetchCategoryFilterOptions}
          emptyOption={{ label: t('assets.allCategories'), value: '' }}
          selectedOption={filterCategorySelected}
          searchPlaceholder={t('categories.searchPlaceholder')}
          className="mb-0! w-56 shrink-0"
        />
      </div>

      <p className="text-sm text-muted mb-4">{t('assets.multiSelectHint')}</p>

      {selection.count > 0 && (
        <p className="text-sm text-muted mb-2">{t('assets.qrSelectionKept')}</p>
      )}

      {selection.count > 0 && (
        <div className="sticky bottom-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-surface px-4 py-3 shadow-md">
          <span className="text-sm font-medium">
            {t('assets.qrPrintSelected').replace('{count}', String(selection.count))}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="tertiary"
              onClick={selection.clear}
            >
              {t('assets.qrClearSelection')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setBulkAssignOpen(true)}
            >
              {t('bulkAssign.openButton')}
            </Button>
            <Button
              type="button"
              onClick={handlePrintSelected}
            >
              {t('assets.qrPrint')}
            </Button>
          </div>
        </div>
      )}

      <Panel>
        {loading ? (
          <TableSkeleton
            columns={10}
            actionsColumn
          />
        ) : (
          <>
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell
                  className="pr-2 w-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={pageHeaderCheckboxRef}
                    type="checkbox"
                    className="size-4 cursor-pointer"
                    checked={pageIds.length > 0 && pageSelectState.all}
                    onChange={handlePageSelectAll}
                    aria-label={t('assets.qrSelectPage')}
                  />
                </TableHeaderCell>
                <TableHeaderCell className="w-12">{t('assets.image')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.name')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.note')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.model')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.serialNumber')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.status')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.assignedUser')}</TableHeaderCell>
                <TableHeaderCell>{t('assets.site')}</TableHeaderCell>
                <TableHeaderCell last />
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {assets.map((asset) => (
                <TableRow
                  key={asset.id}
                  striped
                  onClick={() => void navigate(`/admin/assets/${asset.id}`)}
                >
                  <TableCell
                    className="pr-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer"
                      checked={selection.isSelected(asset.id)}
                      onChange={() => selection.toggle(assetToSelectionItem(asset))}
                      aria-label={asset.name}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <AssetImageHoverPreview
                      assetId={asset.id}
                      name={asset.name}
                      hasImage={asset.imageFilename}
                      version={imageVersion}
                    />
                  </TableCell>
                  <TableCell>
                    <TableCellText value={asset.name} />
                  </TableCell>
                  <TableCell className="text-muted">
                    <TableCellText value={asset.note} />
                  </TableCell>
                  <TableCell className="text-muted">
                    <TableCellText value={asset.model} />
                  </TableCell>
                  <TableCell className="font-mono">
                    <TableCellText value={asset.serialNumber} />
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <AssetStatusBadge status={asset.status}>{statusLabel(asset.status)}</AssetStatusBadge>
                      {pendingHandoversByAssetId[asset.id] && (
                        <HoverTooltip content={pendingHandoverTooltip(pendingHandoversByAssetId[asset.id])}>
                          <Badge
                            variant="warning"
                            className="inline-flex items-center gap-1 cursor-help"
                            data-testid={`asset-pending-handover-${asset.id}`}
                          >
                            <svg
                              className="w-3 h-3 shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {t('handover.admin.pendingBadge')}
                          </Badge>
                        </HoverTooltip>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
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
                  <TableCell>
                    {asset.siteName ? (
                      <TableCellText value={asset.siteName} />
                    ) : (
                      <span className="text-muted">{t('assets.noSite')}</span>
                    )}
                  </TableCell>
                  <TableCell last onClick={(e) => e.stopPropagation()}>
                    <TableRowActions
                      onEdit={() => openEditModal(asset)}
                      onDelete={() => openDeleteModal(asset)}
                      editLabel={t('assets.edit')}
                      deleteLabel={t('assets.delete')}
                      leadingAction={
                        <AssetQrHoverPreview
                          assetId={asset.id}
                          name={asset.name}
                          title={t('assets.qr')}
                        />
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            {assets.length === 0 && <p className="py-8 text-center text-muted">{t('assets.empty')}</p>}
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

      <BulkAssignWizard
        isOpen={bulkAssignOpen}
        onClose={() => setBulkAssignOpen(false)}
        items={selection.items}
        fetchUserOptions={fetchUserOptions}
        onAssigned={(succeededIds) => {
          selection.remove(succeededIds);
          void fetchAssets(getAssetListQuery());
        }}
      />

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title={t('assets.create')}
        size="lg"
      >
        <form onSubmit={(e) => void handleCreateSubmit(e)}>
          {renderFormFields({ imagesAsset: createModalAsset })}
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="tertiary"
              type="button"
              onClick={closeCreateModal}
            >
              {createModalAsset ? t('common.close') : t('common.cancel')}
            </Button>
            {!createModalAsset && (
              <Button
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? t('common.loading')
                  : formVerifyHandover
                    ? t('handover.admin.assignWithVerification')
                    : t('assets.create')}
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingAsset(null);
          setEditModalHandover(null);
        }}
        title={t('assets.edit')}
        size="lg"
      >
        <form onSubmit={(e) => void handleEditSubmit(e)}>
          {renderFormFields({ imagesAsset: editingAsset })}
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditingAsset(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? t('common.loading')
                : formVerifyHandover
                  ? t('handover.admin.assignWithVerification')
                  : t('profile.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingAsset(null);
        }}
        title={t('assets.delete')}
        size="lg"
      >
        <p className="mb-4">{t('assets.deleteConfirm')}</p>
        {deletingAsset && (
          <p className="mb-4 text-muted">
            {deletingAsset.name} ({deletingAsset.serialNumber})
          </p>
        )}
        <form onSubmit={(e) => void handleDeleteSubmit(e)}>
          <div className="flex gap-2 justify-end">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingAsset(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              type="submit"
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? t('common.loading') : t('assets.delete')}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContent>
  );
}
