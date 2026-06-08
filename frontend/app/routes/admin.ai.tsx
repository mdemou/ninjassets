import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '~/components/Button';
import { Modal } from '~/components/Modal';
import { PageContent } from '~/components/PageContent';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { usePublicConfig } from '~/providers/PublicConfigProvider';
import { useSession } from '~/providers/SessionProvider';
import type { AiConversation, AiSource } from '~/types';
import { aiApi, streamChat } from '~/utils/aiChat';
import { pageMeta } from '~/utils/pageTitle';
import type { TranslationKey } from '~/utils/translations';

export const meta = pageMeta('ai.title');

interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: AiSource[] | null;
  pending?: boolean;
}

function tmpId(): string {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorKeyFor(code: string): TranslationKey {
  if (code === 'AI4290') return 'ai.rateLimited';
  return 'ai.errorUnavailable';
}

export default function AdminAi() {
  usePageTitle('ai.title');
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t, language } = useLanguage();
  const { aiEnabled, isLoaded: configLoaded, loadPublicConfig } = usePublicConfig();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';
  // The assistant is disabled when the feature flag is off. We still render the full
  // UI but cover it with a non-interactive overlay (§11.3). Wait for config to load
  // so the overlay never flashes on enabled deployments.
  const disabled = configLoaded && !aiEnabled;

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState<AiConversation | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/', { replace: true });
    }
  }, [userLoading, user, navigate]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await aiApi.listConversations();
      setConversations(res.data?.conversations ?? []);
    } catch {
      /* non-fatal: the list just stays empty */
    }
  }, []);

  useEffect(() => {
    loadPublicConfig();
  }, [loadPublicConfig]);

  useEffect(() => {
    if (isAdmin && configLoaded && aiEnabled) void loadConversations();
  }, [isAdmin, configLoaded, aiEnabled, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateMessage = (id: string, patch: Partial<UiMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const selectConversation = async (id: string) => {
    if (streaming) return;
    setErrorKey(null);
    setCurrentId(id);
    try {
      const res = await aiApi.getConversation(id);
      setMessages(
        (res.data?.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
        })),
      );
    } catch (err) {
      addToast({ type: 'error', title: t('common.error'), message: (err as Error).message });
    }
  };

  const newConversation = () => {
    if (streaming) return;
    setCurrentId(null);
    setMessages([]);
    setErrorKey(null);
  };

  const openDeleteModal = (conversation: AiConversation) => {
    if (streaming) return;
    setDeletingConversation(conversation);
    setShowDeleteModal(true);
  };

  const handleDeleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!deletingConversation) return;
    setDeleteSubmitting(true);
    try {
      await aiApi.deleteConversation(deletingConversation.id);
      if (deletingConversation.id === currentId) newConversation();
      await loadConversations();
      setShowDeleteModal(false);
      setDeletingConversation(null);
    } catch (err) {
      addToast({ type: 'error', title: t('common.error'), message: (err as Error).message });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming || disabled) return;
    setErrorKey(null);

    const assistantId = tmpId();
    setMessages((prev) => [
      ...prev,
      { id: tmpId(), role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '', pending: true },
    ]);
    setInput('');
    setStreaming(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      await streamChat(
        { message: text, conversationId: currentId ?? undefined, locale: language },
        {
          onDelta: (delta) =>
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta, pending: false } : m)),
            ),
          onSources: (sources, conversationId) => {
            updateMessage(assistantId, { sources, pending: false });
            if (!currentId && conversationId) {
              setCurrentId(conversationId);
              void loadConversations();
            }
          },
          onEmpty: (conversationId) => {
            updateMessage(assistantId, { content: t('ai.noRelevantDocs'), pending: false });
            if (!currentId && conversationId) {
              setCurrentId(conversationId);
              void loadConversations();
            }
          },
          onError: (code) => {
            setErrorKey(errorKeyFor(code));
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          },
        },
        abort.signal,
      );
    } catch {
      // Aborted (Stop) or network drop — keep whatever streamed; clear pending flag.
      updateMessage(assistantId, { pending: false });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const onInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  if (!isAdmin) return null;

  const examples: TranslationKey[] = ['ai.examplePrompt1', 'ai.examplePrompt2', 'ai.examplePrompt3'];

  return (
    <PageContent size="wide">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('ai.title')}</h1>
        <p className="text-sm text-muted mb-4">{t('ai.subtitle')}</p>
      </div>

      <div className="relative">
      <div
        className={`flex gap-4 h-[calc(100vh-12rem)] min-h-[28rem] transition-opacity ${
          disabled ? 'pointer-events-none select-none opacity-50' : ''
        }`}
        inert={disabled}
        aria-hidden={disabled || undefined}
      >
        {/* Conversation list */}
        <aside className="hidden w-64 shrink-0 flex-col rounded-xl border border-border bg-card md:flex">
          <div className="p-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={newConversation}
              data-testid="ai-new-conversation"
            >
              {t('ai.newConversation')}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 pt-0">
            {conversations.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">{t('ai.noConversations')}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {conversations.map((c) => (
                  <li key={c.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void selectConversation(c.id)}
                      className={`flex-1 cursor-pointer truncate rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-alt ${
                        c.id === currentId ? 'bg-surface-alt font-medium text-foreground' : 'text-muted'
                      }`}
                      data-testid="ai-conversation-item"
                      title={c.title}
                    >
                      {c.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(c)}
                      className="shrink-0 cursor-pointer rounded-lg p-2 text-muted opacity-0 transition-opacity hover:bg-surface-alt hover:text-danger group-hover:opacity-100"
                      aria-label={t('ai.deleteConversation')}
                      title={t('ai.deleteConversation')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Chat thread */}
        <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-card">
          <div className="flex-1 overflow-y-auto p-4" data-testid="ai-thread">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <h2 className="text-lg font-medium text-foreground">{t('ai.emptyTitle')}</h2>
                <div className="flex flex-col gap-2">
                  {examples.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setInput(t(key))}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt hover:text-foreground"
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                    data-testid={m.role === 'user' ? 'ai-message-user' : 'ai-message-assistant'}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.9375rem] whitespace-pre-wrap break-words ${
                        m.role === 'user'
                          ? 'bg-primary text-white'
                          : 'border border-border bg-surface-alt text-foreground'
                      }`}
                    >
                      {m.content || (m.pending ? <span className="text-muted">{t('ai.thinking')}</span> : '')}
                      {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                        <details className="mt-3 border-t border-border/60 pt-2" data-testid="ai-sources">
                          <summary className="cursor-pointer text-xs font-medium text-muted">
                            {t('ai.sources')} ({m.sources.length})
                          </summary>
                          <ul className="mt-2 flex flex-col gap-1">
                            {m.sources.map((s, i) => (
                              <li key={`${s.documentId}-${i}`} className="text-xs text-muted">
                                <span className="font-medium text-foreground/80">{s.documentName}</span>
                                {typeof s.score === 'number' && (
                                  <span className="ml-1 opacity-70">· {s.score.toFixed(2)}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div ref={bottomRef} />
          </div>

          {errorKey && (
            <div className="mx-4 mb-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" data-testid="ai-error">
              {t(errorKey)}
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={t('ai.placeholder')}
                rows={1}
                disabled={streaming || disabled}
                data-testid="ai-input"
                className="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-[0.9375rem] text-foreground outline-none focus:border-primary disabled:opacity-60"
              />
              {streaming ? (
                <Button variant="secondary" onClick={stop} data-testid="ai-stop">
                  {t('ai.stop')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => void send()}
                  disabled={!input.trim() || disabled}
                  data-testid="ai-send"
                >
                  {t('ai.send')}
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      {disabled && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/40 backdrop-blur-[1px]"
          data-testid="ai-disabled-overlay"
        >
          <div className="mx-4 max-w-sm rounded-xl border border-border bg-card px-6 py-5 text-center shadow-lg">
            <svg
              className="mx-auto mb-3 text-muted"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p className="text-sm font-medium text-foreground">{t('ai.errorUnavailable')}</p>
          </div>
        </div>
      )}
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingConversation(null);
        }}
        title={t('ai.deleteConversation')}
        size="lg"
      >
        <p className="mb-4">{t('ai.deleteConfirm')}</p>
        {deletingConversation && (
          <p className="mb-4 text-muted">{deletingConversation.title}</p>
        )}
        <form onSubmit={(e) => void handleDeleteSubmit(e)}>
          <div className="flex gap-2 justify-end">
            <Button
              variant="tertiary"
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingConversation(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="danger" type="submit" disabled={deleteSubmitting}>
              {deleteSubmitting ? t('common.loading') : t('ai.deleteConversation')}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContent>
  );
}
