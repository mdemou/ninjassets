import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { Avatar } from '~/components/Avatar';
import { AvatarUploader } from '~/components/AvatarUploader';
import { Button } from '~/components/Button';
import { FormInput } from '~/components/FormInput';
import { LanguageFlagSelector } from '~/components/LanguageFlagSelector';
import { Modal } from '~/components/Modal';
import { PageContent } from '~/components/PageContent';
import { Panel } from '~/components/Panel';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type { ApiResponse, Language } from '~/types';

const fieldRow = 'grid grid-cols-1 md:grid-cols-2 gap-x-4';
const fieldCompact = 'mb-3';

export const meta = pageMeta('settings.title');

export default function Settings() {
  usePageTitle('settings.title');
  const navigate = useNavigate();
  const { isReady } = useRequireAuth();
  const { user, avatarVersion, updateProfile, uploadAvatar, removeAvatar, changePassword, deleteAccount } =
    useSession();
  const { language, setLanguage, t } = useLanguage();
  const { addToast } = useError();

  const [displayName, setDisplayName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [languageSubmitting, setLanguageSubmitting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileSubmitting(true);
    try {
      await updateProfile({ displayName });
      addToast({
        type: 'success',
        title: t('common.success'),
        message: t('common.success'),
      });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || t('common.error'),
      });
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleAvatarUpload = async (blob: Blob) => {
    try {
      await uploadAvatar(blob);
      addToast({ type: 'success', title: t('common.success'), message: t('avatar.uploadSuccess') });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
      throw err;
    }
  };

  const handleAvatarRemove = async () => {
    try {
      await removeAvatar();
      addToast({ type: 'success', title: t('common.success'), message: t('avatar.removeSuccess') });
    } catch (err) {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    }
  };

  const handleLanguageSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLanguageSubmitting(true);
    setLanguage(selectedLanguage);
    addToast({
      type: 'success',
      title: t('common.success'),
      message: t('settings.languageSaved'),
    });
    setLanguageSubmitting(false);
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast({
        type: 'error',
        title: t('common.error'),
        message: t('common.passwordMismatch'),
      });
      return;
    }
    setPasswordSubmitting(true);
    try {
      await changePassword({
        currentPassword,
        password: newPassword,
        passwordConfirmation: confirmPassword,
      });
      addToast({
        type: 'success',
        title: t('common.success'),
        message: t('common.success'),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const error = err as ApiResponse;
      addToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || t('common.error'),
      });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    setDeleteSubmitting(true);
    try {
      await deleteAccount(deletePassword);
      void navigate('/login');
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

  if (!isReady) return null;

  const dateCreatedFormatted = user?.dateCreated
    ? new Date(user.dateCreated).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <PageContent>
      <h1 className="text-2xl font-semibold mb-4">{t('settings.title')}</h1>

      <Panel
        title={t('avatar.title')}
        className="mb-4 !p-4 [&_h2]:text-lg [&_h2]:mb-3"
      >
        <div className="flex items-center gap-4">
          {user && (
            <Avatar
              userId={user.id}
              name={user.displayName}
              hasAvatar={user.avatarFilename}
              version={avatarVersion}
              size={80}
            />
          )}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <AvatarUploader onUpload={handleAvatarUpload} />
              {user?.avatarFilename && (
                <Button
                  type="button"
                  variant="tertiary"
                  onClick={() => void handleAvatarRemove()}
                >
                  {t('avatar.remove')}
                </Button>
              )}
            </div>
            <p className="text-sm text-muted">{t('avatar.hint')}</p>
          </div>
        </div>
      </Panel>

      <Panel
        title={t('profile.updateProfile')}
        className="mb-4 !p-4 [&_h2]:text-lg [&_h2]:mb-3"
      >
        <form onSubmit={(e) => void handleProfileSubmit(e)}>
          <div className={fieldRow}>
            <FormInput
              className={fieldCompact}
              label={t('profile.email')}
              name="email"
              type="email"
              value={user?.email ?? ''}
              onChange={() => {}}
              disabled
            />
            {user?.dateCreated && (
              <FormInput
                className={fieldCompact}
                label={t('profile.dateCreated')}
                name="dateCreated"
                type="text"
                value={dateCreatedFormatted}
                onChange={() => {}}
                disabled
              />
            )}
          </div>
          <div className={fieldRow}>
            <FormInput
              className={fieldCompact}
              label={t('profile.displayName')}
              name="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            disabled={profileSubmitting}
          >
            {profileSubmitting ? t('common.loading') : t('profile.save')}
          </Button>
        </form>
      </Panel>

      <Panel
        title={t('settings.language')}
        className="mb-4 !p-4 [&_h2]:text-lg [&_h2]:mb-3"
      >
        <form onSubmit={handleLanguageSubmit}>
          <div className="mb-4">
            <p className="text-sm font-medium text-foreground mb-2">{t('settings.language')}</p>
            <LanguageFlagSelector
              value={selectedLanguage}
              onChange={setSelectedLanguage}
            />
          </div>
          <Button
            type="submit"
            disabled={languageSubmitting}
          >
            {languageSubmitting ? t('common.loading') : t('settings.save')}
          </Button>
        </form>
      </Panel>

      <Panel
        title={t('profile.changePassword')}
        className="mb-4 !p-4 [&_h2]:text-lg [&_h2]:mb-3"
      >
        <form onSubmit={(e) => void handlePasswordSubmit(e)}>
          <div className={fieldRow}>
            <FormInput
              className={fieldCompact}
              label={t('profile.currentPassword')}
              name="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className={fieldRow}>
            <FormInput
              className={fieldCompact}
              label={t('profile.newPassword')}
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <FormInput
              className={fieldCompact}
              label={t('profile.confirmPassword')}
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={passwordSubmitting}
          >
            {passwordSubmitting ? t('common.loading') : t('profile.updatePassword')}
          </Button>
        </form>
      </Panel>

      <Panel
        title={t('profile.deleteAccount')}
        className="!p-4 [&_h2]:text-lg [&_h2]:mb-3"
      >
        <p className="mb-3 text-sm text-muted">{t('profile.deleteWarning')}</p>
        <Button
          variant="danger"
          onClick={() => setShowDeleteModal(true)}
        >
          {t('profile.deleteButton')}
        </Button>
      </Panel>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('profile.deleteAccount')}
      >
        <p className="mb-4">{t('profile.deleteConfirm')}</p>
        <form onSubmit={(e) => void handleDelete(e)}>
          <FormInput
            label={t('login.password')}
            name="deletePassword"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            required
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => setShowDeleteModal(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              type="submit"
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? t('common.loading') : t('profile.deleteButton')}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContent>
  );
}
