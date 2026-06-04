# Feature specification: Asset custody verification (magic link handover)

- **Document ID:** SPEC-HANDOVER-001
- **Status:** Implemented
- **Last updated:** 2026-05-31
- **Related requirements (E2E):** REQ-HANDOVER-001 … REQ-HANDOVER-005
- **Depends on:** Asset Management (Phase 1), auth/email infrastructure, transaction audit log

> **Note on this revision.** This version folds in corrections found while validating the
> draft against the current codebase. Changes from the original draft are marked
> **[CODEBASE FIX]** and summarised in [§20](#20-changes-from-original-draft-codebase-validation).

---

## 1. Summary

Introduce optional **verified custody** for IT assets using email magic links. Admins can
continue to assign assets directly (no verification). When verification is required, the admin
starts a handover; the assignee receives a one-time link, logs in, and confirms. On confirm, the
asset status updates automatically and the event is audited.

- **Primary channel:** email (every user has a mandatory, unique email).
- **Out of scope for v1:** rotating physical QR codes, NFC, in-app-only flows without email (may be added later).

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Prove that a specific platform user accepted or returned an asset (custody verification). |
| G2 | Keep direct admin assignment unchanged for cases that do not need verification. |
| G3 | Enforce one pending handover per asset to avoid conflicting assignments. |
| G4 | Reuse existing lifecycle rules (STOCK / ASSIGNED, single assignee while ASSIGNED). |
| G5 | Record all outcomes in the existing transaction audit log. |
| G6 | Allow admins full override (cancel, complete on behalf, direct status change). |

## 3. Non-goals (v1)

- Physical proof of possession via the magic-link flow (GPS, photo, in-app signature capture).
- **Wet-ink / scanned custody receipts** are covered separately by [spec-custody-receipt.md](spec-custody-receipt.md) (SPEC-CUSTODY-DOC-001). Magic link remains the in-platform verification channel; signed PDFs are optional archival.
- Replacing or changing existing admin QR codes (still link to admin asset detail).
- User-initiated handovers without admin starting the flow.
- Email to non-users / external addresses.
- New `asset_status` enum value (e.g. `PENDING_HANDOVER`) — pending state is represented by an open handover row.
- Push notifications or user-facing "pending handover" bell (optional later).

## 4. Glossary

| Term | Definition |
|------|------------|
| Direct assign | Admin sets asset to ASSIGNED via existing `PATCH /api/p/assets/{id}` — immediate, no custody verification. |
| Verified handover | Admin starts handover → email magic link → assignee confirms while logged in → status/assignee updated. |
| Handover | A single custody action (`CHECK_OUT` or `CHECK_IN`) with a token, expiry, and target user. |
| CHECK_OUT | Transfer custody to a user: result ASSIGNED + `assigned_user_id`. |
| CHECK_IN | Return custody from a user: result STOCK + `assigned_user_id = null`. |
| Open handover | `status = 'OPEN'` and `expires_at > now()` (see [§8.4](#84-open-handover-definition-codebase-fix)). |
| Magic link | URL containing opaque token, e.g. `{FRONTEND_URL}/handover/accept?token=…` |

## 5. Personas and user stories

### 5.1 Admin

| ID | Story | Priority |
|----|-------|----------|
| US-A1 | As an admin, I can assign an asset directly without verification (current behavior). | Must |
| US-A2 | As an admin, I can start a verified checkout to a user and send a magic link email. | Must |
| US-A3 | As an admin, I can start a verified return for an assigned asset and email the current assignee. | Must |
| US-A4 | As an admin, I cannot start a second open handover on the same asset. | Must |
| US-A5 | As an admin, I can cancel an open handover. | Must |
| US-A6 | As an admin, I can complete on behalf of the target user (audit records admin as actor). | Must |
| US-A7 | As an admin, I can see whether an asset has an open handover on the asset detail page. | Should |
| US-A8 | As an admin, I can copy the magic link without sending email (support / MOCK_EMAIL). | Should |

### 5.2 Assignee (regular user)

| ID | Story | Priority |
|----|-------|----------|
| US-U1 | As a user, I receive an email with a link to accept or return an asset. | Must |
| US-U2 | As a user, I must log in before confirming; only the intended recipient can confirm. | Must |
| US-U3 | As a user, after login I see a confirmation screen (asset name, serial, action) before accepting. | Must |
| US-U4 | As a user, I see a clear, non-revealing message if the link expired, was used, or does not apply to my account. | Must |
| US-U5 | As a user, verified events appear in My History (`/api/me/transactions`). | Must |
| US-U6 | As a user, I see open handovers awaiting my confirmation on `/dashboard` and `/assets`, and can confirm in-app. | Must |
| US-U7 | As a user, I receive an email when an admin removes my assignment without me confirming a return (direct unassign, reassignment, or admin complete-on-behalf). | Must |

## 6. Assignment modes (coexistence)

```
┌─────────────────────────────────────────────────────────────────┐
│ Mode A: Direct assign (unchanged)                                │
│   Admin PATCH → ASSIGNED + assignee immediately                  │
│   No handover row; no ACCEPTED transaction                       │
│   Optional UI: "Unverified assignment" (cosmetic, v1 or later)   │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Mode B: Verified handover (new)                                  │
│   CHECK_OUT: asset remains STOCK until accept                    │
│   CHECK_IN:  asset remains ASSIGNED until accept                 │
│   On accept: apply status + assignee change + audit              │
└─────────────────────────────────────────────────────────────────┘
```

### Policy when both could conflict

**Decision (D1): Option A — block.** Any open handover blocks conflicting direct mutation.

| Situation | Behavior |
|-----------|----------|
| Open handover exists (either type) | Block creating another handover on same asset (HTTP 409). |
| Open handover exists (either type) | Block direct `PATCH` to `status` / `assignedUserId` on that asset until handover resolved (HTTP 409). **[CODEBASE FIX]** — the block must cover **both** CHECK_OUT and CHECK_IN, not only CHECK_OUT. |
| Asset ASSIGNED to Alice | Block CHECK_OUT to Bob until Alice unassigned or return completed. |
| Admin direct assign while pending | Blocked (default), with a message pointing the admin to cancel/complete the handover. |

> Non-conflicting PATCH fields (name, note, site, financials, etc.) are **not** blocked by an
> open handover. Only `status` and `assignedUserId` changes are gated.

## 7. State and business rules

### 7.1 Asset lifecycle (unchanged)

- Statuses: `STOCK`, `ASSIGNED`, `MAINTENANCE`, `ARCHIVED`.
- `assigned_user_id` only when ASSIGNED; domain `resolveAssignment` continues to enforce this on every update.

### 7.2 Handover lifecycle

```
CREATED → (email sent) → OPEN
   ├─ accept (target user, logged in) → CONSUMED → asset updated
   ├─ complete on behalf (admin)      → CONSUMED → asset updated
   ├─ cancel (admin)                  → CANCELLED (no asset change)
   └─ expire (time)                   → EXPIRED   (no asset change; not consumable)
```

**[CODEBASE FIX] These states are stored in an explicit `status` column**, not derived from
timestamps alone. See [§8.4](#84-open-handover-definition-codebase-fix) for why.

### 7.3 CHECK_OUT (verified assign)

| Step | Asset state | Assignee |
|------|-------------|----------|
| Handover created | STOCK | null |
| User/admin completes | ASSIGNED | target_user_id |

**Preconditions**

- Asset status is `STOCK` (not MAINTENANCE / ARCHIVED unless product later allows — v1: reject).
- No other open handover on asset.
- `target_user_id` references an active user with verified email (same rules as assignee today).

### 7.4 CHECK_IN (verified return)

| Step | Asset state | Assignee |
|------|-------------|----------|
| Handover created | ASSIGNED | unchanged until consumed |
| User/admin completes | STOCK | null |

**Preconditions**

- Asset status is `ASSIGNED`.
- `target_user_id` equals **current** `assigned_user_id` (return link always for current holder).
- No other open handover on asset.

**Re-check at accept time.** Because direct status PATCH is blocked while a handover is open,
the assignee should not change underneath an open CHECK_IN. As a defensive check, the accept
handler re-validates `target_user_id === asset.assigned_user_id`; if it no longer matches, reject
with a **distinct** error code (`HANDOVER_ASSIGNEE_CHANGED`, HTTP 409) so the UI can explain it.

### 7.5 Who can complete

| Action | Target user (magic link + login) | Admin |
|--------|----------------------------------|-------|
| Accept CHECK_OUT / CHECK_IN | Yes, if `session.user.id === target_user_id` | Via *complete on behalf* only (not assignee link) |
| Cancel handover | No | Yes |
| Direct PATCH asset | No | Yes (existing API, subject to §6 block) |
| Set STOCK while return pending | No (use accept or admin complete/cancel) | Yes (must cancel/complete the handover first, per §6) |

### 7.6 Login requirement (verification tied to users)

1. User opens `{FRONTEND_URL}/handover/accept?token={opaque}`.
2. If not authenticated → redirect to login with return URL preserving the token.
3. After login → confirmation page (preview via API).
4. User clicks **Confirm** → `POST /api/me/handovers/accept` with JWT.
5. Server validates: token valid + not expired + not consumed + `request.auth.credentials.userId === handover.target_user_id`.
6. If wrong user is logged in → **403** (`HND4030`); the UI shows an **ambiguous** message (*nothing pending for you*) without revealing the link was for another account.

> **[CODEBASE FIX] Verify the frontend login flow round-trips an arbitrary `returnUrl` with
> query params.** Step 2 assumes login can return to `/handover/accept?token=…`. If the current
> auth flow does not preserve query-string return URLs, that is hidden frontend work to scope in P1.

## 8. Data model

### 8.1 Table: `handover`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `date_created` | timestamp | |
| `asset_id` | uuid FK → asset | |
| `type` | enum(`CHECK_OUT`,`CHECK_IN`) | |
| `status` | enum(`OPEN`,`CONSUMED`,`CANCELLED`,`EXPIRED`) | **[CODEBASE FIX]** explicit state; default `OPEN`. |
| `target_user_id` | uuid FK → user | Must match acceptor |
| `created_by_user_id` | uuid FK → user | Admin who started |
| `token_hash` | string | Store hash only (SHA-256 of random token). **[CODEBASE FIX]** — intentionally diverges from the existing plaintext-token tables; see [§8.5](#85-token-storage-intentional-divergence-codebase-fix). |
| `expires_at` | timestamp | Configurable TTL |
| `consumed_at` | timestamp nullable | Set on accept/complete |
| `consumed_by_user_id` | uuid nullable | Target user or admin on behalf |
| `cancelled_at` | timestamp nullable | Admin cancel |
| `cancelled_by_user_id` | uuid nullable | |

**Constraints / indexes**

- **[CODEBASE FIX] Partial unique index on `asset_id WHERE status = 'OPEN'`** — *not* a predicate
  containing `now()`. Postgres requires index predicates to be `IMMUTABLE`, and `now()` is
  `STABLE`, so `… WHERE … expires_at > now()` fails at `CREATE INDEX` time. Expiry is handled by
  the `status` column transition (see §8.4), keeping the index purely on `status`.
- Index on `token_hash` for lookup.
- Index on `asset_id`, `target_user_id`.

### 8.2 Optional: `asset.custody_verified_at`

Not required for v1. Verification can be inferred from the latest `CUSTODY_ACCEPTED` transaction.
Add later if reporting needs it.

### 8.3 Transaction actions (extend enum) **[CODEBASE FIX]**

`transaction_action` is a **Postgres `ENUM` type**, not a string column
(`backend/migrations/20260529210124_create_transactions.ts`). Adding values therefore requires a
**migration**, following the existing pattern (see `20260530155154_*`, `20260530113430_*`):

```ts
await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'HANDOVER_CREATED'`);
await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'HANDOVER_CANCELLED'`);
await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'CUSTODY_ACCEPTED'`);
await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'CUSTODY_COMPLETED_ON_BEHALF'`);
```

> **Postgres gotcha:** `ALTER TYPE … ADD VALUE` cannot be used by a statement in the *same*
> transaction that adds it. Keep the enum-add migration separate from any migration that inserts
> rows using the new values. Also mirror the values in the `ITransactionAction` TS enum
> (`backend/src/domain/_interfaces/transaction.interface.ts`). `down()` cannot remove enum values
> (Postgres limitation) — leave them, matching existing migrations.

| Action | When |
|--------|------|
| `HANDOVER_CREATED` | Handover started |
| `HANDOVER_CANCELLED` | Admin cancelled |
| `CUSTODY_ACCEPTED` | User accepted via magic link |
| `CUSTODY_COMPLETED_ON_BEHALF` | Admin completed without user link |

Existing actions still emitted where applicable: `ASSIGNED`, `UNASSIGNED`, `STATUS_CHANGED` on
asset update (same as today's `deriveUpdateEvents`).

### 8.4 "Open handover" definition **[CODEBASE FIX]**

The original draft defined open as `consumed_at IS NULL AND cancelled_at IS NULL AND expires_at > now()`
and proposed a partial unique index on that predicate. Two problems:

1. The index is illegal (`now()` is not `IMMUTABLE` — see §8.1).
2. `OPEN` and `EXPIRED` would be indistinguishable at the row level (both have null
   `consumed_at`/`cancelled_at`), so an expired-but-unconsumed row would silently keep occupying
   the unique slot and block new handovers with no clean way to release it.

**Resolution:** add an explicit `status` column (`OPEN`/`CONSUMED`/`CANCELLED`/`EXPIRED`).

- Uniqueness is enforced by a partial unique index on `asset_id WHERE status = 'OPEN'`.
- An open handover is `status = 'OPEN' AND expires_at > now()` *at read time*; lazily flip stale
  rows `OPEN → EXPIRED`:
  - On any create/accept/list for an asset, if the existing OPEN row has `expires_at <= now()`,
    transition it to `EXPIRED` first (frees the unique slot), then proceed.
  - Optionally back this with a periodic sweep (mirrors the existing `deleteExpired()` token
    pattern), but the lazy transition is sufficient for correctness.

### 8.5 Token storage: intentional divergence **[CODEBASE FIX]**

The existing `email_verification_token` and `password_reset_token` tables store the **raw token**
and look it up directly (`findByToken`). This spec deliberately stores `SHA-256(token)` instead and
never persists the raw token. Whoever implements should **not** "follow the verification.ts
pattern" for storage here. Flow:

- Generate ≥32 random bytes → URL-safe token (the only place the raw token exists is the email/link).
- Store `SHA-256(token)` in `token_hash`.
- On preview/accept, hash the incoming token and look up by `token_hash` (constant-time compare).

## 9. API specification

### 9.1 Admin routes (`JWTAdmin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/p/handovers` | List all open handovers (admin dashboard). |
| POST | `/api/p/assets/{assetId}/handovers` | Create handover + send email. Body: `{ type, targetUserId, sendEmail?: true }` |
| GET | `/api/p/assets/{assetId}/handovers` | List handovers for asset (paginated or last N). |
| GET | `/api/p/handovers/{handoverId}` | Handover detail (no raw token). |
| POST | `/api/p/handovers/{handoverId}/cancel` | Cancel open handover. |
| POST | `/api/p/handovers/{handoverId}/complete` | Complete on behalf (admin actor). |
| GET | `/api/p/handovers/{handoverId}/link` | Test/support: return magic URL (disabled in production or admin-only; E2E uses DB/token fixture). |

**Create errors (examples)**

| Code | Condition |
|------|-----------|
| 409 | Open handover already exists for asset |
| 400 | Invalid type for current asset status |
| 400 | Target user inactive / not found / email not verified |
| 409 | CHECK_IN but assignee mismatch (`HANDOVER_ASSIGNEE_CHANGED`) |

### 9.2 User routes (`JWTAdminAndUser`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me/handovers` | List open, non-expired handovers awaiting the current user's confirmation. |
| GET | `/api/me/handovers/preview?token=` | Preview: asset name, serial, type, expiry; no status change. **Auth required** (resolves the draft's "public-ish OR require auth" ambiguity). |
| POST | `/api/me/handovers/accept` | Body: `{ token }`. Consumes handover if caller is `target_user_id`. |
| POST | `/api/me/handovers/{handoverId}/accept` | Accept a pending handover by id (caller must be `target_user_id`; no magic-link token required). |

### 9.3 Unchanged

- `PATCH /api/p/assets/{id}` — direct assign / status (subject to the handover block policy, §6).
- `GET /api/me/assets`, `GET /api/me/transactions` — personal views; `/dashboard` and `/assets` also list pending handovers via `GET /api/me/handovers`.

### 9.4 Response shapes (illustrative)

**Preview (200)**

```json
{
  "handoverId": "uuid",
  "type": "CHECK_OUT",
  "expiresAt": "ISO-8601",
  "asset": { "id": "uuid", "name": "...", "serialNumber": "..." },
  "targetUser": { "id": "uuid", "displayName": "..." }
}
```

**Accept (200)**

```json
{
  "asset": { "...": "IAssetWithAssignee" },
  "handoverId": "uuid"
}
```

## 10. Email

### 10.1 Delivery

Reuse existing email service (SMTP, or console when `SMTP_HOST` empty; `MOCK_EMAIL=true` in E2E).
New templates: `handoverCheckoutEmail`, `handoverReturnEmail` (HTML + text), patterned after
`templates/verification.ts` / `templates/password-reset.ts`.

### 10.2 Link format

```
{FRONTEND_URL}/handover/accept?token={opaqueRandomToken}
```

- Token: cryptographically random (≥ 32 bytes), URL-safe.
- Store `SHA-256(token)` in DB (see §8.5).
- TTL: configurable, default **72 hours** (env `HANDOVER_TOKEN_EXPIRY_HOURS`).

### 10.3 Email content

- Greeting + assignee display name.
- Action: *"Confirm you are receiving {asset name} (S/N {serial})"* or *"Confirm return of …"*.
- Primary button + plain URL.
- Expiry notice.
- Support line: *"If you did not expect this, contact IT."*

### 10.4 Recipient

Always `target_user.email` (unique, mandatory on platform).

### 10.5 Language / locale **[CODEBASE FIX]**

Frontend i18n lives in `frontend/app/utils/translations.ts`, but emails render server-side. The
existing `templates/verification.ts` defines the precedent. **v1 decision:** render handover emails
in the **same language as the existing verification/password-reset emails** (no per-user locale in
v1). Revisit if/when the user record carries a locale.

### 10.6 Direct unassign notification (implemented)

When an asset update removes a previous assignee (`assigned_user_id` changes away from a user),
the platform emails that user so they know custody ended without a magic link.

| Trigger | Email to former assignee? |
|---------|---------------------------|
| Admin direct PATCH: ASSIGNED → STOCK (or other non-ASSIGNED status) | Yes |
| Admin direct PATCH: reassign A → B | Yes (to A) |
| Admin *complete on behalf* of CHECK_IN | Yes |
| User accepts CHECK_IN (actor is former assignee) | No (redundant) |
| Verified CHECK_OUT create (asset still STOCK) | No (no prior assignee) |

**Templates:** `templates/asset-unassigned.ts` (`assetUnassignedEmailHtml` / `assetUnassignedEmailText`).

**Delivery:** same pipeline as §10.1 (`email.service`, `MOCK_EMAIL`, SMTP). Subject: *"You have been unassigned from an asset"*.

**Content:** greeting, asset name + serial, link to `{FRONTEND_URL}/assets`, IT support line.

**Implementation:** `assets.domain.updateAsset` → `notifyFormerAssigneeIfUnassigned` after audit events; uses `before.assignedUserEmail` / `assignedUserName`; skips when `actor.id === before.assignedUserId`.

## 11. Frontend

### 11.1 Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/handover/accept` | Public entry; auth gate | Read token from query; login redirect; preview + confirm |

### 11.2 Admin UI (`/admin/assets/{id}`)

- Section **Custody / Handover**:
  - Show open handover badge (type, target user, expires).
  - Buttons: *Assign with verification* (CHECK_OUT), *Request verified return* (CHECK_IN) when applicable.
  - *Cancel handover*, *Complete on behalf*, *Copy link* (optional).
- Direct assign form unchanged; if an open handover exists, disable or warn per policy §6.

### 11.3 User UI

- `/dashboard` and `/assets` (My Assets): **Awaiting your confirmation** panel when open handovers target the current user (type, asset, serial, expiry, in-app **Confirm** button).
- `/handover/accept`: magic-link confirmation page; wrong-account access shows an ambiguous *nothing pending* screen (§7.6).
- Personal history shows new transaction types (`CUSTODY_ACCEPTED`, etc.).

### 11.4 i18n

Add keys to `frontend/app/utils/translations.ts` (EN + ES) for all new strings.

## 12. Security

| Control | Detail |
|---------|--------|
| Token secrecy | Only hash in DB; constant-time compare (§8.5) |
| One-time use | **[CODEBASE FIX]** Consume via atomic compare-and-set, not read-then-write (§16) |
| Expiry | Reject when not `OPEN` / `expires_at < now()` |
| Identity binding | Accept requires JWT + `userId === target_user_id` |
| Admin path | Separate endpoint; audit `CUSTODY_COMPLETED_ON_BEHALF` |
| HTTPS | Required in production |
| Rate limiting | Consider on accept and preview (follow existing auth rate limits if any) |
| IDOR | Preview by token only reveals non-sensitive asset fields |

## 13. Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `HANDOVER_TOKEN_EXPIRY_HOURS` | 72 | Magic link TTL |
| `FRONTEND_URL` | (existing) | Link base |
| `MOCK_EMAIL` | false | E2E: capture/log emails |
| `SMTP_*` | (existing) | Delivery |

## 14. Acceptance criteria (E2E)

Place under `e2e/tests/handovers/`. Update `docs/e2e-testing.md` coverage table.

### REQ-HANDOVER-001 — Verified checkout

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Admin starts CHECK_OUT to User A → asset stays STOCK, handover open. |
| AC-001.2 | Email/link generated; User A logs in, accepts → asset ASSIGNED, assignee A. |
| AC-001.3 | Transaction includes `CUSTODY_ACCEPTED` and `ASSIGNED` / `STATUS_CHANGED`. |

### REQ-HANDOVER-002 — Verified return

| AC | Given / When / Then |
|----|---------------------|
| AC-002.1 | Asset ASSIGNED to A; admin starts CHECK_IN → still ASSIGNED until accept. |
| AC-002.2 | A accepts → STOCK, assignee null. |

### REQ-HANDOVER-003 — Concurrency and blocking

| AC | Given / When / Then |
|----|---------------------|
| AC-003.1 | Open CHECK_OUT exists → second handover on same asset → 409. |
| AC-003.2 | Open CHECK_OUT to A → CHECK_OUT to B → 409. |
| AC-003.3 | **[CODEBASE FIX]** Open handover exists → direct `PATCH` of `status`/`assignedUserId` on that asset → 409. |

### REQ-HANDOVER-004 — Token and identity

| AC | Given / When / Then |
|----|---------------------|
| AC-004.1 | User B logged in, A's token → ambiguous UI (*nothing pending for you*); API 403 `HND4030`. |
| AC-004.2 | Expired token → 400. |
| AC-004.3 | Reused token → 400. |

### REQ-HANDOVER-005 — Admin override

| AC | Given / When / Then |
|----|---------------------|
| AC-005.1 | Admin complete on behalf → asset updated; audit shows admin (`CUSTODY_COMPLETED_ON_BEHALF`). |
| AC-005.2 | Admin cancel → asset unchanged; handover not consumable. |
| AC-005.3 | Direct assign without handover → still works (REQ-ASSET-001 regression). |

### REQ-HANDOVER-006 — Personal pending list (implemented with 001)

| AC | Given / When / Then |
|----|---------------------|
| AC-006.1 | User with open handover → panel on `/dashboard` and `/assets`. |
| AC-006.2 | Confirm from panel → same outcome as magic-link accept. |

### Updates to existing tests

| File | Change |
|------|--------|
| `req-asset-001.spec.ts` | Note direct assign path; add case: direct assign blocked when open handover exists (policy A). |
| `docs/e2e-testing.md` | Add `handovers/` row to coverage table. |

**E2E token access:** Do not depend on real SMTP. In tests, create handovers with
`sendEmail: false` and use the `acceptUrl` returned in the API response (or read the token from
that URL). `MOCK_EMAIL=true` is still used for flows that send email.

## 15. Implementation phases (suggested)

| Phase | Scope |
|-------|-------|
| P1 | Migration `handover` + `transaction_action` ALTER; domain rules; admin create/cancel/complete; email templates; accept API + `/handover/accept` page |
| P2 | Admin asset UI; transaction actions wired into history; README/API docs |
| P3 | E2E REQ-HANDOVER-001..006; update `e2e-testing.md` |
| P4 (optional) | Reports ("verified vs unverified assignments") |

## 16. Backend layering (conventions)

Follow `backend/docs/backend-layering.md`:

- `handover.domain.ts` — rules, asset updates, transaction emission.
- `handover.repository.ts` + `handoverDb.repository.ts`.
- Routes under `infrastructure/routes/admin/handovers/` and `.../me/handovers/`.
- Register routes in `routes.ts`.

**Asset updates go through existing `assets.domain` helpers** so `resolveAssignment` and
`deriveUpdateEvents` stay consistent.

**[CODEBASE FIX] Two layering points to settle in P1:**

1. **Atomic one-time consume.** `consumed_at` (and `cancelled_at`) must be set with a conditional
   update so concurrent accepts cannot both win:
   `UPDATE handover SET status='CONSUMED', consumed_at=now(), consumed_by_user_id=? WHERE id=? AND status='OPEN' RETURNING *`.
   Only apply the asset mutation if a row is returned. Same compare-and-set guard for cancel and
   complete-on-behalf.
2. **Actor identity on the user-accept path.** `assets.domain.updateAsset(actor, …)` takes a
   `Requester {id, role}` and is reached today only via `JWTAdmin`. For a user accept, the asset
   mutation flows through the domain (not the admin route), so it bypasses the route guard cleanly —
   call `updateAsset` with the **target user** as `actor` so the resulting `ASSIGNED`/`UNASSIGNED`
   audit row (and the assignee's My History) attributes the change to the user. For complete-on-
   behalf, pass the **admin** as actor and additionally emit `CUSTODY_COMPLETED_ON_BEHALF`.

## 17. Open decisions (resolved)

| # | Question | Decision |
|---|----------|----------|
| D1 | Block direct assign when open handover? | **Yes (block)** — applies to both CHECK_OUT and CHECK_IN; gates only `status`/`assignedUserId`. |
| D2 | Handover TTL default | **72 h** (`HANDOVER_TOKEN_EXPIRY_HOURS`) |
| D3 | Allow CHECK_OUT while MAINTENANCE? | **No** in v1 |
| D4 | Test-only "get link" endpoint in E2E | **Yes**, guarded; or DB fixture in test setup |
| D5 | Show "unverified" on direct assign in UI | **Should**, not blocking |
| D6 | Open/expired representation **[NEW]** | Explicit `status` column + lazy `OPEN→EXPIRED` (§8.4) |
| D7 | Preview auth **[NEW]** | **Require auth** (§9.2) |
| D8 | Email locale **[NEW]** | Match existing verification email language; no per-user locale in v1 (§10.5) |

## 18. Documentation updates (post-implementation)

- Root `README.md` — new subsection under **Asset Management**.
- `backend/README.md` — route list (new handover endpoints).
- `docs/e2e-testing.md` — handover folder in coverage table.
- `docs/spec-index.md` — central registry of all feature specifications.
- `docs/spec-custody-receipt.md` — printable custody PDF + signed upload.
- Swagger via `*.doc.ts` per `backend/docs/api-documentation.md`.

## 19. Reference: current system touchpoints

| Area | Location / note |
|------|-----------------|
| Asset lifecycle | `backend/src/domain/assets/assets.domain.ts` — `resolveAssignment`, `deriveUpdateEvents`, `updateAsset` |
| Status enum | `IAssetStatus` in `backend/src/domain/_interfaces/asset.interface.ts` |
| Transactions | `transaction_action` **Postgres enum**; `ITransactionAction` TS enum in `transaction.interface.ts` |
| Email pattern | `templates/verification.ts`, `templates/password-reset.ts`, `templates/handover.ts`, `templates/asset-unassigned.ts`; `email.service.ts` / `IEmailOptions` |
| Unassign email | `assets.domain.ts` — `notifyFormerAssigneeIfUnassigned` on direct custody removal |
| Token tables (raw-token precedent) | `email_verification_token`, `password_reset_token` (note: store raw; this feature stores a hash — §8.5) |
| Personal API | `/api/me/*` with `JWTAdminAndUser` |
| E2E mail | `MOCK_EMAIL=true` in Playwright `webServer` env |

## 20. Changes from original draft (codebase validation)

| # | Original | Corrected | Why |
|---|----------|-----------|-----|
| 1 | Partial unique index `… WHERE … expires_at > now()` | Index on `asset_id WHERE status='OPEN'` | `now()` is not `IMMUTABLE`; Postgres rejects the index predicate (§8.1). |
| 2 | EXPIRED/OPEN derived from timestamps only | Explicit `status` column + lazy expiry | Expired-unconsumed rows would silently block new handovers with no release path (§8.4). |
| 3 | "extend `transaction_action` enum" (implied TS only) | Requires `ALTER TYPE … ADD VALUE` migration | `transaction_action` is a Postgres enum, not a string column (§8.3). |
| 4 | "Set `consumed_at` in transaction" | Atomic compare-and-set consume | Read-then-write allows double-accept races (§16). |
| 5 | "follow verification.ts pattern" for token | Store `SHA-256(token)`, intentional divergence | Existing token tables store raw tokens; flag so implementer doesn't copy that (§8.5). |
| 6 | Block policy named only CHECK_OUT | Block applies to any open handover (both types) | An open CHECK_IN must also gate direct status PATCH (§6, AC-003.3). |
| 7 | Preview auth "public-ish OR require auth" | Require auth | Removes IDOR ambiguity; flow already logs in first (§9.2, D7). |
| 8 | Email language unspecified | Match existing verification email language | Emails render server-side; frontend i18n doesn't apply (§10.5, D8). |
| 9 | — | (n/a) | Reserved. |
| 10 | Login `returnUrl` assumed | Flagged: verify frontend preserves token query param | May be hidden P1 work (§7.6). |

---

*End of specification.*
