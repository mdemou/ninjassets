import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '~/components/Button';
import { Modal } from '~/components/Modal';
import { PageContent } from '~/components/PageContent';
import { Panel } from '~/components/Panel';
import { TableSkeleton } from '~/components/LoadingSkeleton';
import { TableCellText } from '~/components/TableCellText';
import { Badge } from '~/components/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from '~/components/Table';
import {
  DeleteIconButton,
  EditIconButton,
  PowerIconButton,
  SendIconButton,
} from '~/components/TableActionButtons';
import { WebhookPlatformIcon } from '~/components/WebhookPlatformIcon';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type {
  ApiResponse,
  ListWebhookDestinationsData,
  ListWebhookEventsData,
  WebhookDestination,
  WebhookEvent,
  WebhookPlatform,
} from '~/types';
import { api } from '~/utils/api';
import type { TranslationKey } from '~/utils/translations';

const PLATFORMS: WebhookPlatform[] = ['slack', 'discord', 'telegram'];

const PLATFORM_LABEL_KEYS: Record<WebhookPlatform, TranslationKey> = {
  slack: 'webhooks.platform.slack',
  discord: 'webhooks.platform.discord',
  telegram: 'webhooks.platform.telegram',
};

const PLATFORM_DESC_KEYS: Record<WebhookPlatform, TranslationKey> = {
  slack: 'webhooks.platform.slack.desc',
  discord: 'webhooks.platform.discord.desc',
  telegram: 'webhooks.platform.telegram.desc',
};

const CREATE_STEPS = ['platform', 'connection', 'events'] as const;
type CreateStep = (typeof CREATE_STEPS)[number];

function platformIconPath(platform: WebhookPlatform): string {
  return `/api/p/webhooks/platforms/${platform}/icon`;
}

interface FormState {
  id: string | null;
  name: string;
  platform: WebhookPlatform;
  enabled: boolean;
  url: string;
  botToken: string;
  chatId: string;
  events: Set<string>;
}

function emptyForm(): FormState {
  return {
    id: null,
    name: '',
    platform: 'slack',
    enabled: true,
    url: '',
    botToken: '',
    chatId: '',
    events: new Set<string>(),
  };
}

function targetFilled(form: FormState): boolean {
  if (form.platform === 'telegram') {
    return Boolean(form.botToken.trim() && form.chatId.trim());
  }
  return Boolean(form.url.trim());
}

function WizardPlatformLogo({ platform }: { platform: WebhookPlatform }) {
  return (
    <div className="flex justify-center">
      <WebhookPlatformIcon platformIconUrl={platformIconPath(platform)} platform={platform} size={40} />
    </div>
  );
}

function WizardStepper({ step, t }: { step: CreateStep; t: (key: TranslationKey) => string }) {
  const stepIndex = CREATE_STEPS.indexOf(step);
  const labels: Record<CreateStep, TranslationKey> = {
    platform: 'webhooks.wizard.step.platform',
    connection: 'webhooks.wizard.step.connection',
    events: 'webhooks.wizard.step.events',
  };

  return (
    <nav aria-label="Progress" className="mb-6">
      <ol className="mx-auto flex max-w-xl items-start justify-center gap-0 px-2">
        {CREATE_STEPS.map((id, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          const connectorDone = i < stepIndex;

          return (
            <Fragment key={id}>
              <li className="flex w-24 shrink-0 flex-col items-center sm:w-28">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-primary text-white shadow-md'
                      : done
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span
                  className={`mt-2 text-center text-xs font-medium leading-tight ${
                    active ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {t(labels[id])}
                </span>
              </li>
              {i < CREATE_STEPS.length - 1 && (
                <li
                  className="mt-[1.125rem] min-w-[3.5rem] flex-1 max-w-28 px-1 sm:min-w-[5rem] sm:max-w-36 sm:px-2"
                  aria-hidden
                >
                  <div
                    className={`h-0.5 w-full rounded-full transition-colors ${
                      connectorDone ? 'bg-primary/40' : 'bg-border'
                    }`}
                  />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function PlatformPickerStep({
  platform,
  onSelect,
  t,
}: {
  platform: WebhookPlatform;
  onSelect: (p: WebhookPlatform) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h3 className="text-lg font-semibold">{t('webhooks.wizard.platformTitle')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('webhooks.wizard.platformSubtitle')}</p>
      </div>
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        data-testid="webhook-platform"
        role="radiogroup"
        aria-label={t('webhooks.platformLabel')}
      >
        {PLATFORMS.map((p) => {
          const selected = platform === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`webhook-platform-${p}`}
              onClick={() => onSelect(p)}
              className={`group flex flex-col items-center gap-3 rounded-2xl border-2 p-6 text-center transition-all cursor-pointer ${
                selected
                  ? 'border-primary bg-primary/5 shadow-lg scale-[1.02]'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30 hover:shadow-md'
              }`}
            >
              <WebhookPlatformIcon
                platformIconUrl={platformIconPath(p)}
                platform={p}
                size={64}
                className="drop-shadow-sm"
              />
              <div>
                <span className="block text-base font-semibold">{t(PLATFORM_LABEL_KEYS[p])}</span>
                <span className="block text-xs text-muted-foreground mt-1 leading-snug px-1">
                  {t(PLATFORM_DESC_KEYS[p])}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConnectionStep({
  form,
  setForm,
  t,
  isEdit,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  t: (key: TranslationKey) => string;
  isEdit: boolean;
}) {
  const isTelegram = form.platform === 'telegram';

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto">
      <WizardPlatformLogo platform={form.platform} />

      <div className="text-center sm:text-left">
        <h3 className="text-lg font-semibold">{t('webhooks.wizard.connectionTitle')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('webhooks.wizard.connectionSubtitle')}</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('webhooks.nameLabel')}</span>
        <input
          className="px-3 py-2 border border-border rounded-lg bg-input text-foreground"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t('webhooks.namePlaceholder')}
          data-testid="webhook-name"
          autoFocus
        />
      </label>

      {isTelegram ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('webhooks.botTokenLabel')}</span>
            <input
              className="px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm"
              value={form.botToken}
              onChange={(e) => setForm({ ...form, botToken: e.target.value })}
              data-testid="webhook-bot-token"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('webhooks.chatIdLabel')}</span>
            <input
              className="px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm"
              value={form.chatId}
              onChange={(e) => setForm({ ...form, chatId: e.target.value })}
              data-testid="webhook-chat-id"
            />
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t('webhooks.urlLabel')}</span>
          <input
            className="px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder={t('webhooks.urlPlaceholder')}
            data-testid="webhook-url"
          />
        </label>
      )}
      {isEdit && <p className="text-xs text-muted-foreground -mt-2">{t('webhooks.targetUnchanged')}</p>}
    </div>
  );
}

function EventsStep({
  form,
  events,
  eventsByCategory,
  eventLabel,
  allChecked,
  toggleEvent,
  toggleAll,
  t,
  showPlatformLogo = false,
  layout = 'wizard',
}: {
  form: FormState;
  events: WebhookEvent[];
  eventsByCategory: [string, WebhookEvent[]][];
  eventLabel: (e: WebhookEvent) => string;
  allChecked: boolean;
  toggleEvent: (type: string) => void;
  toggleAll: () => void;
  t: (key: TranslationKey) => string;
  showPlatformLogo?: boolean;
  layout?: 'wizard' | 'edit';
}) {
  const isEditLayout = layout === 'edit';

  return (
    <div
      className={`flex flex-col gap-3 ${isEditLayout ? 'w-full max-w-none' : 'max-w-2xl mx-auto'}`}
    >
      {showPlatformLogo && <WizardPlatformLogo platform={form.platform} />}

      {!isEditLayout && (
        <div className="text-center sm:text-left">
          <h3 className="text-lg font-semibold">{t('webhooks.wizard.eventsTitle')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('webhooks.wizard.eventsSubtitle')}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-1.5">
        <span className="text-sm font-medium">
          {t('webhooks.eventsLabel')} · {form.events.size}
        </span>
        <button
          type="button"
          className="text-xs text-primary hover:underline font-medium"
          onClick={toggleAll}
          disabled={events.length === 0}
          data-testid="webhook-toggle-all-events"
        >
          {t(allChecked ? 'webhooks.uncheckAll' : 'webhooks.checkAll')}
        </button>
      </div>

      <div
        className={`flex flex-col gap-2.5 overflow-y-auto pr-1 ${
          isEditLayout ? 'max-h-[min(32rem,60vh)]' : 'max-h-[min(22rem,50vh)]'
        }`}
      >
        {eventsByCategory.map(([category, list]) => (
          <div key={category} className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium px-1">
              {category}
            </span>
            <div
              className={
                isEditLayout
                  ? 'grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'grid gap-1.5 sm:grid-cols-2'
              }
            >
              {list.map((e) => {
                const checked = form.events.has(e.type);
                return (
                  <label
                    key={e.type}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 cursor-pointer transition-colors ${
                      checked
                        ? 'border-primary/60 bg-primary/5'
                        : 'border-border hover:border-primary/30 hover:bg-muted/20'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="shrink-0"
                      checked={checked}
                      onChange={() => toggleEvent(e.type)}
                      data-testid={`webhook-event-${e.type}`}
                    />
                    <span className="flex min-w-0 flex-col gap-0 min-h-0">
                      <span className="text-sm font-medium leading-snug">{eventLabel(e)}</span>
                      <span className="text-[10px] text-muted-foreground font-mono truncate leading-tight">
                        {e.type}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WebhookEditForm({
  form,
  setForm,
  events,
  eventsByCategory,
  eventLabel,
  allChecked,
  toggleEvent,
  toggleAll,
  saving,
  onClose,
  onSubmit,
  t,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  events: WebhookEvent[];
  eventsByCategory: [string, WebhookEvent[]][];
  eventLabel: (e: WebhookEvent) => string;
  allChecked: boolean;
  toggleEvent: (type: string) => void;
  toggleAll: () => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  t: (key: TranslationKey) => string;
}) {
  const isTelegram = form.platform === 'telegram';

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t('webhooks.nameLabel')}</span>
          <input
            className="px-3 py-2 border border-border rounded bg-input text-foreground"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('webhooks.namePlaceholder')}
            data-testid="webhook-name"
          />
        </label>

        <div className="flex flex-col gap-1 sm:items-center" data-testid="webhook-platform">
          <span className="text-sm font-medium sm:sr-only">{t('webhooks.platformLabel')}</span>
          <div className="flex items-center gap-2 sm:flex-col sm:gap-1">
            <WebhookPlatformIcon
              platformIconUrl={platformIconPath(form.platform)}
              platform={form.platform}
              size={40}
            />
            <span className="text-sm text-muted-foreground">{t(PLATFORM_LABEL_KEYS[form.platform])}</span>
          </div>
        </div>
      </div>

      {isTelegram ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('webhooks.botTokenLabel')}</span>
            <input
              className="px-3 py-2 border border-border rounded bg-input text-foreground font-mono text-sm"
              value={form.botToken}
              onChange={(e) => setForm({ ...form, botToken: e.target.value })}
              data-testid="webhook-bot-token"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('webhooks.chatIdLabel')}</span>
            <input
              className="px-3 py-2 border border-border rounded bg-input text-foreground font-mono text-sm"
              value={form.chatId}
              onChange={(e) => setForm({ ...form, chatId: e.target.value })}
              data-testid="webhook-chat-id"
            />
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t('webhooks.urlLabel')}</span>
          <input
            className="px-3 py-2 border border-border rounded bg-input text-foreground font-mono text-sm"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder={t('webhooks.urlPlaceholder')}
            data-testid="webhook-url"
          />
        </label>
      )}
      <p className="text-xs text-muted-foreground -mt-2">{t('webhooks.targetUnchanged')}</p>

      <EventsStep
        form={form}
        events={events}
        eventsByCategory={eventsByCategory}
        eventLabel={eventLabel}
        allChecked={allChecked}
        toggleEvent={toggleEvent}
        toggleAll={toggleAll}
        t={t}
        layout="edit"
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="tertiary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={onSubmit} disabled={saving || !form.name.trim()} data-testid="webhook-submit">
          {saving ? t('webhooks.saving') : t('webhooks.save')}
        </Button>
      </div>
    </div>
  );
}

function WebhookCreateWizard({
  form,
  setForm,
  createStep,
  setCreateStep,
  events,
  eventsByCategory,
  eventLabel,
  allChecked,
  toggleEvent,
  toggleAll,
  saving,
  onClose,
  onSubmit,
  t,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  createStep: CreateStep;
  setCreateStep: (s: CreateStep) => void;
  events: WebhookEvent[];
  eventsByCategory: [string, WebhookEvent[]][];
  eventLabel: (e: WebhookEvent) => string;
  allChecked: boolean;
  toggleEvent: (type: string) => void;
  toggleAll: () => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  t: (key: TranslationKey) => string;
}) {
  const stepIndex = CREATE_STEPS.indexOf(createStep);
  const connectionReady = form.name.trim() && targetFilled(form);

  const goBack = () => {
    if (stepIndex <= 0) return;
    setCreateStep(CREATE_STEPS[stepIndex - 1]);
  };

  const goNext = () => {
    if (stepIndex >= CREATE_STEPS.length - 1) return;
    setCreateStep(CREATE_STEPS[stepIndex + 1]);
  };

  let body: ReactNode;
  if (createStep === 'platform') {
    body = (
      <PlatformPickerStep
        platform={form.platform}
        onSelect={(p) => setForm({ ...form, platform: p })}
        t={t}
      />
    );
  } else if (createStep === 'connection') {
    body = <ConnectionStep form={form} setForm={setForm} t={t} isEdit={false} />;
  } else {
    body = (
      <EventsStep
        form={form}
        events={events}
        eventsByCategory={eventsByCategory}
        eventLabel={eventLabel}
        allChecked={allChecked}
        toggleEvent={toggleEvent}
        toggleAll={toggleAll}
        t={t}
        showPlatformLogo
      />
    );
  }

  const nextDisabled =
    createStep === 'connection' ? !connectionReady : false;

  return (
    <div className="flex flex-col">
      <WizardStepper step={createStep} t={t} />
      <div className="min-h-[280px] animate-fade-in">{body}</div>
      <div className="flex justify-between gap-2 pt-6 mt-2 border-t border-border">
        <Button variant="tertiary" onClick={stepIndex === 0 ? onClose : goBack}>
          {stepIndex === 0 ? t('common.cancel') : t('webhooks.wizard.back')}
        </Button>
        {createStep === 'events' ? (
          <Button
            onClick={onSubmit}
            disabled={saving || !form.name.trim() || !targetFilled(form)}
            data-testid="webhook-submit"
          >
            {saving ? t('webhooks.saving') : t('webhooks.wizard.create')}
          </Button>
        ) : (
          <Button onClick={goNext} disabled={nextDisabled}>
            {t('webhooks.wizard.next')}
          </Button>
        )}
      </div>
    </div>
  );
}

export const meta = pageMeta('webhooks.title');

export default function AdminWebhooks() {
  usePageTitle('webhooks.title');
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t, language } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const [destinations, setDestinations] = useState<WebhookDestination[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [createStep, setCreateStep] = useState<CreateStep>('platform');
  const [saving, setSaving] = useState(false);

  const toastError = useCallback(
    (err: unknown) => {
      const error = err as ApiResponse;
      addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
    },
    [addToast, t],
  );

  const eventLabel = useCallback(
    (e: WebhookEvent) => (language === 'es' ? e.labelEs : e.labelEn),
    [language],
  );

  const eventsByCategory = useMemo(() => {
    const map = new Map<string, WebhookEvent[]>();
    for (const e of events) {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    return [...map.entries()];
  }, [events]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [destRes, eventsRes] = await Promise.all([
        api.get<ListWebhookDestinationsData>('/api/p/webhooks/destinations'),
        api.get<ListWebhookEventsData>('/api/p/webhooks/events'),
      ]);
      setDestinations(destRes.data?.destinations ?? []);
      setEvents(eventsRes.data?.events ?? []);
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
    if (isAdmin) void fetchAll();
  }, [isAdmin, fetchAll]);

  const closeForm = () => {
    setForm(null);
    setCreateStep('platform');
  };

  const openCreate = () => {
    setCreateStep('platform');
    setForm(emptyForm());
  };

  const openEdit = (d: WebhookDestination) =>
    setForm({
      id: d.id,
      name: d.name,
      platform: d.platform,
      enabled: d.enabled,
      url: '',
      botToken: '',
      chatId: '',
      events: new Set(d.subscribedEvents),
    });

  const toggleEvent = (type: string) => {
    if (!form) return;
    const next = new Set(form.events);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setForm({ ...form, events: next });
  };

  const allChecked = !!form && events.length > 0 && form.events.size === events.length;

  const toggleAll = () => {
    if (!form) return;
    const next = allChecked ? new Set<string>() : new Set(events.map((e) => e.type));
    setForm({ ...form, events: next });
  };

  const buildTarget = (f: FormState): Record<string, string> | undefined => {
    if (f.platform === 'telegram') {
      if (!f.botToken.trim() && !f.chatId.trim()) return undefined;
      return { botToken: f.botToken.trim(), chatId: f.chatId.trim() };
    }
    if (!f.url.trim()) return undefined;
    return { url: f.url.trim() };
  };

  const submit = async () => {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    try {
      const target = buildTarget(form);
      const subscribedEvents = [...form.events];
      if (form.id) {
        await api.patch(`/api/p/webhooks/destinations/${form.id}`, {
          name: form.name.trim(),
          enabled: form.enabled,
          subscribedEvents,
          ...(target ? { target } : {}),
        });
        addToast({ type: 'success', title: t('common.success'), message: t('webhooks.updated') });
      } else {
        await api.post('/api/p/webhooks/destinations', {
          name: form.name.trim(),
          platform: form.platform,
          enabled: form.enabled,
          target: target ?? {},
          subscribedEvents,
        });
        addToast({ type: 'success', title: t('common.success'), message: t('webhooks.created') });
      }
      closeForm();
      void fetchAll();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (d: WebhookDestination) => {
    try {
      await api.patch(`/api/p/webhooks/destinations/${d.id}`, { enabled: !d.enabled });
      void fetchAll();
    } catch (err) {
      toastError(err);
    }
  };

  const sendTest = async (d: WebhookDestination) => {
    try {
      await api.post(`/api/p/webhooks/destinations/${d.id}/test`);
      addToast({ type: 'success', title: t('common.success'), message: t('webhooks.testSent') });
    } catch (err) {
      toastError(err);
    }
  };

  const remove = async (d: WebhookDestination) => {
    if (!window.confirm(t('webhooks.deleteConfirm'))) return;
    try {
      await api.delete(`/api/p/webhooks/destinations/${d.id}`);
      addToast({ type: 'success', title: t('common.success'), message: t('webhooks.deleted') });
      void fetchAll();
    } catch (err) {
      toastError(err);
    }
  };

  if (!isAdmin) return null;

  const isEditing = Boolean(form?.id);

  return (
    <PageContent size="wide">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-3xl font-semibold">{t('webhooks.title')}</h1>
        <Button onClick={openCreate} data-testid="create-webhook">
          {t('webhooks.createButton')}
        </Button>
      </div>
      <p className="text-muted-foreground mb-6 max-w-3xl">{t('webhooks.subtitle')}</p>

      <Panel>
        {loading ? (
          <TableSkeleton columns={5} actionsColumn />
        ) : destinations.length === 0 ? (
          <p className="text-muted-foreground">{t('webhooks.empty')}</p>
        ) : (
          <Table data-testid="webhooks-table">
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell className="w-12">
                  <span className="sr-only">{t('webhooks.colPlatform')}</span>
                </TableHeaderCell>
                <TableHeaderCell>{t('webhooks.colName')}</TableHeaderCell>
                <TableHeaderCell>{t('webhooks.colTarget')}</TableHeaderCell>
                <TableHeaderCell>{t('webhooks.colEvents')}</TableHeaderCell>
                <TableHeaderCell>{t('webhooks.colStatus')}</TableHeaderCell>
                <TableHeaderCell last />
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {destinations.map((d) => (
                <TableRow key={d.id} striped onClick={() => openEdit(d)}>
                  <TableCell className="w-12 pr-2">
                    <WebhookPlatformIcon
                      platformIconUrl={d.platformIconUrl}
                      platform={d.platform}
                      size={28}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <TableCellText value={d.name} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{d.targetHint}</TableCell>
                  <TableCell>{d.subscribedEvents.length}</TableCell>
                  <TableCell>
                    <Badge
                      variant={d.enabled ? 'success' : undefined}
                      className={d.enabled ? undefined : 'bg-muted text-muted-foreground'}
                    >
                      {t(d.enabled ? 'webhooks.statusEnabled' : 'webhooks.statusDisabled')}
                    </Badge>
                  </TableCell>
                  <TableCell last onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <SendIconButton onClick={() => void sendTest(d)} title={t('webhooks.test')} />
                      <PowerIconButton
                        onClick={() => void toggleEnabled(d)}
                        title={t(d.enabled ? 'webhooks.disable' : 'webhooks.enable')}
                      />
                      <EditIconButton onClick={() => openEdit(d)} title={t('webhooks.edit')} />
                      <DeleteIconButton onClick={() => void remove(d)} title={t('webhooks.delete')} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Modal
        isOpen={form !== null}
        onClose={closeForm}
        title={isEditing ? t('webhooks.editTitle') : t('webhooks.createTitle')}
      >
        {form &&
          (isEditing ? (
            <WebhookEditForm
              form={form}
              setForm={setForm}
              events={events}
              eventsByCategory={eventsByCategory}
              eventLabel={eventLabel}
              allChecked={allChecked}
              toggleEvent={toggleEvent}
              toggleAll={toggleAll}
              saving={saving}
              onClose={closeForm}
              onSubmit={() => void submit()}
              t={t}
            />
          ) : (
            <WebhookCreateWizard
              form={form}
              setForm={setForm}
              createStep={createStep}
              setCreateStep={setCreateStep}
              events={events}
              eventsByCategory={eventsByCategory}
              eventLabel={eventLabel}
              allChecked={allChecked}
              toggleEvent={toggleEvent}
              toggleAll={toggleAll}
              saving={saving}
              onClose={closeForm}
              onSubmit={() => void submit()}
              t={t}
            />
          ))}
      </Modal>
    </PageContent>
  );
}
