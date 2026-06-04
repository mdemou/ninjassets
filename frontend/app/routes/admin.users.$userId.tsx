import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { usePageTitleSection } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { AssetStatusBadge } from '~/components/AssetStatusBadge';
import { Avatar } from '~/components/Avatar';
import { AvatarUploader } from '~/components/AvatarUploader';
import { Button } from '~/components/Button';
import { FormFieldsGrid } from '~/components/FormFieldsGrid';
import { FormInput } from '~/components/FormInput';
import { HistoryTable } from '~/components/HistoryTable';
import { TableSkeleton, UserDetailPanelSkeleton } from '~/components/LoadingSkeleton';
import { PageContent } from '~/components/PageContent';
import { Pagination } from '~/components/Pagination';
import { Panel } from '~/components/Panel';
import { SearchInput } from '~/components/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '~/components/Table';
import { TableCellText } from '~/components/TableCellText';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type {
  AdminUser,
  ApiResponse,
  Asset,
  ListAssetsData,
  ListTransactionsData,
  UserRole,
  UserStatus,
} from '~/types';
import { api } from '~/utils/api';
import { ASSET_STATUS_LABEL_KEYS } from '~/utils/assetStatus';
import { USER_ROLE_BADGE_CLASS, USER_ROLE_OPTIONS } from '~/utils/userRole';
import { USER_STATUS_BADGE_CLASS, USER_STATUS_OPTIONS } from '~/utils/userStatus';

export const meta = pageMeta('adminUsers.detailTitle');

export default function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const roleSelectOptions = useMemo(
    () =>
      USER_ROLE_OPTIONS.map((r) => ({
        label: t(r.labelKey),
        value: r.value,
        badgeClass: USER_ROLE_BADGE_CLASS[r.value],
      })),
    [t],
  );

  const statusSelectOptions = useMemo(
    () =>
      USER_STATUS_OPTIONS.map((s) => ({
        label: t(s.labelKey),
        value: s.value,
        badgeClass: USER_STATUS_BADGE_CLASS[s.value],
      })),
    [t],
  );

  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [userLoadingState, setUserLoadingState] = useState(true);
  const [detailAvatarVersion, setDetailAvatarVersion] = useState(0);

  const pageTitleSection = useMemo(
    () =>
      detailUser
        ? `${t('adminUsers.detailTitle')} — ${detailUser.displayName || detailUser.email}`
        : t('adminUsers.detailTitle'),
    [detailUser, t],
  );
  usePageTitleSection(pageTitleSection);

  const [editEmail, setEditEmail] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRoleName, setEditRoleName] = useState<UserRole>('USER');
  const [editStatus, setEditStatus] = useState<UserStatus>('ACTIVE');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [assetsPage, setAssetsPage] = useState(1);
  const [assetsPageSize, setAssetsPageSize] = useState(20);
  const [assetsSearch, setAssetsSearch] = useState('');
  const [assetsLoading, setAssetsLoading] = useState(true);

  const [transactions, setTransactions] = useState<ListTransactionsData['transactions']>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);
  const [txSearch, setTxSearch] = useState('');
  const [txLoading, setTxLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    setUserLoadingState(true);
    try {
      const res = await api.get<{ user: AdminUser }>(`/api/p/users/${userId}`);
      setDetailUser(res.data?.user ?? null);
    } catch (err) {
      const error = err as ApiResponse;
      addToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || t('common.error'),
      });
      void navigate('/admin/users', { replace: true });
    } finally {
      setUserLoadingState(false);
    }
  }, [userId, addToast, t, navigate]);

  const handleAvatarUpload = useCallback(
    async (blob: Blob) => {
      if (!userId) return;
      try {
        await api.upload(`/api/p/users/${userId}/avatar`, blob);
        await fetchUser();
        setDetailAvatarVersion((v) => v + 1);
        addToast({ type: 'success', title: t('common.success'), message: t('avatar.uploadSuccess') });
      } catch (err) {
        const error = err as ApiResponse;
        addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
        throw err;
      }
    },
    [userId, fetchUser, addToast, t],
  );

  const handleAvatarRemove = useCallback(async () => {
    if (!userId) return;
    try {
      await api.delete(`/api/p/users/${userId}/avatar`);
      await fetchUser();
      setDetailAvatarVersion((v) => v + 1);
      addToast({ type: 'success', title: t('common.success'), message: t('avatar.removeSuccess') });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    }
  }, [userId, fetchUser, addToast, t]);

  const fetchAssets = useCallback(
    async (opts: { search: string; page: number }) => {
      if (!userId) return;
      setAssetsLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        params.set('page', String(opts.page));
        const res = await api.get<ListAssetsData>(`/api/p/users/${userId}/assets?${params.toString()}`);
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
    [userId, addToast, t],
  );

  const fetchTransactions = useCallback(
    async (opts: { search: string; page: number }) => {
      if (!userId) return;
      setTxLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        params.set('page', String(opts.page));
        const res = await api.get<ListTransactionsData>(
          `/api/p/users/${userId}/transactions?${params.toString()}`,
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
    [userId, addToast, t],
  );

  useEffect(() => {
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/', { replace: true });
    }
  }, [userLoading, user, navigate]);

  useEffect(() => {
    if (!isAdmin || !userId) return;
    void fetchUser();
  }, [isAdmin, userId, fetchUser]);

  useEffect(() => {
    if (!detailUser) return;
    setEditEmail(detailUser.email);
    setEditDisplayName(detailUser.displayName);
    setEditRoleName(detailUser.roleName);
    setEditStatus(detailUser.status);
  }, [detailUser]);

  useEffect(() => {
    if (!isAdmin || !userId) return;
    const handle = setTimeout(() => {
      void fetchAssets({ search: assetsSearch, page: assetsPage });
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdmin, userId, assetsSearch, assetsPage, fetchAssets]);

  useEffect(() => {
    if (!isAdmin || !userId) return;
    const handle = setTimeout(() => {
      void fetchTransactions({ search: txSearch, page: txPage });
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdmin, userId, txSearch, txPage, fetchTransactions]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  const isEditDirty =
    detailUser != null &&
    (editEmail !== detailUser.email ||
      editDisplayName !== detailUser.displayName ||
      editRoleName !== detailUser.roleName ||
      editStatus !== detailUser.status);

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || !detailUser) return;
    setEditSubmitting(true);
    try {
      const res = await api.patch<{ user: AdminUser }>(`/api/p/users/${userId}`, {
        email: editEmail,
        displayName: editDisplayName,
        roleName: editRoleName,
        status: editStatus,
      });
      setDetailUser(res.data?.user ?? null);
      addToast({
        type: 'success',
        title: t('common.success'),
        message: t('adminUsers.updateSuccess'),
      });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || t('common.error'),
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <PageContent size="wide">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="tertiary"
          type="button"
          onClick={() => void navigate('/admin/users')}
        >
          {t('adminUsers.backToList')}
        </Button>
      </div>

      {userLoadingState ? (
        <UserDetailPanelSkeleton className="mb-6" />
      ) : detailUser ? (
        <Panel title={t('adminUsers.detailTitle')}>
          <div className="flex items-center gap-4 mb-6">
            <Avatar
              userId={detailUser.id}
              name={detailUser.displayName}
              hasAvatar={detailUser.avatarFilename}
              version={detailAvatarVersion}
              size={72}
            />
            <div className="flex gap-2">
              <AvatarUploader onUpload={handleAvatarUpload} />
              {detailUser.avatarFilename && (
                <Button
                  type="button"
                  variant="tertiary"
                  onClick={() => void handleAvatarRemove()}
                >
                  {t('avatar.remove')}
                </Button>
              )}
            </div>
          </div>
          <form onSubmit={(e) => void handleEditSubmit(e)}>
            <FormFieldsGrid>
              <FormInput
                label={t('adminUsers.email')}
                name="email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
              <FormInput
                label={t('adminUsers.displayName')}
                name="displayName"
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                required
              />
              <FormInput
                label={t('adminUsers.role')}
                name="roleName"
                type="select"
                value={editRoleName}
                onChange={(e) => setEditRoleName(e.target.value as UserRole)}
                options={roleSelectOptions}
              />
              <FormInput
                label={t('adminUsers.status')}
                name="status"
                type="select"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                options={statusSelectOptions}
              />
            </FormFieldsGrid>
            <div className="mt-2 text-sm text-muted">
              {t('adminUsers.memberSince')}: {formatDate(detailUser.dateCreated)}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button
                type="submit"
                disabled={editSubmitting || !isEditDirty}
              >
                {editSubmitting ? t('common.loading') : t('profile.save')}
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

      <h2 className="text-xl font-semibold mt-8 mb-4">{t('adminUsers.assignedAssets')}</h2>
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
                <TableHeaderCell last>{t('assets.location')}</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id} striped>
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
            {assets.length === 0 && (
              <p className="py-8 text-center text-muted">{t('adminUsers.noAssignedAssets')}</p>
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

      <h2 className="text-xl font-semibold mt-8 mb-4">{t('adminUsers.transactionHistory')}</h2>
      <Panel>
        <HistoryTable
          transactions={transactions}
          loading={txLoading}
          page={txPage}
          total={txTotal}
          pageSize={txPageSize}
          onPageChange={setTxPage}
          search={{ value: txSearch, onChange: (value) => { setTxSearch(value); setTxPage(1); } }}
          showActor
        />
      </Panel>
    </PageContent>
  );
}
