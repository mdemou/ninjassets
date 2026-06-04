import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { usePageTitleSection } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { AssetImage } from '~/components/AssetImage';
import { AssetImageUploader } from '~/components/AssetImageUploader';
import {
  ASSET_DETAIL_TAB_ICONS,
  AssetDetailTabBar,
  type AssetDetailTabId,
  type AssetDetailTabItem,
} from '~/components/AssetDetailTabBar';
import { AssetQrPanel } from '~/components/AssetQrPanel';
import { Button } from '~/components/Button';
import { CustodyDocumentsPanel } from '~/components/CustodyDocumentsPanel';
import { HandoverPanel } from '~/components/HandoverPanel';
import { FormFieldSpan, FormFieldsGrid } from '~/components/FormFieldsGrid';
import { FormInput } from '~/components/FormInput';
import { HistoryTable } from '~/components/HistoryTable';
import { DetailPanelSkeleton } from '~/components/LoadingSkeleton';
import { LocationPicker } from '~/components/Map';
import { PageContent } from '~/components/PageContent';
import { Panel } from '~/components/Panel';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import { Modal } from '~/components/Modal';
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
  ListTransactionsData,
  ListUsersData,
  ListVendorsData,
} from '~/types';
import { api } from '~/utils/api';
import {
  assetSerialAlreadyExistsMessage,
  isAssetSerialAlreadyExistsError,
  resolveAssetApiErrorMessage,
} from '~/utils/assetApiErrors';
import { ALERT_BADGE_CLASS, getAssetDateAlerts } from '~/utils/assetDateAlerts';
import { ASSET_STATUS_BADGE_CLASS, ASSET_STATUS_OPTIONS } from '~/utils/assetStatus';

export const meta = pageMeta('assets.detailTitle');

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/70 bg-gradient-to-br from-surface via-surface to-muted/20 p-5 space-y-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </section>
  );
}

export default function AdminAssetDetail() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const statusSelectOptions = useMemo(
    () =>
      ASSET_STATUS_OPTIONS.map((s) => ({
        label: t(s.labelKey),
        value: s.value,
        badgeClass: ASSET_STATUS_BADGE_CLASS[s.value],
      })),
    [t],
  );

  const [asset, setAsset] = useState<Asset | null>(null);
  const [assetLoading, setAssetLoading] = useState(true);

  const pageTitleSection = useMemo(
    () => (asset?.name ? `${t('assets.detailTitle')} — ${asset.name}` : t('assets.detailTitle')),
    [asset?.name, t],
  );
  usePageTitleSection(pageTitleSection);

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
  const [formPurchaseDate, setFormPurchaseDate] = useState('');
  const [formPurchaseCost, setFormPurchaseCost] = useState('');
  const [formSalvageValue, setFormSalvageValue] = useState('');
  const [formUsefulLifeMonths, setFormUsefulLifeMonths] = useState('');
  const [formWarrantyEndDate, setFormWarrantyEndDate] = useState('');
  const [formExpectedReturnDate, setFormExpectedReturnDate] = useState('');
  const [formVerifyHandover, setFormVerifyHandover] = useState(false);
  const [openHandover, setOpenHandover] = useState<Handover | null>(null);
  const [handoverBusy, setHandoverBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);

  const [linkChildId, setLinkChildId] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [componentName, setComponentName] = useState('');
  const [componentSerial, setComponentSerial] = useState('');
  const [componentStatus, setComponentStatus] = useState<AssetStatus>('STOCK');
  const [componentSubmitting, setComponentSubmitting] = useState(false);
  const [formSerialError, setFormSerialError] = useState<string | null>(null);
  const [componentSerialError, setComponentSerialError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AssetDetailTabId>('details');

  const [transactions, setTransactions] = useState<ListTransactionsData['transactions']>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);
  const [txSearch, setTxSearch] = useState('');
  const [txLoading, setTxLoading] = useState(true);

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

  const syncFormFromAsset = useCallback((loaded: Asset) => {
    setFormVerifyHandover(false);
    setFormName(loaded.name);
    setFormModel(loaded.model);
    setFormSerial(loaded.serialNumber);
    setFormStatus(loaded.status);
    setFormAssignedUserId(loaded.assignedUserId ?? '');
    setFormSiteId(loaded.siteId ?? '');
    setFormLat(loaded.latitude != null ? String(loaded.latitude) : '');
    setFormLng(loaded.longitude != null ? String(loaded.longitude) : '');
    setFormNote(loaded.note ?? '');
    setFormManufacturerId(loaded.manufacturerId ?? '');
    setFormVendorId(loaded.vendorId ?? '');
    setFormCategoryId(loaded.categoryId ?? '');
    setFormCustomFields({ ...(loaded.customFields ?? {}) });
    void loadCategoryFields(loaded.categoryId ?? '');
    setFormPurchaseDate(loaded.purchaseDate ?? '');
    setFormPurchaseCost(loaded.purchaseCost != null ? String(loaded.purchaseCost) : '');
    setFormSalvageValue(loaded.salvageValue != null ? String(loaded.salvageValue) : '');
    setFormUsefulLifeMonths(loaded.usefulLifeMonths != null ? String(loaded.usefulLifeMonths) : '');
    setFormWarrantyEndDate(loaded.warrantyEndDate ?? '');
    setFormExpectedReturnDate(loaded.expectedReturnDate ?? '');
  }, [loadCategoryFields]);

  const fetchAsset = useCallback(async () => {
    if (!assetId) return;
    setAssetLoading(true);
    try {
      const res = await api.get<{ asset: Asset }>(`/api/p/assets/${assetId}`);
      const loaded = res.data?.asset ?? null;
      setAsset(loaded);
      if (loaded) syncFormFromAsset(loaded);
    } catch (err) {
      const error = err as ApiResponse;
      addToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || t('common.error'),
      });
      void navigate('/admin/assets', { replace: true });
    } finally {
      setAssetLoading(false);
    }
  }, [assetId, addToast, t, navigate, syncFormFromAsset]);

  const fetchOpenHandover = useCallback(async () => {
    if (!assetId) return;
    try {
      const res = await api.get<ListHandoversData>(`/api/p/assets/${assetId}/handovers`);
      const open = (res.data?.handovers ?? []).find(
        (h) => h.status === 'OPEN' && new Date(h.expiresAt) > new Date(),
      );
      setOpenHandover(open ?? null);
    } catch {
      setOpenHandover(null);
    }
  }, [assetId]);

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

  const handleCategoryChange = useCallback(
    (value: string) => {
      setFormCategoryId(value);
      void loadCategoryFields(value);
    },
    [loadCategoryFields],
  );

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

  const fetchEligibleChildOptions = useCallback(
    async (search: string) => {
      if (!assetId) return [];
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', '1');
      params.set('eligibleChild', 'true');
      params.set('excludeId', assetId);
      const res = await api.get<ListAssetsData>(`/api/p/assets?${params.toString()}`);
      return (res.data?.assets ?? []).map((a) => ({
        label: `${a.name} (${a.serialNumber})`,
        value: a.id,
      }));
    },
    [assetId],
  );

  const fetchTransactions = useCallback(
    async (opts: { search: string; page: number }) => {
      if (!assetId) return;
      setTxLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        params.set('page', String(opts.page));
        const res = await api.get<ListTransactionsData>(
          `/api/p/assets/${assetId}/transactions?${params.toString()}`,
        );
        setTransactions(res.data?.transactions ?? []);
        setTxTotal(res.data?.total ?? 0);
        if (res.data?.pageSize) setTxPageSize(res.data.pageSize);
      } catch (err) {
        const error = err as ApiResponse;
        addToast({
          type: 'error',
          title: t('common.error'),
          message: error.message || t('common.error'),
        });
      } finally {
        setTxLoading(false);
      }
    },
    [assetId, addToast, t],
  );

  useEffect(() => {
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/', { replace: true });
    }
  }, [userLoading, user, navigate]);

  useEffect(() => {
    if (!isAdmin || !assetId) return;
    void fetchAsset();
    void fetchOpenHandover();
  }, [isAdmin, assetId, fetchAsset, fetchOpenHandover]);

  useEffect(() => {
    if (!isAdmin || !assetId) return;
    const handle = setTimeout(() => {
      void fetchTransactions({ search: txSearch, page: txPage });
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdmin, assetId, txSearch, txPage, fetchTransactions]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  const handleAssigneeChange = (userId: string) => {
    setFormAssignedUserId(userId);
    if (userId) {
      setFormStatus('ASSIGNED');
      if (asset?.status === 'STOCK' && !openHandover) setFormVerifyHandover(true);
    } else {
      setFormVerifyHandover(false);
    }
  };

  const handleStatusChange = (status: AssetStatus) => {
    setFormStatus(status);
    if (status !== 'ASSIGNED') {
      setFormAssignedUserId('');
      setFormVerifyHandover(false);
    }
  };

  const handleCancelOpenHandover = async () => {
    if (!openHandover || !window.confirm(t('handover.admin.confirmCancel'))) return;
    setHandoverBusy(true);
    try {
      await api.post(`/api/p/handovers/${openHandover.id}/cancel`);
      setOpenHandover(null);
      void fetchAsset();
      void fetchTransactions({ search: txSearch, page: txPage });
      addToast({ type: 'success', title: t('common.success'), message: t('handover.admin.cancel') });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setHandoverBusy(false);
    }
  };

  const handleCompleteOpenHandover = async () => {
    if (!openHandover || !window.confirm(t('handover.admin.confirmComplete'))) return;
    setHandoverBusy(true);
    try {
      await api.post(`/api/p/handovers/${openHandover.id}/complete`);
      setOpenHandover(null);
      void fetchAsset();
      void fetchTransactions({ search: txSearch, page: txPage });
      addToast({ type: 'success', title: t('common.success'), message: t('assets.updateSuccess') });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setHandoverBusy(false);
    }
  };

  const buildPayload = () => {
    const purchaseCost = formPurchaseCost !== '' ? Number(formPurchaseCost) : null;
    const hasFinancial =
      formPurchaseDate !== '' ||
      purchaseCost != null ||
      formSalvageValue !== '' ||
      formUsefulLifeMonths !== '';
    return {
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
      depreciationMethod:
        hasFinancial && purchaseCost != null ? ('STRAIGHT_LINE' as const) : null,
      warrantyEndDate: formWarrantyEndDate || null,
      expectedReturnDate: formExpectedReturnDate || null,
    };
  };

  const validateAssignment = (): boolean => {
    if (formStatus === 'ASSIGNED' && !formAssignedUserId) {
      addToast({ type: 'error', title: t('common.error'), message: t('assets.assignedUserRequired') });
      return false;
    }
    return true;
  };

  const handleAssetFormApiError = (err: unknown, target: 'main' | 'component'): void => {
    const error = err as ApiResponse;
    if (isAssetSerialAlreadyExistsError(error)) {
      const message = assetSerialAlreadyExistsMessage(t);
      if (target === 'component') {
        setComponentSerialError(message);
      } else {
        setFormSerialError(message);
      }
    }
    addToast({
      type: 'error',
      title: t('common.error'),
      message: resolveAssetApiErrorMessage(error, t),
    });
  };

  const isFormDirty = (() => {
    if (!asset) return false;
    const payload = buildPayload();
    return (
      payload.name !== asset.name ||
      payload.model !== asset.model ||
      payload.serialNumber !== asset.serialNumber ||
      payload.status !== asset.status ||
      (payload.assignedUserId ?? '') !== (asset.assignedUserId ?? '') ||
      (payload.siteId ?? '') !== (asset.siteId ?? '') ||
      payload.latitude !== asset.latitude ||
      payload.longitude !== asset.longitude ||
      (payload.note ?? '') !== (asset.note ?? '') ||
      (payload.manufacturerId ?? '') !== (asset.manufacturerId ?? '') ||
      (payload.vendorId ?? '') !== (asset.vendorId ?? '') ||
      (payload.purchaseDate ?? '') !== (asset.purchaseDate ?? '') ||
      payload.purchaseCost !== asset.purchaseCost ||
      payload.salvageValue !== asset.salvageValue ||
      payload.usefulLifeMonths !== asset.usefulLifeMonths ||
      (payload.warrantyEndDate ?? '') !== (asset.warrantyEndDate ?? '') ||
      (payload.expectedReturnDate ?? '') !== (asset.expectedReturnDate ?? '')
    );
  })();

  const dateAlerts = asset ? getAssetDateAlerts(asset) : [];

  const detailTabs = useMemo((): AssetDetailTabItem[] => {
    if (!asset) return [];
    const tabs: AssetDetailTabItem[] = [
      { id: 'details', labelKey: 'assets.tab.details', icon: ASSET_DETAIL_TAB_ICONS.details },
      {
        id: 'custody',
        labelKey: 'assets.tab.custody',
        icon: ASSET_DETAIL_TAB_ICONS.custody,
        alert: !!openHandover,
      },
      { id: 'documents', labelKey: 'assets.tab.documents', icon: ASSET_DETAIL_TAB_ICONS.documents },
    ];
    if (!asset.parentAssetId) {
      tabs.push({
        id: 'components',
        labelKey: 'assets.tab.components',
        icon: ASSET_DETAIL_TAB_ICONS.components,
        count: asset.childCount ?? asset.children?.length ?? 0,
      });
    }
    tabs.push({ id: 'history', labelKey: 'assets.tab.history', icon: ASSET_DETAIL_TAB_ICONS.history });
    return tabs;
  }, [asset, openHandover]);

  useEffect(() => {
    if (asset?.parentAssetId && activeTab === 'components') {
      setActiveTab('details');
    }
  }, [asset?.parentAssetId, activeTab]);

  const statusLabel =
    statusSelectOptions.find((o) => o.value === asset?.status)?.label ?? asset?.status ?? '';

  const handleDetach = async () => {
    if (!assetId || !window.confirm(t('assets.detachConfirm'))) return;
    setSubmitting(true);
    try {
      const res = await api.patch<{ asset: Asset }>(`/api/p/assets/${assetId}`, { parentAssetId: null });
      setAsset(res.data?.asset ?? null);
      if (res.data?.asset) syncFormFromAsset(res.data.asset);
      addToast({ type: 'success', title: t('common.success'), message: t('assets.componentDetached') });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkChild = async () => {
    if (!assetId || !linkChildId) return;
    setLinkSubmitting(true);
    try {
      await api.patch(`/api/p/assets/${linkChildId}`, { parentAssetId: assetId });
      addToast({ type: 'success', title: t('common.success'), message: t('assets.componentLinked') });
      setLinkChildId('');
      void fetchAsset();
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleCreateComponent = async (e: FormEvent) => {
    e.preventDefault();
    if (!assetId) return;
    setComponentSubmitting(true);
    setComponentSerialError(null);
    try {
      await api.post('/api/p/assets', {
        name: componentName,
        serialNumber: componentSerial,
        status: componentStatus,
        parentAssetId: assetId,
      });
      addToast({ type: 'success', title: t('common.success'), message: t('assets.createSuccess') });
      setShowComponentModal(false);
      setComponentName('');
      setComponentSerial('');
      setComponentStatus('STOCK');
      void fetchAsset();
    } catch (err) {
      handleAssetFormApiError(err, 'component');
    } finally {
      setComponentSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!assetId || !asset) return;

    if (formVerifyHandover && formStatus === 'ASSIGNED' && formAssignedUserId) {
      setSubmitting(true);
      setFormSerialError(null);
      try {
        // Save any other field changes while keeping the asset's current status/assignee
        // (the handover will apply the assignment once the recipient confirms).
        const payload = buildPayload();
        await api.patch<{ asset: Asset }>(`/api/p/assets/${assetId}`, {
          ...payload,
          status: asset.status,
          assignedUserId: asset.assignedUserId ?? null,
        });
        await api.post(`/api/p/assets/${assetId}/handovers`, {
          type: 'CHECK_OUT',
          targetUserId: formAssignedUserId,
          sendEmail: true,
        });
        addToast({ type: 'success', title: t('common.success'), message: t('assets.updateSuccess') });
        void fetchAsset();
        void fetchTransactions({ search: txSearch, page: txPage });
      } catch (err) {
        handleAssetFormApiError(err, 'main');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!validateAssignment()) return;
    setSubmitting(true);
    setFormSerialError(null);
    try {
      const res = await api.patch<{ asset: Asset }>(`/api/p/assets/${assetId}`, buildPayload());
      const updated = res.data?.asset ?? null;
      setAsset(updated);
      if (updated) syncFormFromAsset(updated);
      addToast({ type: 'success', title: t('common.success'), message: t('assets.updateSuccess') });
    } catch (err) {
      handleAssetFormApiError(err, 'main');
    } finally {
      setSubmitting(false);
    }
  };

  const assigneeSelectedOption =
    formAssignedUserId && asset?.assignedUserId === formAssignedUserId
      ? {
          value: formAssignedUserId,
          label: asset.assignedUserEmail
            ? `${asset.assignedUserName} (${asset.assignedUserEmail})`
            : (asset.assignedUserName ?? formAssignedUserId),
        }
      : null;

  const siteSelectedOption =
    formSiteId && asset?.siteId === formSiteId
      ? { value: formSiteId, label: asset.siteName ?? formSiteId }
      : null;

  const manufacturerSelectedOption =
    formManufacturerId && asset?.manufacturerId === formManufacturerId
      ? { value: formManufacturerId, label: asset.manufacturerName ?? formManufacturerId }
      : null;

  const vendorSelectedOption =
    formVendorId && asset?.vendorId === formVendorId
      ? { value: formVendorId, label: asset.vendorName ?? formVendorId }
      : null;

  const categorySelectedOption =
    formCategoryId && asset?.categoryId === formCategoryId
      ? { value: formCategoryId, label: asset.categoryName ?? formCategoryId }
      : null;

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

  const pickerValue =
    formLat !== '' && formLng !== '' && !Number.isNaN(Number(formLat)) && !Number.isNaN(Number(formLng))
      ? { lat: Number(formLat), lng: Number(formLng) }
      : null;

  const onPick = (coords: { lat: number; lng: number }) => {
    setFormLat(coords.lat.toFixed(6));
    setFormLng(coords.lng.toFixed(6));
  };

  if (!isAdmin) return null;

  return (
    <PageContent size="wide">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="tertiary"
          type="button"
          onClick={() => void navigate('/admin/assets')}
        >
          {t('assets.backToList')}
        </Button>
      </div>

      {assetLoading ? (
        <DetailPanelSkeleton className="mb-6" />
      ) : asset ? (
        <>
          <header className="mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-primary/[0.07] shadow-sm">
            <div className="flex flex-col sm:flex-row gap-5 p-6">
              <div className="shrink-0 ring-2 ring-border/60 rounded-xl overflow-hidden shadow-md">
                <AssetImage
                  assetId={asset.id}
                  name={asset.name}
                  hasImage={asset.imageFilename}
                  size={96}
                  version={imageVersion}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight truncate">{asset.name}</h1>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ASSET_STATUS_BADGE_CLASS[asset.status]}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="font-mono text-sm text-muted">{asset.serialNumber}</p>
                {asset.model ? <p className="text-sm text-muted">{asset.model}</p> : null}
                {dateAlerts.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {dateAlerts.map((key) => (
                      <span
                        key={key}
                        className={`text-xs font-medium px-2 py-1 rounded ${ALERT_BADGE_CLASS[key]}`}
                      >
                        {t(key)}
                      </span>
                    ))}
                  </div>
                )}
                {asset.parentAssetId && (
                  <div className="flex flex-wrap items-center gap-2 text-sm pt-1">
                    <span className="text-muted">{t('assets.partOf')}:</span>
                    <Link
                      to={`/admin/assets/${asset.parentAssetId}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {asset.parentAssetName ?? asset.parentAssetId}
                    </Link>
                    <Button
                      variant="tertiary"
                      type="button"
                      onClick={() => void handleDetach()}
                      disabled={submitting}
                    >
                      {t('assets.detach')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <AssetDetailTabBar tabs={detailTabs} active={activeTab} onChange={setActiveTab} />

          <div
            role="tabpanel"
            id={`asset-panel-${activeTab}`}
            aria-labelledby={`asset-tab-${activeTab}`}
            className="mt-4 transition-opacity duration-200"
          >
            {activeTab === 'details' && (
              <Panel>
                <form onSubmit={(e) => void handleEditSubmit(e)}>
                  <div className="space-y-4">
                    <DetailSection title={t('assets.generalSection')}>
                  {openHandover && (
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
                            {openHandover.type === 'CHECK_OUT' ? t('handover.admin.typeCheckout') : t('handover.admin.typeCheckin')}
                            {' · '}
                            {openHandover.targetUserName ?? openHandover.targetUserEmail ?? '—'}
                          </p>
                          <p className="text-xs text-muted">
                            {t('handover.admin.expires')}: {new Date(openHandover.expiresAt).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted">{t('handover.admin.pendingBlockSubtext')}</p>
                          <div className="flex gap-2 pt-1 flex-wrap">
                            <Button variant="secondary" onClick={() => void handleCompleteOpenHandover()} disabled={handoverBusy}>
                              {t('handover.admin.complete')}
                            </Button>
                            <Button variant="danger" onClick={() => void handleCancelOpenHandover()} disabled={handoverBusy}>
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
                      disabled={!!openHandover}
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
                      disabled={!!openHandover}
                    />
                    {formStatus === 'ASSIGNED' && formAssignedUserId && asset?.status === 'STOCK' && !openHandover && (
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
                    {formCategoryId && formCategoryFields.length > 0 && (
                      <FormFieldSpan>
                        <p className="text-sm font-medium mb-2">{t('assets.customFields')}</p>
                        <FormFieldsGrid>{formCategoryFields.map(renderCustomFieldInput)}</FormFieldsGrid>
                      </FormFieldSpan>
                    )}
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
                    </DetailSection>

                    <DetailSection title={t('assets.locationSection')}>
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
                    </DetailSection>

                    <DetailSection title={t('assets.financialSection')}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                {asset.bookValue != null && (
                  <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-muted">{t('assets.bookValue')}</dt>
                      <dd className="font-medium">{asset.bookValue}</dd>
                    </div>
                    {asset.monthlyDepreciation != null && (
                      <div>
                        <dt className="text-muted">{t('assets.monthlyDepreciation')}</dt>
                        <dd className="font-medium">{asset.monthlyDepreciation}</dd>
                      </div>
                    )}
                    {asset.accumulatedDepreciation != null && (
                      <div>
                        <dt className="text-muted">{t('assets.accumulatedDepreciation')}</dt>
                        <dd className="font-medium">{asset.accumulatedDepreciation}</dd>
                      </div>
                    )}
                  </dl>
                )}
                    </DetailSection>

                    <DetailSection title={t('assets.imagesSection')}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex gap-4 items-start min-w-0">
                    <AssetImage
                      assetId={asset.id}
                      name={asset.name}
                      hasImage={asset.imageFilename}
                      size={112}
                      version={imageVersion}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-1">{t('assets.image')}</p>
                      <AssetImageUploader
                        assetId={asset.id}
                        hasImage={asset.imageFilename}
                        onChanged={() => {
                          setImageVersion((v) => v + 1);
                          void fetchAsset();
                        }}
                      />
                    </div>
                  </div>
                  <AssetQrPanel
                    compact
                    assetId={asset.id}
                    assetName={asset.name}
                    siteName={asset.siteName}
                    detailUrl={asset.detailUrl ?? ''}
                  />
                      </div>
                    </DetailSection>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6 pt-4 border-t border-border sticky bottom-0 bg-surface/95 backdrop-blur-sm -mx-6 px-6 pb-0">
              <p className="text-sm text-muted">
                {t('assets.createdAt')}: {formatDate(asset.dateCreated)}
                <span className="mx-2 hidden sm:inline">·</span>
                <span className="block sm:inline mt-1 sm:mt-0">
                  {t('assets.updatedAt')}: {formatDate(asset.dateUpdated)}
                </span>
              </p>
              <Button
                type="submit"
                disabled={submitting || (!isFormDirty && !formVerifyHandover)}
              >
                {submitting
                  ? t('common.loading')
                  : formVerifyHandover
                    ? t('handover.admin.assignWithVerification')
                    : t('profile.save')}
              </Button>
                  </div>
                </form>
              </Panel>
            )}

            {activeTab === 'custody' && (
              <Panel>
                <HandoverPanel
                  embedded
                  assetId={asset.id}
                  status={asset.status}
                  assignedUserId={asset.assignedUserId}
                  assignedUserName={asset.assignedUserName}
                  onChanged={() => {
                    void fetchAsset();
                    void fetchOpenHandover();
                    void fetchTransactions({ search: txSearch, page: txPage });
                  }}
                />
              </Panel>
            )}

            {activeTab === 'documents' && (
              <Panel>
                <CustodyDocumentsPanel
                  embedded
                  assetId={asset.id}
                  status={asset.status}
                  assignedUserId={asset.assignedUserId}
                  onChanged={() => {
                    void fetchTransactions({ search: txSearch, page: txPage });
                  }}
                />
              </Panel>
            )}

            {activeTab === 'components' && !asset.parentAssetId && (
              <Panel title={t('assets.componentsSection')}>
                <div className="space-y-4">
              {(asset.children?.length ?? 0) > 0 && (
                <Table>
                  <TableHead>
                    <TableHeaderRow>
                      <TableHeaderCell>{t('assets.name')}</TableHeaderCell>
                      <TableHeaderCell>{t('assets.serialNumber')}</TableHeaderCell>
                      <TableHeaderCell last>{t('assets.status')}</TableHeaderCell>
                    </TableHeaderRow>
                  </TableHead>
                  <TableBody>
                    {asset.children?.map((child) => (
                      <TableRow key={child.id} className="border-b border-border/50">
                        <TableCell>
                          <Link to={`/admin/assets/${child.id}`} className="text-primary hover:underline">
                            <TableCellText value={child.name} empty="" />
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono">
                          <TableCellText value={child.serialNumber} />
                        </TableCell>
                        <TableCell last>
                          <TableCellText value={child.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <p className="text-sm text-muted mb-2">{t('assets.linkComponentHint')}</p>
                  <FormInput
                    label={t('assets.linkComponent')}
                    name="linkChildId"
                    type="select"
                    value={linkChildId}
                    onChange={(e) => setLinkChildId(e.target.value)}
                    fetchOptions={fetchEligibleChildOptions}
                    emptyOption={{ label: '—', value: '' }}
                  />
                </div>
                <Button
                  type="button"
                  disabled={!linkChildId || linkSubmitting}
                  onClick={() => void handleLinkChild()}
                >
                  {linkSubmitting ? t('common.loading') : t('assets.link')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setComponentName('');
                    setComponentSerial('');
                    setComponentStatus('STOCK');
                    setShowComponentModal(true);
                  }}
                >
                  {t('assets.addComponent')}
                </Button>
              </div>
                </div>
              </Panel>
            )}

            {activeTab === 'history' && (
              <Panel>
                <h2 className="text-lg font-semibold mb-4">{t('assets.transactionHistory')}</h2>
                <HistoryTable
                  transactions={transactions}
                  loading={txLoading}
                  page={txPage}
                  total={txTotal}
                  pageSize={txPageSize}
                  onPageChange={setTxPage}
                  search={{
                    value: txSearch,
                    onChange: (value) => {
                      setTxSearch(value);
                      setTxPage(1);
                    },
                  }}
                  showActor
                  showUser
                />
              </Panel>
            )}
          </div>
        </>
      ) : null}

      <Modal
        isOpen={showComponentModal}
        onClose={() => setShowComponentModal(false)}
        title={t('assets.addComponent')}
      >
        <form onSubmit={(e) => void handleCreateComponent(e)}>
          <FormInput
            label={t('assets.name')}
            name="componentName"
            value={componentName}
            onChange={(e) => setComponentName(e.target.value)}
            required
          />
          <FormInput
            label={t('assets.serialNumber')}
            name="componentSerial"
            value={componentSerial}
            onChange={(e) => {
              setComponentSerial(e.target.value);
              if (componentSerialError) setComponentSerialError(null);
            }}
            error={componentSerialError ?? undefined}
            required
          />
          <FormInput
            label={t('assets.status')}
            name="componentStatus"
            type="select"
            value={componentStatus}
            onChange={(e) => setComponentStatus(e.target.value as AssetStatus)}
            options={statusSelectOptions}
          />
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="tertiary" type="button" onClick={() => setShowComponentModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={componentSubmitting}>
              {componentSubmitting ? t('common.loading') : t('assets.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContent>
  );
}
