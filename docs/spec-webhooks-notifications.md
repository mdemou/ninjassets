# Feature specification: Webhooks and the domain event catalog

- **Document ID:** SPEC-WEBHOOK-001
- **Status:** Implemented
- **Last updated:** 2026-06-02
- **Related requirements (E2E):** REQ-WEBHOOK-001 (`e2e/tests/webhooks/`, mock receiver)
- **Depends on:** spec-platform-access-model.md, spec-asset-management.md, spec-handover-magic-link.md, spec-data-quality-and-alerts.md, spec-admin-user-management.md

---

## 1. Summary

Introduce **outbound webhooks** to **Slack**, **Discord**, and **Telegram**, driven by a new
**central domain event catalog**. Admins register one or more **destinations**; each destination
subscribes to a chosen subset of events. When a domain action occurs, the producing domain
**publishes a single typed event** to an in-process **event bus**, whose subscriber **enqueues the
event as a job on a Redis queue**. An in-process **queue consumer** pops each job and (via a queue
controller → domain) fans it out to every enabled destination whose subscription includes that
event, rendering a **platform-native message** for each. Routing through Redis decouples producing
an event from delivering it, so delivery scales independently of the triggering request (horizontal
/ multitenant).

Today the system has **three disconnected notification surfaces**:

1. **Transaction / audit log** (`ITransactionAction`, asset + handover/custody actions),
2. **Transactional email** (verify, reset, handover, asset-unassigned — hard-coded triggers),
3. **Data-quality alerts** (the notification bell).

This spec adds webhooks **and** unifies delivery: all outbound notifications (webhooks + the
mandatory transactional emails) now flow through **one reliable Redis queue** + a notification
service. Emails are **reference-based** jobs (identifiers only; the consumer re-fetches secrets) and
are **at-least-once**; the handover email is the one inline exception (§6.3, §7).

> **Non-negotiable invariant:** transactional emails (sign-up verification, password reset,
> assignment/unassignment notices) are **mandatory side effects** and are **never** gated by
> webhook configuration. Having zero webhook destinations changes nothing about whether emails
> send. The per-destination `subscribed_events` filter governs **webhooks only**. See §6.3.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Let admins push selected domain events to Slack, Discord, and Telegram. |
| G2 | Per-destination control over **which** events are delivered. |
| G3 | A **single typed event catalog** as the source of truth for event names, categories, and labels. |
| G4 | Decouple event **producers** (domains) from **consumers** (webhooks now; email later) via an event bus. |
| G5 | Make catalog drift **structurally hard** — the type system forces metadata at author time; a thin test catches the residue (§16). |
| G6 | Never affect transactional email, and never block/slow the primary HTTP operation (§7). |

## 3. Non-goals (v1)

- **Re-wiring email** through the event bus (documented as future, §6.3).
- **Persisted delivery log / durable outbox** — delivery is at-least-once over a Redis queue (processing list + reaper + dedup); a DB-persisted outbox + delivery-log UI is **phase 2** (§7.3).
- Generic **outbound HTTP webhooks** to arbitrary customer endpoints (only the three chat platforms).
- **Inbound** webhooks / slash commands / interactive buttons.
- Per-user (end-user) webhook subscriptions — destinations are **admin/ops** channels.
- Rate limiting / digesting / batching of bursts.
- Signing of outbound payloads (not meaningful for Slack/Discord/Telegram incoming webhooks).

## 4. Glossary

| Term | Definition |
|------|------------|
| **Domain event** | A typed record describing something that happened (`asset.assigned`, `user.registered`). |
| **Event catalog** | The single typed registry of all domain events + metadata (category, labels, formatter map). |
| **Event bus** | In-process typed publish/subscribe seam. Producers `publish`; consumers `subscribe`. |
| **Consumer** | The `queueConsumer` loop that `BLPOP`s notification jobs from Redis and routes them to a queue controller (v1: webhook delivery). |
| **Enqueuer** | `notificationService` — `webhook(event)` (the event-bus subscriber) and `email(type, refs)` (called by domains) both `rpush` an envelope onto the Redis queue. |
| **Reaper** | `setInterval` that requeues jobs stranded in the processing list past the visibility timeout (at-least-once). |
| **Destination** | An admin-configured Slack/Discord/Telegram target with its own event subscription. |
| **Subscription** | The set of event types a destination wants (`subscribed_events`). Webhook-only filter. |
| **Target** | Platform delivery coordinates: a webhook URL (Slack/Discord) or bot token + chat id (Telegram). |

## 5. Personas and user stories

| ID | Story | Priority |
|----|-------|----------|
| US-W1 | As an admin, I add a Slack destination and pick which events it receives. | Must |
| US-W2 | As an admin, I send a **test message** to confirm a destination works before saving real events. | Must |
| US-W3 | As an admin, I enable/disable a destination without deleting it. | Must |
| US-W4 | As ops, I see asset assignments / handovers / data-quality alerts in our Discord channel. | Must |
| US-W5 | As a developer, when I add a new event I cannot ship it without a category, EN+ES label, and formatter. | Must |
| US-W6 | As an admin, a broken/slow destination URL never delays the asset operation that triggered it. | Must |

## 6. Architecture

### 6.1 Event bus → Redis queue (emission + transport)

Domains publish events through a small **typed in-process bus** rather than calling dispatchers
directly. The bus's **single subscriber enqueues the event as a job onto a Redis list**; an
in-process **queue consumer** pops jobs and delivers them. This decouples *producing* an event from
*delivering* it, so delivery scales independently of the request that triggered it (any backend
instance can pop and process) — the multitenant/horizontal-scale requirement.

```
// domain (e.g. assets.domain.ts), alongside transactionRepository.createMany(...)
eventBus.publish({ type: 'asset.assigned', subject, actor, occurredAt, ... });

// startup wiring (composition root, init.ts)
eventBus.subscribe((e) => notificationService.webhook(e));  // rpush webhook job → Redis
void queueConsumer.consumeList();                            // BRPOPLPUSH → dispatch → ack
```

Webhook flow: `eventBus.publish` → `notificationService.webhook` (`rpush ninjasset:notifications`) →
`queueConsumer` (`BRPOPLPUSH`) → `notificationDispatcher` (kind router) →
`webhooksDomain.deliverEvent` (load enabled destinations, filter, `sendEvent`). Email jobs ride the
same queue via `notificationService.email(type, refs)` → dispatcher → catalog resolver → `sendMail`.

- `publish` accepts only an `EventType` from the catalog (compiler-enforced; an unknown name won't compile).
- `publish` is fire-and-forget (microtask) and **best-effort**: a thrown subscriber never propagates to the domain caller; an enqueue failure (Redis down) is logged and swallowed — it never affects the operation that produced the event.
- The **consumer is a router**: it maps each Redis queue key to a controller, exactly as an HTTP route maps to its controller. Adding a new job type = a new queue key + case + controller.
- Email (future, §6.3) becomes another bus subscriber / queue, with its own unconditional send rule.

### 6.2 Event catalog (source of truth)

A single typed object. Each entry **requires** all its metadata, so the compiler rejects an event
that is missing a category, label, or formatter (§16). Asset/handover/custody events map 1:1 to the
existing `ITransactionAction` values; user/auth, alert, and import/export job-completion events are
**new** emission points (not audit transactions today).

```ts
type EventCategory = 'asset' | 'handover' | 'custody' | 'alert' | 'user' | 'import' | 'export';

interface EventDef {
  category: EventCategory;
  labels: { en: string; es: string };       // human label for UI + message titles
  defaultSubscribed: boolean;                // suggested default when creating a destination
}

const EVENT_CATALOG = {
  // --- asset lifecycle (maps to ITransactionAction) ---
  'asset.created':         { category: 'asset',    labels: { en: 'Asset created',        es: 'Activo creado' },          defaultSubscribed: false },
  'asset.assigned':        { category: 'asset',    labels: { en: 'Asset assigned',       es: 'Activo asignado' },        defaultSubscribed: true  },
  'asset.unassigned':      { category: 'asset',    labels: { en: 'Asset unassigned',     es: 'Activo liberado' },        defaultSubscribed: true  },
  'asset.status_changed':  { category: 'asset',    labels: { en: 'Asset status changed', es: 'Estado de activo cambiado' }, defaultSubscribed: false },
  'asset.site_changed':    { category: 'asset',    labels: { en: 'Asset site changed',   es: 'Sitio de activo cambiado' }, defaultSubscribed: false },
  'asset.deleted':         { category: 'asset',    labels: { en: 'Asset deleted',        es: 'Activo eliminado' },       defaultSubscribed: false },
  // --- handover / custody ---
  'handover.created':              { category: 'handover', labels: { en: 'Handover started',   es: 'Traspaso iniciado' },   defaultSubscribed: true  },
  'handover.cancelled':            { category: 'handover', labels: { en: 'Handover cancelled', es: 'Traspaso cancelado' },  defaultSubscribed: false },
  'custody.accepted':              { category: 'custody',  labels: { en: 'Custody accepted',   es: 'Custodia aceptada' },   defaultSubscribed: true  },
  'custody.completed_on_behalf':   { category: 'custody',  labels: { en: 'Custody completed on behalf', es: 'Custodia completada en nombre de' }, defaultSubscribed: false },
  // --- data-quality alerts (new emission point, §9.3) ---
  'alert.raised':          { category: 'alert',    labels: { en: 'Data-quality alert raised',  es: 'Alerta de calidad de datos' }, defaultSubscribed: true  },
  // --- user & auth (NOT transactions today, §9.2) ---
  'user.registered':       { category: 'user',     labels: { en: 'User registered',      es: 'Usuario registrado' },     defaultSubscribed: false },
  'user.created':          { category: 'user',     labels: { en: 'User created by admin', es: 'Usuario creado por admin' }, defaultSubscribed: false },
  'user.deleted':          { category: 'user',     labels: { en: 'User deleted',         es: 'Usuario eliminado' },      defaultSubscribed: false },
  'user.locked':           { category: 'user',     labels: { en: 'Account locked',       es: 'Cuenta bloqueada' },       defaultSubscribed: false },
  // --- import / export jobs (async worker completion, SPEC-IMPORT-001) ---
  'import.dry_run_completed': { category: 'import', labels: { en: 'Import dry-run completed', es: 'Simulación de importación completada' }, defaultSubscribed: false },
  'import.commit_completed':  { category: 'import', labels: { en: 'Import commit completed',  es: 'Importación confirmada completada' },  defaultSubscribed: true  },
  'export.completed':         { category: 'export', labels: { en: 'Export completed',         es: 'Exportación completada' },             defaultSubscribed: true  },
} satisfies Record<string, EventDef>;

type EventType = keyof typeof EVENT_CATALOG;
```

> The fine-grained `*_CHANGED` transaction actions (manufacturer/vendor/parent/category/custom-fields/
> warranty/return-date/updated) are intentionally **not** individual webhook events in v1 — they stay in
> the audit log only. Adding one later means adding a catalog entry (compiler will demand its metadata).

### 6.3 Mandatory emails also flow through the queue

Transactional emails are now **a second job kind on the same pipeline** (see §7), not inline
`emailService.sendMail` calls. They are **reference-based**: the producer enqueues only identifiers
(e.g. `{ userId }`); the consumer re-fetches the raw token + recipient from the DB and renders — so
secrets never enter Redis. The `NOTIFICATION_CATALOG` (`services/notifications/notificationCatalog.ts`)
is the inventory of email notification types (`email.verification`, `email.account_activation`,
`email.password_reset`, `email.asset_unassigned`), each `mandatory: true`.

> **Invariant preserved:** mandatory emails are never gated by webhook `subscribed_events` or the
> `webhooks.enabled` switch — only by the pipeline's own `notifications.enabled`. Disabling webhooks
> never stops mandatory emails.

**One documented exception — the handover email stays inline** (`handovers.domain.ts`): it embeds the
raw magic-link token, which is stored **hash-only** and is unrecoverable later, so a reference-based
consumer cannot re-render it.

## 7. Delivery semantics (unified Redis pipeline; at-least-once)

A single reliable queue carries **both** job kinds (`webhook` and `email`), routed by `kind`:

| Aspect | Behaviour |
|--------|-----------|
| Envelope | `{ id (uuid), kind: 'webhook'\|'email', type, enqueuedAt, retries, payload }`. webhook payload = `DomainEvent`; email payload = `{ notificationType, refs }` (refs = identifiers only). |
| Producer | `notificationService.webhook(event)` (event-bus subscriber, gated by `webhooks.enabled`) and `notificationService.email(type, refs)` (domains). Both `rpush` to `ninjasset:notifications`. Enqueue failure is logged, never breaks the operation. |
| Consume | `BRPOPLPUSH main → processing` (atomic claim, 5s block). dedup check → `dispatchNotification` (webhook → `deliverEvent`; email → `NOTIFICATION_CATALOG` resolver + `sendMail`) → `SET dedup:<id> NX EX` (after success) → `LREM` ack. |
| Guarantee | **At-least-once.** A crash/throw before ack leaves the job in `processing`; the **reaper** (`setInterval`) requeues entries older than the visibility timeout (retries+1, fresh `enqueuedAt`) up to `maxRetries`, then drops. Dedup-after-send prevents re-delivery on the crash-after-send path. |
| Webhook filtering | For each **enabled** destination, deliver iff `event.type ∈ destination.subscribed_events`; per-destination `void sendEvent(...).catch(log)`. |
| Email rendering | Resolver re-fetches token (`findLatestByUserId`) + user; returns `null` (user/token gone) → terminal ack-skip, not an error. |
| Isolation | A failing destination, a failing SMTP, or Redis being down never throws into or delays the originating HTTP request. |
| Consumer | Runs **in-process** (gated by `notifications.enabled`). Enqueue-only API nodes + dedicated worker nodes is a future split — the consumer is already process-agnostic. |

Config: visibility timeout 60s, reaper interval 15s, BRPOPLPUSH block 5s, maxRetries 5, dedup TTL 24h.

### 7.1 Reliability caveats
- Dedup is recorded **after** a successful send (so a failed mandatory email retries instead of being
  silently suppressed). A crash in the µs window between send and dedup yields one rare duplicate —
  acceptable (a duplicate beats a lost credential email; chat duplicates are benign).
- With `MOCK_EMAIL=true` (tests) the send always "succeeds", so the retry/reaper paths are **not**
  exercised by E2E — they are verified manually.

### 7.3 Phase 2 (documented, not built): durable outbox

A persisted `webhook_delivery`/notification table (status, attempts, next_attempt_at, last_error) +
delivery-log UI remains future. The reliable in-memory-state queue here is the transport it builds on.

## 8. Data model

### 8.1 `webhook_destination`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | Admin label, e.g. "Ops Slack". |
| `platform` | enum(`slack`,`discord`,`telegram`) | |
| `enabled` | boolean, default true | Disable without deleting. |
| `target` | jsonb | `{ url }` (Slack/Discord) **or** `{ botToken, chatId }` (Telegram). Secret — see §12. |
| `subscribed_events` | jsonb | Each value must be a current `EventType` (validated against catalog on write). jsonb for parity with `api_key.scopes`. |
| `date_created` / `date_updated` | timestamptz | |
| `fk_created_by` | uuid → user | Audit. |

Migration name (Knex, repo convention): `<timestamp>_create_webhook_destination.ts`.

> No `webhook_delivery` table in v1 (phase 2 only, §7.3).

## 9. Event emission points (where domains publish)

### 9.1 Asset, handover, custody — alongside existing audit writes

These domains already build transaction rows and call `transactionRepository.createMany(events)`
(e.g. `assets.domain.ts:283`, handovers domain). **Immediately after** the audit write succeeds, the
domain publishes the matching catalog event(s) to the bus. The audit log remains the system of record;
the event publish is an additive side channel.

| Domain action | Audit action (`ITransactionAction`) | Published event |
|---------------|-------------------------------------|-----------------|
| Asset created | `CREATED` | `asset.created` |
| Asset assigned | `ASSIGNED` | `asset.assigned` |
| Assignee cleared | `UNASSIGNED` | `asset.unassigned` |
| Status changed | `STATUS_CHANGED` | `asset.status_changed` |
| Site changed | `SITE_CHANGED` | `asset.site_changed` |
| Asset deleted | `DELETED` | `asset.deleted` |
| Handover started | `HANDOVER_CREATED` | `handover.created` |
| Handover cancelled | `HANDOVER_CANCELLED` | `handover.cancelled` |
| Custody accepted | `CUSTODY_ACCEPTED` | `custody.accepted` |
| Custody on behalf | `CUSTODY_COMPLETED_ON_BEHALF` | `custody.completed_on_behalf` |

### 9.2 User & auth — new publish calls (no audit equivalent today)

| Domain action | Published event |
|---------------|-----------------|
| Self-service registration | `user.registered` |
| Admin creates user | `user.created` |
| Admin deletes user | `user.deleted` |
| Account lockout tripped | `user.locked` |

### 9.3 Data-quality alerts — needs an emission seam

Data-quality results are computed **on demand** today (no persisted raise/clear lifecycle, see
spec-data-quality-and-alerts.md). **[RESOLVED — D3]** v1 publishes `alert.raised` from the point where
the alert/report computation surfaces an at-attention item, **on detection only**. Because there is no
persisted lifecycle, `alert.cleared` is **deferred** and is **not** in the catalog yet. A cleared event
(and de-duplication so the same standing issue doesn't re-publish on every computation) requires a
persisted alert state and is left to a later phase alongside the outbox (§7.3).

## 10. Event payload

A single normalized payload shape per event, platform-agnostic. Formatters (§11) read from it.

```ts
interface EventEnvelope {
  type: EventType;
  occurredAt: string;            // ISO
  actor: { id: string | null; name: string | null } | null;   // who caused it
  subject: {                     // what it is about (asset/user/handover)
    kind: 'asset' | 'user' | 'handover' | 'alert';
    id: string | null;
    name: string;                // display name, never null (fallback to id/"—")
  };
  target?: { id: string | null; name: string | null };        // e.g. assignee
  detail?: string | null;        // short human detail (mirrors audit `detail`)
  link?: string;                 // FRONTEND_URL deep link (e.g. /assets/{id})
}
```

> **PII note:** payloads go to external chat services. Include display names and asset names; do **not**
> include emails, tokens, or secrets. See §12.

## 11. Message formatting (platform-native rich)

One formatter per platform, switching on `event.category`/`type`. Each renders title + fields
(asset/actor/target/site) + a link back to the app.

| Platform | Format | Delivery |
|----------|--------|----------|
| Slack | Block Kit (`blocks[]`: header + section fields + link button) | POST JSON to incoming webhook URL |
| Discord | `embeds[]` (title, fields, `url`, color by category) | POST JSON to webhook URL |
| Telegram | HTML (`<b>title</b>` + lines + link) | POST to `https://api.telegram.org/bot<token>/sendMessage` with `chat_id` |

Localization: message body uses the catalog `labels` and a small per-event template. v1 uses a **fixed
language** for outbound messages (aligned with the email policy in spec-email-notifications.md §10.2);
per-destination locale is deferred.

## 12. Security

| Control | Detail |
|---------|--------|
| Access | Configuration is **admin-only** via a new capability `webhooks:manage` (JWT admin holds `*`); modelled on `api_keys:manage` — **not** grantable to API keys. |
| Secret storage | **[RESOLVED — D4]** `target` is stored **plaintext in `webhook_destination.target` (jsonb)** — consistent with the current secret posture (SMTP creds live plaintext in env; the app has no encryption-at-rest infra yet). Mitigated by masked reads (below) and write-only updates. Encryption-at-rest (AES-256-GCM with an app key) is a documented **hardening follow-up**, not v1. |
| Secret sensitivity | Blast radius differs by platform: a Slack/Discord **incoming-webhook URL** is *post-only to one channel* (low). A **Telegram bot token** controls the whole bot (read other chats, send anywhere) — treat it as the most sensitive value and prioritise it if/when encryption-at-rest lands. |
| Secret in responses | GET endpoints return a **masked** target (URL → host only; Telegram → bot id + last 4 of token). The full secret is **write-only** and never returned after creation. |
| SSRF | Slack/Discord URLs are user-supplied → restrict to **known hosts** (`hooks.slack.com`, `discord.com`/`discordapp.com`) and `https` only; Telegram host is fixed. Reject private/loopback hosts. |
| PII | Payloads exclude emails, tokens, passwords (§10). |
| Failure isolation | Dispatch errors are swallowed + logged; never surface to the triggering request (§7). |
| Test sends | The "send test" action (US-W2) requires `webhooks:manage` and is rate-limited. |

## 13. API specification

All under `/api/p/*`, guarded by `webhooks:manage`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/p/webhooks/events` | List the event catalog (type, category, EN/ES label, defaultSubscribed) for the UI. |
| GET | `/api/p/webhooks/destinations` | List destinations (target **masked**). |
| POST | `/api/p/webhooks/destinations` | Create (name, platform, target, subscribed_events). Validates events ⊆ catalog. |
| GET | `/api/p/webhooks/destinations/{id}` | Read one (target masked). |
| PATCH | `/api/p/webhooks/destinations/{id}` | Update name/enabled/target/subscribed_events. |
| DELETE | `/api/p/webhooks/destinations/{id}` | Remove. |
| POST | `/api/p/webhooks/destinations/{id}/test` | Send a sample message to verify connectivity. |

## 14. Acceptance criteria (E2E) — REQ-WEBHOOK-001 (implemented, `e2e/tests/webhooks/req-webhook-001.spec.ts`)

| # | AC |
|---|----|
| AC-1 | Admin creates a destination; it appears in the list with a **masked** target. |
| AC-2 | Creating with an unknown event type is rejected (event ∉ catalog). |
| AC-3 | A disabled destination receives **no** deliveries. |
| AC-4 | An event delivers **only** to destinations subscribed to that event type. |
| AC-5 | With **zero** destinations, the triggering operation succeeds unchanged (and email still sends — cross-check with email spec). |
| AC-6 | A failing destination (unreachable URL) does not fail or delay the triggering request. |
| AC-7 | `GET /api/p/webhooks/events` returns every catalog event with EN+ES labels (drift guard, §16). |
| AC-8 | Non-admin / API key without `webhooks:manage` is denied all config endpoints. |

> E2E delivery is asserted against a **mock receiver** (local HTTP stub) rather than live Slack/Discord/Telegram.

## 15. Frontend

| Route | Purpose |
|-------|---------|
| `/admin/settings/integrations` (or `/admin/webhooks`) | List destinations, enable/disable, add/edit, send test. |
| Destination form | Platform select; target fields (URL, or bot token + chat id); event picker grouped by category with defaults from `defaultSubscribed`. |

Event labels in the picker come from `GET /api/p/webhooks/events` (catalog). UI strings in
`frontend/app/utils/translations.ts` (EN/ES) per repo i18n convention.

## 16. Drift guard (catalog maintenance)

The maintenance concern is addressed in **two layers**, with the type system as the primary mechanism:

1. **Typed catalog (primary, compile-time).** `EVENT_CATALOG` entries `satisfies Record<string, EventDef>`,
   so a new event **cannot be added without** a `category`, `labels.en`, `labels.es`, and
   `defaultSubscribed`. `EventType = keyof typeof EVENT_CATALOG`, and `eventBus.publish` / formatter maps
   are keyed by `EventType` — so a published event with no catalog entry, or a formatter map missing a key,
   **fails to compile** (exhaustive `Record<EventType, Formatter>`).

2. **Thin test (residue, runtime).** This repo has **no backend unit-test runner** — its test strategy is Playwright E2E. So the runtime residue is enforced through E2E instead of a separate unit test:
   - **AC-7** (`req-webhook-001.spec.ts`) hits `GET /api/p/webhooks/events` and asserts every catalog event has a non-empty EN **and** ES label and a category.
   - **Formatter coverage is compile-enforced, not runtime:** formatters switch on `event.category` (an exhaustive union) and every event carries a `category` (required by `EventDef`), so an unwired event cannot reach a missing formatter.
   - `subscribed_events` validation rejecting non-catalog values is covered by **AC-2**.

## 17. Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `WEBHOOKS_ENABLED` | `true` | Master kill-switch for enqueue + consumer + alert scan. |
| `WEBHOOK_HTTP_TIMEOUT_MS` | `5000` | Per-delivery HTTP timeout. |
| `WEBHOOK_ALLOWED_SLACK_HOSTS` | `hooks.slack.com` | SSRF allowlist. |
| `WEBHOOK_ALLOWED_DISCORD_HOSTS` | `discord.com,discordapp.com` | SSRF allowlist. |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` | localhost / 6379 / — / 0 | Redis connection (`config.db.redis`). Tests use db `1`. |
| `FRONTEND_URL` | (existing) | Base for deep links in payloads (§10). |

Redis queue keys are **hardcoded** in `config.db.redis.queues` (`ninjasset:notifications`, `ninjasset:notifications:processing`, `ninjasset:import-export`); dedup prefix `config.notifications.dedupKeyPrefix` is `ninjasset:notif:dedup:` — not environment variables.

## 18. Backend layering

- **Event bus + catalog:** `backend/src/services/events/eventBus.ts` (typed publish/subscribe), `eventCatalog.ts` (`EVENT_CATALOG` + `EventType`), `event.types.ts` (`DomainEvent`), `publishFromTransaction.ts` (audit→event map).
- **Notification service + catalog:** `backend/src/services/notifications/notificationService.ts` (`enqueue`/`webhook`/`email`), `notificationCatalog.ts` (`NOTIFICATION_CATALOG` + `NotificationType` — the email inventory), `notification.types.ts` (envelope).
- **Redis service:** `backend/src/services/redis.service.ts` (`rpush`/`blpop`/`brpoplpush`/`llen`/`setNx`/`lrem`/`lrange`/`terminate`, reads `config.db.redis`).
- **Consumer (router) + reaper + dispatcher + resolvers:** `proceses/queueConsumer.ts` (BRPOPLPUSH + dedup + ack), `infrastructure/notifications/{notificationReaper,notificationDispatcher,notificationResolvers}.ts` (reap; route by `kind`; reference-based email render).
- **Sender + formatters:** `backend/src/services/webhooks/webhookSender.ts` (SSRF + HTTP) + `messageFormatter.ts` (Slack/Discord/Telegram).
- **Domain:** `backend/src/domain/webhooks/webhooks.domain.ts` (destination CRUD, validation, test send, **`deliverEvent`**).
- **Repository:** `webhookDestinationDb/`; token repos add `findLatestByUserId` (`emailVerificationTokenDb/`, `passwordResetTokenDb/`).
- **Routes / capability:** `routes/admin/webhooks/`; `WEBHOOKS_MANAGE` in `CapabilityEnum`.
- **Startup/shutdown:** `proceses/init.ts` subscribes the webhook enqueuer + starts consumer & reaper (consumer/reaper gated by `notifications.enabled`, independent of `webhooks.enabled`); `proceses/lifecycle.ts` stops the consumer + terminates Redis.
- **Producers:** webhook events via `eventBus.publish` (assets/handovers/users/session + `alertScan` + `importExport.domain` job completion, unchanged); email via `notificationService.email(...)` from registration/management/passwordReset/assets domains. Handover email stays inline (§6.3).

## 19. Open decisions

| # | Decision | Status |
|---|----------|--------|
| D1 | Central registry supersets transactions (vs transaction-stream only / thin) | **Resolved:** central registry. |
| D2 | Destinations admin-managed in DB w/ per-destination subscriptions | **Resolved:** DB-managed. |
| D3 | `alert.raised` emission seam given on-demand alert computation | **Resolved:** emit on detection only; `alert.cleared` + de-dup deferred (needs persisted alert state) (§9.3). |
| D4 | Encrypt `target` secrets at rest vs plaintext like SMTP | **Resolved:** plaintext jsonb + masked/write-only reads (parity with current posture); encryption-at-rest is a hardening follow-up; Telegram token flagged as highest-sensitivity (§12). |
| D5 | Email migrated to the queue | **Resolved:** yes — mandatory emails are reference-based jobs on the same pipeline; handover stays inline (hash-only token) (§6.3). |
| D6 | Delivery transport & reliability | **Resolved:** unified Redis queue, **at-least-once** (BRPOPLPUSH + processing list + reaper + dedup-after-send), in-process consumer; DB-persisted outbox/log is phase 2 (§7, §7.3). |
| D7 | Per-destination outbound locale | Deferred (fixed language, §11). |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | Existing event surfaces | `ITransactionAction` (asset+handover/custody), email triggers, alerts — three disconnected today (§1). |
| 2 | Emission alongside audit | Asset/handover/custody publish next to `transactionRepository.createMany` (`assets.domain.ts:283`). |
| 3 | New events have no audit row | `user.*` and `alert.*` are new publishes, not in `ITransactionAction` (§9.2–9.3). |
| 4 | Capability pattern | `webhooks:manage` mirrors `api_keys:manage` — JWT-only, not key-grantable (`capabilities.ts:27`). |
| 5 | Unified Redis queue | Webhook + email jobs `rpush` to `ninjasset:notifications`; in-process `queueConsumer` `BRPOPLPUSH`→dispatch→dedup→ack, reaper requeues stranded jobs (at-least-once). Decouples production from delivery for horizontal scale. Tests isolate on Redis db 1. |
| 6 | i18n | UI labels via `frontend/app/utils/translations.ts`; outbound messages fixed-language like email (§11). |

---

*End of specification.*
