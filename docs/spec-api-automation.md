# Feature specification: API automation (machine access)

- **Document ID:** SPEC-API-001
- **Status:** Implemented (MVP); P2/P3 phased
- **Last updated:** 2026-06-01
- **Related requirements (E2E):** REQ-API-001 (`e2e/tests/api-automation/req-api-001.spec.ts`, 13 cases — AC-001.1…13 + US-API5)
- **Depends on:** [spec-platform-access-model.md](spec-platform-access-model.md), [spec-import-export.md](spec-import-export.md) (shared admin auth on job routes)

> **MVP shipped.** The MVP scope in §15 is implemented and covered by the E2E suite in §14. P2 (scoped keys, grace-window rotation, all-`POST` idempotency, optional custom admin roles) and P3 (rate limits, `/api/v1`, IP allowlist) remain planned.

---

## 1. Summary

Enable **third-party integrations and scripts** to manage ninjasset **without a browser** or session login flow. Admins create **long-lived API keys** sent as `Authorization: Bearer nsk_live_<secret>`. Keys authenticate the same **admin** routes as today’s `/api/p/*` via a new Hapi strategy composite — **`JWTAdminOrApiKey`**.

- **Browser UI** continues to use session JWT from `/api/session/login` (unchanged).
- **`/api/me/*`** remains JWT-only — no API keys for regular users.
- **MVP:** full-admin keys with create/revoke, regenerate, optional expiry, last-used tracking, full API access log, write idempotency, and a **single permission-enforcement seam** that is a no-op for full admin today but ready to filter scoped keys (and, later, custom admin roles) without re-touching routes.
- **P2:** turn the seam on — scoped keys carrying a subset of their owner's permissions, from one shared permission catalog.
- **P3:** rate limits / runaway-key controls; optional `/api/v1` alias if breaking changes required.

> **Authorization principle.** ninjasset uses **one permission catalog** for two principal types — human roles and API keys (§7.5). A key never exceeds its owner's permissions. This avoids the trap of building a second, key-only permission system parallel to the (today coarse) admin role. See D-API-11 and §20 item 9.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Automate ITAM operations (assets, sites, users, import jobs) from CI or external systems. |
| G2 | Avoid sharing human passwords or scraping login flows. |
| G3 | Revoke compromise immediately; audit which key performed each call. |
| G4 | Keep JWT and API key auth paths separate and explicit in documentation. |
| G5 | Document admin APIs in existing Swagger (`/docs`) with a second security scheme. |
| G6 | Align credentials shape with existing JWT `credentials` for minimal handler churn. |

## 3. Non-goals

| Item | Notes |
|------|-------|
| API keys for `USER` role | Admin automation only |
| `/api/me/*` with API keys | Personal workspace stays session-based |
| OAuth2 / OIDC client credentials | Future; keys are v1 standard |
| SAML / SSO for machines | Enterprise UI SSO is separate |
| SCIM user provisioning | Future |
| GraphQL / gRPC | Explicitly out |
| Multi-tenant / org workspaces | Single deployment |
| Rate limiting | v1 none; P3 |
| Outbound webhooks | v1 none — see §18 README stub for SPEC-WEBHOOK-001 |
| IP allowlist per key | Future hardening |
| Mixing JWT + API key on one request | Forbidden — exactly one scheme |
| Custom admin roles (e.g. read-only auditor) | **Not built here** — but the §7.5 permission catalog is deliberately shaped so they slot in later via the *same* machinery as scoped keys, never a second system |
| Row-level / per-site ABAC | Out — capabilities are area-level, not per-entity (matches SPEC-PLATFORM-001) |

## 4. Glossary

| Term | Definition |
|------|------------|
| API key | Opaque secret prefixed `nsk_live_` (or `nsk_test_` in non-prod) |
| Key prefix | Public portion stored in DB (e.g. first 8 chars after prefix) for identification in UI |
| Secret | Full bearer token shown **once** at creation |
| Actor | Admin user who owns the key; used for audit and transaction log |
| Access log | Append-only record of API requests (method, path, status, key id) |
| Full-admin key | Key holding `["*"]` — all capabilities (MVP default) |
| Scoped key | Key holding a subset of capabilities (P2) |
| Capability | `area:action` permission string (e.g. `assets:write`) from the single catalog (§7.5.1) |
| Effective permissions | What a request may actually do: principal perms ∩ key grant (§7.5.2) |
| Permission seam | The one `requireCapability` checkpoint each `/api/p/*` route passes through (§7.5.3) |
| Regenerate | Mint a new secret for an existing key without losing its id/name/owner/capabilities (§7.4a) |
| Idempotency key | Client-supplied `Idempotency-Key` header letting a retried `POST` replay its first result (§9.5) |

## 5. Personas and user stories

### 5.1 Admin (human)

| ID | Story | Priority | Phase |
|----|-------|----------|-------|
| US-API1 | Create a named API key and copy the secret once. | Must | MVP |
| US-API2 | List **all** deployment keys with name, owner, prefix, expiry, last used, created date. | Must | MVP |
| US-API3 | Revoke any key immediately (including another admin's). | Must | MVP |
| US-API4 | Set optional expiry on create. | Must | MVP |
| US-API5 | Manage keys from a dedicated admin settings page. | Must | MVP |
| US-API6 | Review the API access log (which key did what). | Should | MVP |
| US-API7 | Create scoped read-only or write-limited keys. | Should | P2 |

### 5.2 Integration (machine)

| ID | Story | Priority | Phase |
|----|-------|----------|-------|
| US-API8 | Call `GET /api/p/assets` with Bearer key — receive same payload as JWT. | Must | MVP |
| US-API9 | Run import/export jobs via API without UI. | Must | MVP |
| US-API10 | Receive 401 when key revoked or expired. | Must | MVP |

### 5.3 Regular user

No stories — cannot obtain API keys.

## 6. Auth strategy matrix

### 6.1 Current (implemented)

| Strategy | Used by |
|----------|---------|
| `JWTAdmin` | `/api/p/*` today |
| `JWTUser` | Rare |
| `JWTAdminAndUser` | `/api/me/*`, session profile |

### 6.2 Planned

```
Request to /api/p/*
  │
  ├─ Authorization: Bearer nsk_live_...   (starts with key prefix)
  │     └─► ApiKeyAdmin.validate ──► credentials (admin user + key metadata)
  │
  └─ Authorization: Bearer <anything else> (JWT)
        └─► JWTAdmin.validate ──► credentials (admin session)

Route auth: { strategies: ['JWTAdminOrApiKey'] }   (mirrors today's ['JWTAdmin'])
  └─► inspect bearer prefix ──► ApiKeyAdmin if nsk_*, else JWTAdmin ──► 401
```

**Dispatch by prefix (not blind fallback).** The composite scheme inspects the bearer token: if it starts with the configured key prefix (`nsk_`), it runs **only** `ApiKeyAdmin`; otherwise **only** `JWTAdmin`. This avoids a guaranteed-to-fail JWT verification (and its DB session lookup) on every key-authenticated call, and yields a precise 401 from the relevant path. The existing `JWTAdminAndUser` scheme uses an unconditional try/fallback (admin token then user token); this scheme is intentionally prefix-routed because the two credential formats are unambiguous.

| Strategy | Validates | Credentials |
|----------|-----------|-------------|
| `ApiKeyAdmin` | Parse prefix from bearer → lookup `api_key` by `prefix` (unique index) → `timingSafeEqual(SHA-256(secret), secret_hash)`; not revoked; not expired; owner is ACTIVE ADMIN | Same shape as JWT admin + `apiKeyId`, `authMethod: 'api_key'` |
| `JWTAdminOrApiKey` | JWT admin **or** API key (prefix-routed) | Unified handler view |

**Registration:** extend [`backend/src/infrastructure/strategies/strategies.ts`](../../backend/src/infrastructure/strategies/strategies.ts):
- New `ApiKeyAdmin.schema.ts` — a custom scheme (not the built-in `jwt` scheme) backed by `apiKeys.domain.ts`.
- New `JWTAdminOrApiKey.schema.ts` composite scheme mirroring `JWTAdminAndUser.schema.ts`, plus a `server.auth.scheme(...)` + `server.auth.strategy(...)` pair.

> **Lookup, not hash-scan.** The bearer secret embeds its own `prefix` (e.g. `nsk_live_7f3c9e2a…`), so validation reads the row by the indexed `prefix` and then constant-time-compares the full hash. There is no `WHERE secret_hash = ?` table scan and no plaintext at rest. (§6.2 supersedes the looser "SHA-256(secret) lookup" wording elsewhere.)

### 6.3 Bearer format and dispatch

An API key is sent **exactly like the JWT** — in the standard `Authorization: Bearer <token>` header with the `Bearer` scheme. There is **no custom header** (`X-API-Key`) and no query-string token. The only thing that differs is the token's *shape*, and the server uses that shape to pick a validator. From the client's side it's an ordinary bearer token.

```http
# Browser / human (today, unchanged) — JWT
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ij...

# Script / integration (new) — API key
Authorization: Bearer nsk_live_7f3c9e2a1b4d8f0e6c5a2b9d1e4f7a3c
```

```bash
curl https://your-host/api/p/assets \
  -H "Authorization: Bearer nsk_live_7f3c9e2a1b4d8f0e6c5a2b9d1e4f7a3c"
```

**Server-side dispatch** (the `JWTAdminOrApiKey` composite, §6.2) — one validator per request, chosen by prefix:

```
Authorization: Bearer <token>
        │
        ├─ token starts with "nsk_"  → ApiKeyAdmin only
        │      parse embedded prefix → look up api_key row by prefix (unique index)
        │      → timingSafeEqual(SHA-256(token), secret_hash)
        │      → not revoked / not expired / owner ACTIVE ADMIN
        │      → credentials { id, email, role, capabilities, apiKeyId, authMethod:'api_key' }
        │
        └─ else (looks like a JWT)    → JWTAdmin only (existing validateJWT)
               → credentials { id, email, role }
```

A JWT (`eyJ…`, base64 of `{"alg":…}`) and an API key (`nsk_…`) are unambiguous by their first characters, so the scheme routes deterministically rather than blind try/fallback. This avoids a guaranteed-to-fail JWT verification (with its DB session lookup) on every key call and yields a precise 401 from the relevant path. Both paths converge on the **same `request.auth.credentials` shape**, so handlers never branch on auth method (goal G6) — this is the whole reason for reusing `Bearer` rather than a bespoke header.

- Prefix `nsk_live_` for production keys; `nsk_test_` for dev/test deployments (label only — both validate identically; §13).
- The key's stored `prefix` (the indexed lookup id) is embedded **inside** the secret, so validation is a single indexed row read + constant-time hash compare — never a `secret_hash` table scan.
- `urlKey: false` — same as JWT (no `?token=` query-string tokens).

### 6.4 Session vs key (resolved)

| Client | Auth mechanism |
|--------|----------------|
| Remix browser app | JWT from login → `localStorage.auth_token` |
| Scripts / integrations | API key only on `/api/p/*` |
| Login endpoint | **Not** used for automation |

Handlers read `request.auth.credentials` identically; optional `credentials.apiKeyId` set only for key auth (for access log).

## 7. State and business rules

### 7.1 Key lifecycle

| State | Can authenticate? |
|-------|-------------------|
| Active (not revoked, not expired) | Yes |
| Revoked (`revoked_at` set) | No — 401 |
| Expired (`expires_at` < now) | No — 401 |
| Owner user not ACTIVE | No — 401 |
| Owner not ADMIN | No — keys cannot be created |

### 7.2 Key creation

1. Admin calls `POST /api/p/api-keys` with `name`, optional `expiresAt`, optional `capabilities[]` (P2; MVP ignores capabilities or accepts empty = full admin).
2. Server generates cryptographically random secret (≥ 32 bytes entropy after prefix).
3. Store `secret_hash = SHA-256(full_secret)`; store `prefix` for display (e.g. `nsk_live_7f3c9e2a`).
4. Return `{ id, name, prefix, secret, expiresAt }` — **`secret` only in this response**.

### 7.3 Revocation

- `DELETE /api/p/api-keys/{id}` sets `revoked_at = now()`.
- Immediate — no grace period on revoke. For seamless rotation, use **regenerate** (§7.4a) instead of revoke-then-create.

### 7.4a Regeneration (rotation)

`POST /api/p/api-keys/{id}/regenerate` mints a **new secret** for the **same key identity** (id, name, owner, capabilities, expiry preserved) and returns it once, exactly like create. Because keys can be long-lived with no expiry (D-API-10), rotation hygiene matters and "create new + manually re-label + revoke old" loses metadata and history.

| Mode | Behaviour |
|------|-----------|
| Immediate (default) | Old secret hash replaced at once; old secret 401s on next call. |
| Grace (optional, `graceHours`) | Old secret keeps working until `previous_secret_expires_at`; both validate during the window. P2 — MVP is immediate-only. |

Grace rotation needs a `previous_secret_hash` + `previous_secret_expires_at` pair on the row (P2 columns); MVP regenerate simply overwrites `secret_hash` and `prefix`.

### 7.4 Last used

- On successful `ApiKeyAdmin` validation, update `last_used_at` (throttle: at most once per 60s per key to reduce write load).

### 7.5 Permission model (one catalog, two principals)

This is the architectural heart of the spec. Rather than inventing a key-only scope system parallel to the (today coarse) admin role, ninjasset defines **one permission catalog** that both **human roles** and **API keys** draw from. A key can only ever hold a **subset of its owner's** permissions.

#### 7.5.1 Permission catalog

Capabilities are `area:action` strings. `*` is the wildcard granting everything.

| Capability | Grants |
|------------|--------|
| `assets:read` / `assets:write` | GET vs POST/PATCH/DELETE asset (and image/QR) routes |
| `sites:read` / `sites:write` | Site routes |
| `catalog:read` / `catalog:write` | Manufacturers + vendors |
| `users:read` / `users:write` | User list/detail vs create/update/delete |
| `handovers:read` / `handovers:write` | Admin handover routes |
| `transactions:read` | Transaction/audit history |
| `stats:read` / `alerts:read` / `reports:read` | Dashboards, alerts, data-quality reports |
| `import_export:run` | Import/export job routes (SPEC-IMPORT-001) |
| `api_keys:manage` | Create/revoke/regenerate keys — **JWT only**, never grantable to a key (§9 header) |
| `*` | Full admin — every capability above |

Legacy role-scope tables (`scope`, `role_scope`) were removed; this catalog is the sole permission vocabulary for API keys and route enforcement.

#### 7.5.2 Principals and effective permissions

| Principal | Permissions held |
|-----------|------------------|
| `ADMIN` role | `["*"]` |
| `USER` role | `[]` for `/api/p/*` (personal `/api/me/*` is separate) |
| API key (MVP) | `["*"]` by default — created full-admin |
| API key (P2) | Any subset, e.g. `["assets:read","sites:read"]` |
| Future custom admin role | Any subset (same catalog) — door left open, not built here |

**Effective permissions on a request** = principal permissions **∩** key grant (when key-authenticated), with `*` absorbing everything:

```
JWT admin            → ["*"]                        (role)
Key, MVP full-admin  → ["*"] ∩ ["*"]   = ["*"]
Key, P2 scoped       → ["*"] ∩ ["assets:read"] = ["assets:read"]
```

A key can never widen access: if a future custom role lacks `users:write`, a key it owns cannot gain it, regardless of the key's stored grant.

#### 7.5.3 The enforcement seam (built in MVP, no-op in MVP)

Each `/api/p/*` route declares the capability it requires (route `options.app.capability`, or a tag→capability table). A **single** `requireCapability` hook in `apiHooks.ts` checks `effectivePermissions` against it.

- **MVP:** every principal resolves to `["*"]` (ADMIN role, full-admin keys), so every check passes. The seam is wired and exercised but **permissive** — zero behaviour change, full test coverage of the path.
- **P2:** creating a scoped key is the **only** change needed to start enforcing — no route edits. Adding a custom admin role later is likewise data, not code.

This is the payoff: the ~14-file route switch to `JWTAdminOrApiKey` (§9.2) happens **once**, in MVP, and already carries the capability tag. P2 does not re-touch routes.

For API-key auth, the effective grant is on `credentials.capabilities` (see §8.3). JWT admin auth relies on `role === 'ADMIN'` → `*` inside `effectivePermissions`.

### 7.6 Permissions

All **ADMIN** users may create and revoke keys (no `MANAGE_API_KEYS` scope in v1). Keys record their creating user as **owner** (for audit and the transaction log), but management is **deployment-wide**: any admin can list, inspect, and revoke **any** key, including keys owned by another admin. This is deliberate for a small single-deployment team — it closes the revocation gap where an offboarded admin's keys would otherwise become invisible and un-revokable. The list surfaces the owner so accountability is preserved (D-API-7).

### 7.7 User-management capability

User CRUD requires `users:write` (`users:read` for list/detail) via the §7.5.3 seam — the same checkpoint as every other area, not a special case.

- **MVP:** full-admin JWT and full-admin keys both hold `["*"]`, so the check passes.
- **P2:** a scoped key without `users:write` gets 403 on `POST /api/p/users`. Because effective = owner ∩ key, a key cannot acquire `users:write` its owner lacks.

## 8. Data model

### 8.1 Table `api_key`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → user | Owner (must be ADMIN) |
| `name` | text | Human label, e.g. “Netbox sync” |
| `prefix` | text | Display id, indexed |
| `secret_hash` | text | SHA-256 hex of full bearer secret |
| `capabilities` | jsonb | String array; `["*"]` or empty = full admin in MVP |
| `expires_at` | timestamptz nullable | |
| `revoked_at` | timestamptz nullable | |
| `last_used_at` | timestamptz nullable | |
| `created_at` | timestamptz | |

Index: `(prefix)` unique (validation lookup); `(revoked_at, created_at)` for the deployment-wide list (active keys first, newest first). `user_id` FK retained for owner display/audit, not as a list filter.

### 8.2 Table `api_access_log`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `api_key_id` | uuid FK nullable | Null if JWT (optional JWT logging later) |
| `user_id` | uuid FK | Actor |
| `method` | text | GET, POST, … |
| `path` | text | `/api/p/assets` |
| `status_code` | int | Response status |
| `duration_ms` | int nullable | |
| `ip` | text nullable | From `x-forwarded-for` or socket |
| `created_at` | timestamptz | |

Retention: configurable purge (e.g. 90 days). MVP may log mutations only if volume is a concern — **decision: log all `/api/p/*` calls when `apiKeyId` present**; JWT logging optional P2.

For the runaway-key view (§12), query this table aggregated by `api_key_id` over a window — no extra table needed.

### 8.2a Table `idempotency_record` (or Redis key)

Backs §9.5. If Redis is available ([spec-import-export.md](spec-import-export.md) D-IMPORT-2) prefer a TTL'd key; otherwise a table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `principal_id` | text | `api_key_id` or `user_id` — idempotency is per-caller |
| `idempotency_key` | text | Client-supplied |
| `request_fingerprint` | text | Hash of method+path+body; mismatch on same key → 409 |
| `response_status` | int | Stored first response |
| `response_body` | jsonb | Stored first response |
| `created_at` | timestamptz | TTL via `API_IDEMPOTENCY_TTL_HOURS` purge |

Index: `(principal_id, idempotency_key)` unique.

### 8.3 Credentials extension

```typescript
// Returned by ApiKeyAdmin and JWTAdmin (shared fields).
// Matches today's JWTAdmin credentials ({ id, email, role }) plus API-key fields:
// plus two additive fields, so existing handlers read it unchanged.
{
  id: string;           // user id (actor / key owner)
  email: string;
  role: string;         // 'ADMIN' (matches adminSessionDomain.validateJWT shape)
  capabilities: string[];  // EFFECTIVE permissions (§7.5): principal ∩ key grant. ["*"] in MVP. API key only.
  apiKeyId?: string;    // present only for API key auth (drives access log)
  authMethod: 'jwt' | 'api_key';
}
```

Source of truth for the JWT side is `adminSessionDomain.validateJWT` in [`backend/src/domain/session/admin/session.domain.ts`](../../backend/src/domain/session/admin/session.domain.ts); `ApiKeyAdmin` resolves owner from `user` + `role` and sets `capabilities`, `apiKeyId`, and `authMethod: 'api_key'`.

## 9. API specification

Auth on key management routes: **`JWTAdmin` only** (keys are not managed via themselves).

### 9.1 API key management

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/p/api-keys` | Create key; returns secret once |
| GET | `/api/p/api-keys` | List **all** deployment keys (no secrets); includes owner email |
| GET | `/api/p/api-keys/{id}` | Detail (any key) |
| POST | `/api/p/api-keys/{id}/regenerate` | Rotate: new secret, same identity; returns secret once (§7.4a) |
| DELETE | `/api/p/api-keys/{id}` | Revoke (any key) |

Required capability for all of the above: `api_keys:manage` (JWT only — never satisfiable by a key).

### 9.2 Existing admin routes (auth change only)

All routes under `backend/src/infrastructure/routes/admin/**` switch from `auth: { strategies: ['JWTAdmin'] }` to `auth: { strategies: ['JWTAdminOrApiKey'] }`. This is a mechanical, bounded change — ~14 route files today (verify with `grep -rl "'JWTAdmin'" backend/src/infrastructure/routes/admin`). The `api-keys` management routes are the **exception**: they keep `['JWTAdmin']` (a key cannot mint or revoke keys — see §9 header and D-API-3).

| Area | Example paths |
|------|----------------|
| Assets | `/api/p/assets`, images, QR |
| Sites | `/api/p/sites` |
| Catalog | `/api/p/manufacturers`, `/api/p/vendors` |
| Users | `/api/p/users` |
| Stats / alerts / reports | `/api/p/stats`, alerts, reports |
| Handovers | `/api/p/handovers` |
| Transactions | `/api/p/transactions` |
| Import/export | `/api/p/import-jobs`, `/api/p/export-jobs` (SPEC-IMPORT-001) |

**Excluded from API keys:**

| Path | Auth |
|------|------|
| `/api/session/*` | Public or JWTAdminAndUser |
| `/api/me/*` | JWTAdminAndUser only |
| `/api/health/*` | Public |
| `/api/p/api-keys` (management) | JWTAdmin only |

### 9.3 Access log (admin UI optional MVP)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/p/api-access-logs` | Paginated; filter by `apiKeyId`, date range |

### 9.4 Error responses

| HTTP | When |
|------|------|
| 401 | Missing Bearer, invalid secret, revoked, expired |
| 403 | Authenticated but lacking the route's required capability (§7.5.3) |
| 409 | `Idempotency-Key` reused with a **different** request body (§9.5) |

Use existing Boom + response code pattern (`*.responses.ts`).

### 9.5 Write idempotency

Integrations retry. A retried `POST` must not double-create. Two layers:

1. **Natural keys already protect some routes.** `POST /api/p/assets` is guarded by `serial_number` uniqueness — a blind retry returns the existing-conflict error, not a duplicate. The real exposure is routes **without** a natural unique key: import/export job creation, handover creation, sites (name is fuzzy-matched, not unique), catalog rows.
2. **`Idempotency-Key` header (opt-in).** For any `POST`, a client may send `Idempotency-Key: <uuid>`. The server records `(api_key_id_or_user_id, idempotency_key, request_fingerprint) → first response` for a TTL (e.g. 24h). A repeat with the same key + same body **replays the stored response**; same key + different body → **409**.

| Phase | Scope |
|-------|-------|
| **MVP** | Header honoured on the highest-risk creates (import-job, handover, site, catalog). Small `idempotency_record` table or reuse Redis ([spec-import-export.md](spec-import-export.md) D-IMPORT-2). |
| **P2** | All `POST` routes uniformly. |

Idempotency is **not** required (header absent = today's behaviour), so the UI is unaffected.

### 9.6 API stability / compatibility

Machine consumers need a contract the browser UI does not. Policy:

- `/api/p/*` is the **stable surface**. Backwards-compatible changes (new optional fields, new routes, new enum values consumers must tolerate) ship without notice.
- **Breaking** changes (removed/renamed fields, changed types, stricter validation) require the `/api/v1` alias (P3, D-API-2) and a deprecation window announced in `backend/README.md` + Swagger.
- Responses are documented in Swagger (`/docs`); the `apiKey` security scheme (§5) marks key-eligible routes so integrators see exactly what a key can call.

## 10. Email

| Event | Policy |
|-------|--------|
| Key created | Optional notify owner (non-goal MVP) |
| Key revoked | Optional notify owner (non-goal MVP) |

No email required for MVP.

## 11. Frontend

**Dedicated settings page** — not embedded in the import/export hub, so API automation does not depend on SPEC-IMPORT-001 shipping.

| Route | Purpose |
|-------|---------|
| `/admin/api-keys` | **API keys** list + create modal (primary) |
| `/admin/api-keys` (Access log tab/section) | Paginated access log view (§9.3) |

Admin gate: `roleName === 'ADMIN'` per-route check (per [spec-platform-access-model.md](spec-platform-access-model.md) §11). Nav entry: `adminOnly: true` in [`frontend/app/components/NavItems.ts`](../../frontend/app/components/NavItems.ts).

Create flow:

1. Enter name + optional expiry.
2. Submit → modal shows secret with copy button + warning “shown once”; no way to retrieve it again.
3. Table (all deployment keys): name, **owner**, prefix, created, expires, last used, revoke button.

i18n: EN/ES in [`frontend/app/translations.ts`](../../frontend/app/translations.ts).

## 12. Security

| Control | Detail |
|---------|--------|
| Hash at rest | SHA-256(secret); never store plaintext (precedent: handover token hashing, SPEC-HANDOVER-001 §8.5) |
| Constant-time compare | Use `timingSafeEqual` on hash compare |
| Entropy | ≥ 256-bit secret material |
| Revocation | Immediate |
| Leak response | 401 generic “Invalid credentials” |
| CORS | Same as existing API |
| Swagger | Document `bearer` JWT vs `apiKey` schemes; do not expose example live secrets |
| Brute force | No special limit v1; rely on secret length |
| Secret checksum | Optional: embed a short checksum in the secret (GitHub-style) so malformed tokens are rejected before any DB lookup and secret-scanners can detect leaks. Nice-to-have, not MVP-blocking. |
| Runaway-key visibility | Even without rate limiting (P3), the access log (§8.2) powers a per-key call-volume view so an admin can spot and revoke a misbehaving key. The key list shows `last_used_at`; the access-log view aggregates count/window per `apiKeyId`. |
| Transaction audit | Mutations record `user_id` = key owner; metadata may include `apiKeyId` in transaction payload (optional JSON field) |

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `API_KEY_PREFIX` | Bearer prefix for issued keys. **One prefix per deployment**: `nsk_live_` in prod, `nsk_test_` in dev/test. The prefix is a label only — both validate identically; it exists so a leaked secret is recognizably prod-vs-nonprod and scanners can target it. There is **no** separate "test mode" data path. |
| `API_KEY_DEFAULT_TTL_DAYS` | Optional default expiry (0 = no expiry) |
| `API_ACCESS_LOG_RETENTION_DAYS` | Purge job |
| `API_KEY_LAST_USED_THROTTLE_SEC` | 60 |
| `API_IDEMPOTENCY_TTL_HOURS` | How long a stored `Idempotency-Key` result is replayable (default 24) |

## 14. Acceptance criteria (E2E)

Implemented: `e2e/tests/api-automation/req-api-001.spec.ts` (13 cases, all passing).

### REQ-API-001 — API keys (MVP)

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Admin creates API key → response includes `secret` once; DB has hash only. |
| AC-001.2 | `GET /api/p/assets` with `Authorization: Bearer <secret>` → 200 + asset list. |
| AC-001.3 | Same request after revoke → 401. |
| AC-001.4 | USER attempts `POST /api/p/api-keys` → HTTP ≥ 400. |
| AC-001.5 | `GET /api/me/assets` with API key → 401 (me routes reject key). |
| AC-001.6 | `GET /api/p/api-keys` with USER JWT → HTTP ≥ 400. |
| AC-001.7 | Expired key → 401. |
| AC-001.8 | Access log row created for key-authenticated `GET /api/p/assets` (method, path, status, `apiKeyId`, owner `userId`). |
| AC-001.9 | Admin B sees Admin A's key in `GET /api/p/api-keys` (with owner email) and can revoke it → subsequent calls with that key 401. |
| AC-001.10 | `GET /api/p/api-keys` with a valid `nsk_*` key (not JWT) → 401 (management routes are JWTAdmin-only). |
| AC-001.11 | Regenerate a key → new secret returned once; old secret 401s; key id/name/owner unchanged; `GET /api/p/assets` with new secret → 200. |
| AC-001.12 | `POST` twice with same `Idempotency-Key` + same body on an idempotent route → one entity created; second call replays first response. Same key + different body → 409. |
| AC-001.13 | Full-admin key (`["*"]`) passes the capability seam on every `/api/p/*` area (no 403 anywhere in MVP). |

### REQ-API-002 — Permission seam + scoped keys (P2)

| AC | Given / When / Then |
|----|---------------------|
| AC-002.1 | Key with `assets:read` only → GET assets 200; DELETE asset 403 (capability seam). |
| AC-002.2 | Key with `["*"]` but owner role downgraded to lack `users:write` → `POST /api/p/users` 403 (effective = owner ∩ key; key cannot widen). |
| AC-002.3 | Key with `import_export:run` but no `assets:write` → run export 200; `POST /api/p/assets` 403. |

## 15. Implementation phases

| Phase | Scope | Status |
|-------|-------|--------|
| **MVP** | `api_key` table, `ApiKeyAdmin`, `JWTAdminOrApiKey` on `/api/p/*`, **capability seam wired (no-op for full admin)**, regenerate, key CRUD + access-log UI, idempotency on `Idempotency-Key` POSTs | **Implemented** |
| **P2** | Turn the seam on: scoped keys (subset of owner perms); capability tags exercised; idempotency on all `POST`; grace-window rotation; optional JWT access logging; optional custom admin roles (same catalog) | Planned |
| **P3** | Rate limits / runaway-key throttle; `/api/v1` alias; IP allowlist; secret checksum; webhook spec | Planned |

**Recommended order:** MVP before [spec-import-export.md](spec-import-export.md) MVP (integration testing).

## 16. Backend layering

| Layer | Responsibility |
|-------|----------------|
| `domain/apiKeys/apiKeys.domain.ts` | Create, revoke, regenerate, validate hash, list, effective-permission resolution |
| `infrastructure/repositories/apiKeyDb/` | Persistence |
| `infrastructure/strategies/schemas/ApiKeyAdmin.schema.ts` | Hapi validate (prefix lookup + `timingSafeEqual`) |
| `infrastructure/strategies/schemas/JWTAdminOrApiKey.schema.ts` | Composite (prefix-routed) |
| `infrastructure/roles/` | **Permission catalog** (`capabilities.ts`) + `requireCapability` in `roles.service.ts` |
| `infrastructure/routes/admin/apiKeys/` | Key CRUD + regenerate routes |
| `infrastructure/hooks/apiAccessLog.hook.ts` | onPreResponse or onPostAuth logging |
| `infrastructure/hooks/idempotency.hook.ts` (or service) | `Idempotency-Key` capture/replay (§9.5); may reuse `redis.service.ts` |

## 17. Open decisions

| # | Question | Decision |
|---|----------|----------|
| D-API-1 | Auth standard for integrations | **Bearer API keys** (`nsk_live_…`) |
| D-API-2 | Duplicate `/api/v1` routes | **No** in MVP; same `/api/p/*` |
| D-API-3 | Key management auth | **JWTAdmin only** |
| D-API-4 | Log JWT admin calls | **Optional P2**; MVP log API key calls only |
| D-API-5 | Swagger location | **Extend `/docs`**; split public doc if cluttered |
| D-API-6 | Who can create keys | **Any ADMIN** (no `MANAGE_API_KEYS` scope in v1) |
| D-API-7 | Key visibility / revocation scope | **Deployment-wide** — any admin lists/revokes any key; owner recorded for audit. Closes the offboarded-admin revocation gap. |
| D-API-8 | Frontend home for key management | **Dedicated `/admin/api-keys` page** — decoupled from the import/export hub so SPEC-API-001 ships independently |
| D-API-9 | Access log in MVP | **Full** `api_access_log` for all key-authenticated `/api/p/*` calls + list endpoint/UI in MVP (not deferred) |
| D-API-10 | Key expiry policy | **Optional, no forced maximum** (`API_KEY_DEFAULT_TTL_DAYS=0` = no expiry); revocation is the primary kill switch |
| D-API-11 | Permission model | **One catalog, two principals** (§7.5). Roles and keys both draw permissions from a single catalog; effective = owner ∩ key grant. MVP wires a no-op `requireCapability` seam; P2 enables scoped keys (and optionally custom admin roles) as data, not route changes. Rejected: a key-only scope system parallel to the admin role. |
| D-API-12 | Write idempotency | **`Idempotency-Key` header, opt-in** (§9.5). MVP on high-risk creates lacking a natural unique key; P2 all `POST`. Absent header = unchanged behaviour. |
| D-API-13 | Rotation | **Regenerate endpoint** preserves key identity (§7.4a); immediate in MVP, optional grace window P2. Preferred over manual create+revoke. |
| D-API-14 | API compatibility | `/api/p/*` is the stable surface; breaking changes require `/api/v1` + deprecation window (§9.6). |

## 18. Documentation updates

- [spec-index.md](spec-index.md) — register SPEC-API-001
- [spec-platform-access-model.md](spec-platform-access-model.md) — §3 cross-link; §6 add `ApiKeyAdmin` + `JWTAdminOrApiKey` strategies when implemented
- [README.md](../README.md) — “API automation” section with curl example
- `backend/README.md` — strategies + env vars
- `frontend/app/components/NavItems.ts` — add `adminOnly` entry for `/admin/api-keys`
- [backend/docs/api-documentation.md](../backend/docs/api-documentation.md) — second security scheme in Swagger examples
- **Future webhooks:** README bullet: “Outbound webhooks — planned (SPEC-WEBHOOK-001 TBD)”

## 19. Reference: touchpoints

| Area | Location |
|------|----------|
| Strategies today | `backend/src/infrastructure/strategies/strategies.ts` |
| JWT composite | `JWTAdminAndUser.schema.ts` |
| Admin routes | `backend/src/infrastructure/routes/admin/` |
| Capabilities | `backend/src/infrastructure/roles/capabilities.ts` |
| Session credentials | `backend/src/domain/_interfaces/session.interface.ts` |
| Swagger | `/docs`, `/docs.json` |
| Import jobs | [spec-import-export.md](spec-import-export.md) §9 |

## 20. Changes from draft validation

| # | Item | Detail |
|---|------|--------|
| 1 | Platform spec conflict | SPEC-PLATFORM-001 §3 lists “API keys” as non-goal for *implemented* v1; update platform spec cross-link when this ships |
| 2 | User capabilities | Scoped keys in P2 must not circumvent `users:write` without holding that capability |
| 3 | Credentials `authMethod` | Helps access log and debugging; not exposed to clients |
| 4 | Credentials match confirmed | JWT returns `{ id, email, role }`; API key adds `capabilities`, `apiKeyId`, `authMethod` |
| 5 | Composite precedent verified | `jwtAdminAndUserScheme` already implements custom-scheme try/fallback via `server.auth.test(...)`; `JWTAdminOrApiKey` reuses this shape but routes by bearer prefix (§6.2) instead of blind fallback |
| 6 | Route auth shape | Routes use `auth: { strategies: ['JWTAdmin'] }` (array form), not `auth: 'JWTAdmin'`; ~14 files under `routes/admin` to switch |
| 7 | Lookup pattern tightened | Validation is **lookup by indexed `prefix` then `timingSafeEqual`**, not a `secret_hash` scan (§6.2) — removes earlier ambiguity between §6.2 and §12 |
| 8 | Visibility resolved | Keys are deployment-wide (D-API-7), so the list index is `(revoked_at, created_at)`, not `(user_id, revoked_at)` |
| 9 | Legacy role scopes removed | `scope` / `role_scope` tables and `ScopesEnum` dropped; `api_key.scopes` renamed to `capabilities`. |
| 10 | Platform spec follow-up | SPEC-PLATFORM-001 updated for capability-based auth (2026-06-01). |

---

*End of specification.*
