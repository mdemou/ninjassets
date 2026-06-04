import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '~/components/Avatar';
import { AvatarUploader } from '~/components/AvatarUploader';
import { Button } from '~/components/Button';
import { FormFieldSpan, FormFieldsGrid } from '~/components/FormFieldsGrid';
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
import { UserRoleBadge } from '~/components/UserRoleBadge';
import { UserStatusBadge } from '~/components/UserStatusBadge';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type { AdminUser, ApiResponse, ListUsersData, UserRole, UserStatus } from '~/types';
import { api } from '~/utils/api';
import {
  USER_ROLE_BADGE_CLASS,
  USER_ROLE_OPTIONS,
  isUserRole,
  USER_ROLE_LABEL_KEYS,
} from '~/utils/userRole';
import {
  USER_STATUS_BADGE_CLASS,
  USER_STATUS_OPTIONS,
  isUserStatus,
  USER_STATUS_LABEL_KEYS,
} from '~/utils/userStatus';

export const meta = pageMeta('adminUsers.title');

export default function AdminUsers() {
  usePageTitle('adminUsers.title');
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  // Page size is decided by the server (config) and echoed back in the response.
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);

  // Create form
  const [createEmail, setCreateEmail] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createRoleName, setCreateRoleName] = useState<UserRole>('USER');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createAvatarBlob, setCreateAvatarBlob] = useState<Blob | null>(null);
  const [createAvatarPreview, setCreateAvatarPreview] = useState<string | null>(null);

  // Edit form
  const [editEmail, setEditEmail] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRoleName, setEditRoleName] = useState<UserRole>('USER');
  const [editStatus, setEditStatus] = useState<UserStatus>('ACTIVE');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editAvatarVersion, setEditAvatarVersion] = useState(0);

  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Change-password form
  const [pwdValue, setPwdValue] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdVisible, setPwdVisible] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const roleLabel = useCallback(
    (role: string) => (isUserRole(role) ? t(USER_ROLE_LABEL_KEYS[role]) : role),
    [t],
  );

  const statusLabel = useCallback(
    (status: string) => (isUserStatus(status) ? t(USER_STATUS_LABEL_KEYS[status]) : status),
    [t],
  );

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

  const resetCreateAvatar = useCallback(() => {
    setCreateAvatarBlob(null);
    setCreateAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const findUserIdByEmail = useCallback(async (email: string): Promise<string | null> => {
    const params = new URLSearchParams({ search: email, page: '1' });
    const res = await api.get<ListUsersData>(`/api/p/users?${params.toString()}`);
    const match = res.data?.users?.find((u) => u.email.toLowerCase() === email.toLowerCase());
    return match?.id ?? null;
  }, []);

  const fetchUsers = useCallback(
    async (opts: { search: string; page: number }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        params.set('page', String(opts.page));
        const res = await api.get<ListUsersData>(`/api/p/users?${params.toString()}`);
        setUsers(res.data?.users ?? []);
        setTotal(res.data?.total ?? 0);
        if (res.data?.pageSize) setPageSize(res.data.pageSize);
      } catch (err) {
        const error = err as ApiResponse;
        addToast({
          type: 'error',
          title: t('common.error'),
          message: error.message || t('common.error'),
        });
      } finally {
        setLoading(false);
      }
    },
    [addToast, t],
  );

  // Route guard — wait until user is loaded so we do not treat user === null as non-admin.
  useEffect(() => {
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/', { replace: true });
    }
  }, [userLoading, user, navigate]);

  // Debounced server-side search + pagination.
  useEffect(() => {
    if (!isAdmin) return;
    const handle = setTimeout(() => {
      void fetchUsers({ search, page });
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdmin, search, page, fetchUsers]);

  const openCreateModal = () => {
    setCreateEmail('');
    setCreateDisplayName('');
    setCreateRoleName('USER');
    resetCreateAvatar();
    setShowCreateModal(true);
  };

  const handleCreateAvatarSelect = useCallback((blob: Blob) => {
    setCreateAvatarBlob(blob);
    setCreateAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  }, []);

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      await api.post('/api/p/users', {
        email: createEmail,
        displayName: createDisplayName,
        roleName: createRoleName,
      });
      if (createAvatarBlob) {
        const newUserId = await findUserIdByEmail(createEmail);
        if (newUserId) {
          await api.upload(`/api/p/users/${newUserId}/avatar`, createAvatarBlob);
        }
      }
      addToast({
        type: 'success',
        title: t('common.success'),
        message: t('adminUsers.createSuccess'),
      });
      setShowCreateModal(false);
      setCreateEmail('');
      setCreateDisplayName('');
      setCreateRoleName('USER');
      resetCreateAvatar();
      setPage(1);
      void fetchUsers({ search, page: 1 });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || t('common.error'),
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const refreshEditingUser = useCallback(async (id: string) => {
    const res = await api.get<{ user: AdminUser }>(`/api/p/users/${id}`);
    if (res.data?.user) setEditingUser(res.data.user);
  }, []);

  const openEditModal = (u: AdminUser) => {
    setEditingUser(u);
    setEditEmail(u.email);
    setEditDisplayName(u.displayName);
    setEditRoleName(u.roleName);
    setEditStatus(u.status);
    setEditAvatarVersion(0);
    setShowEditModal(true);
  };

  const handleEditAvatarUpload = useCallback(
    async (blob: Blob) => {
      if (!editingUser) return;
      try {
        await api.upload(`/api/p/users/${editingUser.id}/avatar`, blob);
        await refreshEditingUser(editingUser.id);
        setEditAvatarVersion((v) => v + 1);
        void fetchUsers({ search, page });
        addToast({ type: 'success', title: t('common.success'), message: t('avatar.uploadSuccess') });
      } catch (err) {
        const error = err as ApiResponse;
        addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
        throw err;
      }
    },
    [editingUser, addToast, t, fetchUsers, search, page, refreshEditingUser],
  );

  const handleEditAvatarRemove = useCallback(async () => {
    if (!editingUser) return;
    try {
      await api.delete(`/api/p/users/${editingUser.id}/avatar`);
      await refreshEditingUser(editingUser.id);
      setEditAvatarVersion((v) => v + 1);
      void fetchUsers({ search, page });
      addToast({ type: 'success', title: t('common.success'), message: t('avatar.removeSuccess') });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    }
  }, [editingUser, addToast, t, fetchUsers, search, page, refreshEditingUser]);

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSubmitting(true);
    try {
      await api.patch(`/api/p/users/${editingUser.id}`, {
        email: editEmail,
        displayName: editDisplayName,
        roleName: editRoleName,
        status: editStatus,
      });
      addToast({
        type: 'success',
        title: t('common.success'),
        message: t('adminUsers.updateSuccess'),
      });
      setShowEditModal(false);
      setEditingUser(null);
      void fetchUsers({ search, page });
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

  const openDeleteModal = (u: AdminUser) => {
    setDeletingUser(u);
    setShowDeleteModal(true);
  };

  const handleDeleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!deletingUser) return;
    setDeleteSubmitting(true);
    try {
      await api.delete(`/api/p/users/${deletingUser.id}`);
      addToast({
        type: 'success',
        title: t('common.success'),
        message: t('adminUsers.deleteSuccess'),
      });
      setShowDeleteModal(false);
      setDeletingUser(null);
      void fetchUsers({ search, page });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || t('common.error'),
      });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openPasswordModal = (u: AdminUser) => {
    setPasswordUser(u);
    setPwdValue('');
    setPwdConfirm('');
    setPwdVisible(false);
    setShowPasswordModal(true);
  };

  // Build a strong password satisfying the backend rule:
  // at least 8 chars with one uppercase, one lowercase, and one digit.
  const generatePassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const all = upper + lower + digits;
    const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
    const chars = [pick(upper), pick(lower), pick(digits)];
    for (let i = chars.length; i < 16; i += 1) chars.push(pick(all));
    // Shuffle so the guaranteed chars are not always at the front.
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const generated = chars.join('');
    setPwdValue(generated);
    setPwdConfirm(generated);
    setPwdVisible(true);
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    if (pwdValue !== pwdConfirm) {
      addToast({ type: 'error', title: t('common.error'), message: t('adminUsers.passwordMismatch') });
      return;
    }
    setPwdSubmitting(true);
    try {
      await api.patch(`/api/p/users/${passwordUser.id}/password`, {
        password: pwdValue,
        passwordConfirmation: pwdConfirm,
      });
      addToast({
        type: 'success',
        title: t('common.success'),
        message: t('adminUsers.changePasswordSuccess'),
      });
      setShowPasswordModal(false);
      setPasswordUser(null);
    } catch (err) {
      const error = err as ApiResponse;
      addToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || t('common.error'),
      });
    } finally {
      setPwdSubmitting(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <PageContent size="wide">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold">{t('adminUsers.title')}</h1>
        <Button onClick={openCreateModal}>{t('adminUsers.create')}</Button>
      </div>

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t('adminUsers.searchPlaceholder')}
      />

      <Panel>
        {loading ? (
          <TableSkeleton
            columns={5}
            actionsColumn
          />
        ) : (
          <>
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>{t('adminUsers.displayName')}</TableHeaderCell>
                <TableHeaderCell>{t('adminUsers.email')}</TableHeaderCell>
                <TableHeaderCell>{t('adminUsers.role')}</TableHeaderCell>
                <TableHeaderCell>{t('adminUsers.status')}</TableHeaderCell>
                <TableHeaderCell last />
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow
                  key={u.id}
                  striped
                  onClick={() => void navigate(`/admin/users/${u.id}`)}
                >
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar
                        userId={u.id}
                        name={u.displayName}
                        hasAvatar={u.avatarFilename}
                        size={28}
                      />
                      <TableCellText value={u.displayName} />
                    </span>
                  </TableCell>
                  <TableCell>
                    <TableCellText value={u.email} />
                  </TableCell>
                  <TableCell>
                    <UserRoleBadge role={u.roleName}>{roleLabel(u.roleName)}</UserRoleBadge>
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge status={u.status}>{statusLabel(u.status)}</UserStatusBadge>
                  </TableCell>
                  <TableCell
                    last
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TableRowActions
                      onEdit={() => openEditModal(u)}
                      onDelete={() => openDeleteModal(u)}
                      onChangePassword={() => openPasswordModal(u)}
                      editLabel={t('adminUsers.edit')}
                      deleteLabel={t('adminUsers.delete')}
                      changePasswordLabel={t('adminUsers.changePassword')}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            {total === 0 && <p className="py-8 text-center text-muted">No users yet.</p>}
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

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetCreateAvatar();
        }}
        title={t('adminUsers.create')}
        size="lg"
      >
        <form onSubmit={(e) => void handleCreateSubmit(e)}>
          <FormFieldsGrid>
            <FormFieldSpan>
              <p className="text-sm font-medium mb-2">{t('avatar.title')}</p>
              <div className="flex items-center gap-4">
                {createAvatarPreview ? (
                  <img
                    src={createAvatarPreview}
                    alt=""
                    className="rounded-full object-cover shrink-0"
                    width={56}
                    height={56}
                  />
                ) : (
                  <Avatar
                    userId=""
                    name={createDisplayName || createEmail || '?'}
                    hasAvatar={false}
                    size={56}
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <AvatarUploader onUpload={handleCreateAvatarSelect} />
                  {createAvatarBlob && (
                    <Button
                      type="button"
                      variant="tertiary"
                      onClick={resetCreateAvatar}
                    >
                      {t('avatar.remove')}
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted mt-1">{t('avatar.hint')}</p>
            </FormFieldSpan>
            <FormInput
              label={t('adminUsers.email')}
              name="email"
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              required
            />
            <FormInput
              label={t('adminUsers.displayName')}
              name="displayName"
              type="text"
              value={createDisplayName}
              onChange={(e) => setCreateDisplayName(e.target.value)}
              required
            />
            <FormInput
              label={t('adminUsers.role')}
              name="roleName"
              type="select"
              value={createRoleName}
              onChange={(e) => setCreateRoleName(e.target.value as UserRole)}
              options={roleSelectOptions}
            />
          </FormFieldsGrid>
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                resetCreateAvatar();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createSubmitting}
            >
              {createSubmitting ? t('common.loading') : t('adminUsers.create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
        }}
        title={t('adminUsers.edit')}
        size="lg"
      >
        <form onSubmit={(e) => void handleEditSubmit(e)}>
          <FormFieldsGrid>
            {editingUser && (
              <FormFieldSpan>
                <p className="text-sm font-medium mb-2">{t('avatar.title')}</p>
                <div className="flex items-center gap-4">
                  <Avatar
                    userId={editingUser.id}
                    name={editDisplayName}
                    hasAvatar={editingUser.avatarFilename}
                    version={editAvatarVersion}
                    size={56}
                  />
                  <div className="flex flex-wrap gap-2">
                    <AvatarUploader onUpload={handleEditAvatarUpload} />
                    {editingUser.avatarFilename && (
                      <Button
                        type="button"
                        variant="tertiary"
                        onClick={() => void handleEditAvatarRemove()}
                      >
                        {t('avatar.remove')}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted mt-1">{t('avatar.hint')}</p>
              </FormFieldSpan>
            )}
            <FormInput
              label={t('adminUsers.email')}
              name="editEmail"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              required
            />
            <FormInput
              label={t('adminUsers.displayName')}
              name="editDisplayName"
              type="text"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              required
            />
            <FormInput
              label={t('adminUsers.role')}
              name="editRoleName"
              type="select"
              value={editRoleName}
              onChange={(e) => setEditRoleName(e.target.value as UserRole)}
              options={roleSelectOptions}
            />
            <FormInput
              label={t('adminUsers.status')}
              name="editStatus"
              type="select"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as UserStatus)}
              options={statusSelectOptions}
            />
          </FormFieldsGrid>
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditingUser(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={editSubmitting}
            >
              {editSubmitting ? t('common.loading') : t('profile.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingUser(null);
        }}
        title={t('adminUsers.delete')}
        size="lg"
      >
        <p className="mb-4">{t('adminUsers.deleteConfirm')}</p>
        {deletingUser && (
          <p className="mb-4 text-muted">
            {deletingUser.email} ({deletingUser.displayName})
          </p>
        )}
        <form onSubmit={(e) => void handleDeleteSubmit(e)}>
          <div className="flex gap-2 justify-end">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingUser(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              type="submit"
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? t('common.loading') : t('adminUsers.delete')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordUser(null);
        }}
        title={t('adminUsers.changePasswordTitle')}
        size="lg"
      >
        {passwordUser && (
          <p className="mb-4 text-muted">
            {passwordUser.email} ({passwordUser.displayName})
          </p>
        )}
        <form onSubmit={(e) => void handlePasswordSubmit(e)}>
          <FormFieldsGrid>
            <FormInput
              label={t('adminUsers.newPassword')}
              name="newPassword"
              type={pwdVisible ? 'text' : 'password'}
              value={pwdValue}
              onChange={(e) => setPwdValue(e.target.value)}
              required
            />
            <FormInput
              label={t('adminUsers.confirmPassword')}
              name="confirmPassword"
              type={pwdVisible ? 'text' : 'password'}
              value={pwdConfirm}
              onChange={(e) => setPwdConfirm(e.target.value)}
              required
            />
          </FormFieldsGrid>
          <div className="flex gap-2 mb-2">
            <Button
              type="button"
              variant="tertiary"
              onClick={generatePassword}
            >
              {t('adminUsers.generatePassword')}
            </Button>
            <Button
              type="button"
              variant="tertiary"
              onClick={() => setPwdVisible((v) => !v)}
            >
              {pwdVisible ? t('adminUsers.hidePassword') : t('adminUsers.showPassword')}
            </Button>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordUser(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={pwdSubmitting}
            >
              {pwdSubmitting ? t('common.loading') : t('adminUsers.changePassword')}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContent>
  );
}
