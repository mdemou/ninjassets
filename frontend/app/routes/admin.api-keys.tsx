import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '~/components/Avatar';
import { Badge, type BadgeVariant } from '~/components/Badge';
import { Button } from '~/components/Button';
import { Modal } from '~/components/Modal';
import { PageContent } from '~/components/PageContent';
import { Panel } from '~/components/Panel';
import { UnderlineTabBar } from '~/components/UnderlineTabBar';
import { TableSkeleton } from '~/components/LoadingSkeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from '~/components/Table';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type {
  ApiAccessLogEntry,
  ApiKey,
  ApiKeySecret,
  ApiKeySecretData,
  ApiResponse,
  ListApiAccessLogData,
  ListApiKeysData,
} from '~/types';
import { api } from '~/utils/api';
import type { TranslationKey } from '~/utils/translations';

type Tab = 'keys' | 'log';

const TAB_KEYS: Record<Tab, TranslationKey> = {
  keys: 'apiKeys.tabKeys',
  log: 'apiKeys.tabLog',
};

const API_KEYS_TAB_ICONS = {
  keys: (
    <svg
      className="w-4 h-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  ),
  log: (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
} as const;

function formatDateTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

function keyStatus(key: ApiKey): { labelKey: TranslationKey; variant: BadgeVariant } {
  if (key.revokedAt) return { labelKey: 'apiKeys.statusRevoked', variant: 'danger' };
  if (key.expiresAt && new Date(key.expiresAt) <= new Date()) {
    return { labelKey: 'apiKeys.statusExpired', variant: 'warning' };
  }
  return { labelKey: 'apiKeys.statusActive', variant: 'success' };
}

export const meta = pageMeta('apiKeys.title');

export default function AdminApiKeys() {
  usePageTitle('apiKeys.title');
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const [tab, setTab] = useState<Tab>('keys');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiAccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<ApiKeySecret | null>(null);
  const [copied, setCopied] = useState(false);

  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokingKey, setRevokingKey] = useState<ApiKey | null>(null);
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);

  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState<ApiKey | null>(null);
  const [regenerateSubmitting, setRegenerateSubmitting] = useState(false);

  const toastError = useCallback(
    (err: unknown) => {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    },
    [addToast, t],
  );

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ListApiKeysData>('/api/p/api-keys');
      setKeys(res.data?.apiKeys ?? []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ListApiAccessLogData>('/api/p/api-access-logs');
      setLogs(res.data?.logs ?? []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/', { replace: true });
    }
  }, [userLoading, user, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'keys') void fetchKeys();
    else void fetchLogs();
  }, [isAdmin, tab, fetchKeys, fetchLogs]);

  const submitCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await api.post<ApiKeySecretData>('/api/p/api-keys', {
        name: name.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setCreateOpen(false);
      setName('');
      setExpiresAt('');
      setCopied(false);
      setSecret(res.data?.apiKey ?? null);
      addToast({ type: 'success', title: t('common.success'), message: t('apiKeys.created') });
      void fetchKeys();
    } catch (err) {
      toastError(err);
    } finally {
      setCreating(false);
    }
  };

  const openRevokeModal = (key: ApiKey) => {
    setRevokingKey(key);
    setShowRevokeModal(true);
  };

  const handleRevokeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!revokingKey) return;
    setRevokeSubmitting(true);
    try {
      await api.delete(`/api/p/api-keys/${revokingKey.id}`);
      addToast({ type: 'success', title: t('common.success'), message: t('apiKeys.revoked') });
      setShowRevokeModal(false);
      setRevokingKey(null);
      void fetchKeys();
    } catch (err) {
      toastError(err);
    } finally {
      setRevokeSubmitting(false);
    }
  };

  const openRegenerateModal = (key: ApiKey) => {
    setRegeneratingKey(key);
    setShowRegenerateModal(true);
  };

  const handleRegenerateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!regeneratingKey) return;
    setRegenerateSubmitting(true);
    try {
      const res = await api.post<ApiKeySecretData>(`/api/p/api-keys/${regeneratingKey.id}/regenerate`);
      setCopied(false);
      setSecret(res.data?.apiKey ?? null);
      addToast({ type: 'success', title: t('common.success'), message: t('apiKeys.regenerated') });
      setShowRegenerateModal(false);
      setRegeneratingKey(null);
      void fetchKeys();
    } catch (err) {
      toastError(err);
    } finally {
      setRegenerateSubmitting(false);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.secret);
      setCopied(true);
    } catch {
      // Clipboard may be unavailable; the secret is still selectable in the field.
    }
  };

  if (!isAdmin) return null;

  const apiKeyTabs = (['keys', 'log'] as const).map((key) => ({
    id: key,
    label: t(TAB_KEYS[key]),
    icon: API_KEYS_TAB_ICONS[key],
  }));

  return (
    <PageContent size="wide">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-3xl font-semibold">{t('apiKeys.title')}</h1>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-api-key">
          {t('apiKeys.createButton')}
        </Button>
      </div>
      <p className="text-sm text-muted mb-4">{t('apiKeys.subtitle')}</p>

      <UnderlineTabBar
        className="mb-4"
        idPrefix="api-keys"
        ariaLabel={t('apiKeys.title')}
        tabs={apiKeyTabs}
        active={tab}
        onChange={setTab}
      />

      <div
        role="tabpanel"
        id={`api-keys-panel-${tab}`}
        aria-labelledby={`api-keys-tab-${tab}`}
      >
      <Panel>
        {loading ? (
          <TableSkeleton columns={tab === 'keys' ? 8 : 5} />
        ) : tab === 'keys' ? (
          keys.length === 0 ? (
            <p className="text-muted-foreground">{t('apiKeys.empty')}</p>
          ) : (
            <Table data-testid="api-keys-table">
              <TableHead>
                <TableHeaderRow>
                  <TableHeaderCell>{t('apiKeys.colName')}</TableHeaderCell>
                  <TableHeaderCell>{t('apiKeys.colOwner')}</TableHeaderCell>
                  <TableHeaderCell>{t('apiKeys.colPrefix')}</TableHeaderCell>
                  <TableHeaderCell>{t('apiKeys.colCreated')}</TableHeaderCell>
                  <TableHeaderCell>{t('apiKeys.colExpires')}</TableHeaderCell>
                  <TableHeaderCell>{t('apiKeys.colLastUsed')}</TableHeaderCell>
                  <TableHeaderCell>{t('apiKeys.colStatus')}</TableHeaderCell>
                  <TableHeaderCell last>{t('apiKeys.colActions')}</TableHeaderCell>
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {keys.map((key) => {
                  const status = keyStatus(key);
                  const isActive = !key.revokedAt;
                  return (
                    <TableRow key={key.id} striped>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        {key.ownerUserId && (key.ownerName || key.ownerEmail) ? (
                          <span className="flex items-center gap-2 min-w-0">
                            <Avatar
                              userId={key.ownerUserId}
                              name={key.ownerName ?? key.ownerEmail ?? '?'}
                              hasAvatar={key.ownerAvatarFilename}
                              size={28}
                            />
                            <span className="flex flex-col min-w-0">
                              {key.ownerName && (
                                <span className="font-medium truncate">{key.ownerName}</span>
                              )}
                              {key.ownerEmail && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {key.ownerEmail}
                                </span>
                              )}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{key.prefix}…</TableCell>
                      <TableCell>{formatDateTime(key.createdAt) ?? '—'}</TableCell>
                      <TableCell>{formatDateTime(key.expiresAt) ?? t('apiKeys.never')}</TableCell>
                      <TableCell>{formatDateTime(key.lastUsedAt) ?? t('apiKeys.never')}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{t(status.labelKey)}</Badge>
                      </TableCell>
                      <TableCell last>
                        {isActive && (
                          <div className="flex gap-2">
                            <Button
                              variant="tertiary"
                              className="px-3 py-1 text-xs"
                              onClick={() => openRegenerateModal(key)}
                            >
                              {t('apiKeys.regenerate')}
                            </Button>
                            <Button
                              variant="danger"
                              className="px-3 py-1 text-xs"
                              onClick={() => openRevokeModal(key)}
                            >
                              {t('apiKeys.revoke')}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground">{t('apiKeys.log.empty')}</p>
        ) : (
          <Table data-testid="api-access-log-table">
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>{t('apiKeys.log.when')}</TableHeaderCell>
                <TableHeaderCell>{t('apiKeys.log.method')}</TableHeaderCell>
                <TableHeaderCell>{t('apiKeys.log.path')}</TableHeaderCell>
                <TableHeaderCell>{t('apiKeys.log.status')}</TableHeaderCell>
                <TableHeaderCell last>{t('apiKeys.log.key')}</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} striped>
                  <TableCell>{formatDateTime(log.createdAt) ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{log.method}</TableCell>
                  <TableCell className="font-mono text-xs">{log.path}</TableCell>
                  <TableCell>{log.statusCode}</TableCell>
                  <TableCell last>{log.keyName ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={t('apiKeys.createTitle')}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('apiKeys.nameLabel')}</span>
            <input
              className="px-3 py-2 border border-border rounded bg-input text-foreground"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('apiKeys.namePlaceholder')}
              data-testid="api-key-name"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('apiKeys.expiresLabel')}</span>
            <input
              type="date"
              className="px-3 py-2 border border-border rounded bg-input text-foreground"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              data-testid="api-key-expires"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="tertiary" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void submitCreate()} disabled={creating || !name.trim()} data-testid="api-key-submit">
              {creating ? t('apiKeys.creating') : t('apiKeys.create')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showRevokeModal}
        onClose={() => {
          setShowRevokeModal(false);
          setRevokingKey(null);
        }}
        title={t('apiKeys.revoke')}
        size="lg"
      >
        <p className="mb-4">{t('apiKeys.revokeConfirm')}</p>
        {revokingKey && <p className="mb-4 text-muted">{revokingKey.name}</p>}
        <form onSubmit={(e) => void handleRevokeSubmit(e)}>
          <div className="flex gap-2 justify-end">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowRevokeModal(false);
                setRevokingKey(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="danger" type="submit" disabled={revokeSubmitting}>
              {revokeSubmitting ? t('common.loading') : t('apiKeys.revoke')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showRegenerateModal}
        onClose={() => {
          setShowRegenerateModal(false);
          setRegeneratingKey(null);
        }}
        title={t('apiKeys.regenerate')}
        size="lg"
      >
        <p className="mb-4">{t('apiKeys.regenerateConfirm')}</p>
        {regeneratingKey && <p className="mb-4 text-muted">{regeneratingKey.name}</p>}
        <form onSubmit={(e) => void handleRegenerateSubmit(e)}>
          <div className="flex gap-2 justify-end">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowRegenerateModal(false);
                setRegeneratingKey(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={regenerateSubmitting}>
              {regenerateSubmitting ? t('common.loading') : t('apiKeys.regenerate')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={secret !== null} onClose={() => setSecret(null)} title={t('apiKeys.secretTitle')}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-warning">{t('apiKeys.secretWarning')}</p>
          <div className="flex gap-2">
            <input
              readOnly
              className="flex-1 px-3 py-2 border border-border rounded bg-input text-foreground font-mono text-sm"
              value={secret?.secret ?? ''}
              data-testid="api-key-secret"
              onFocus={(e) => e.target.select()}
            />
            <Button variant="secondary" onClick={() => void copySecret()}>
              {copied ? t('apiKeys.copied') : t('apiKeys.copy')}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setSecret(null)}>{t('apiKeys.done')}</Button>
          </div>
        </div>
      </Modal>
    </PageContent>
  );
}
