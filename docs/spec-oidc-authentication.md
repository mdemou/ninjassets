# Feature specification: OIDC authentication (SSO)

- **Document ID:** SPEC-OIDC-001
- **Status:** Draft
- **Last updated:** 2026-06-04
- **Related requirements (E2E):** REQ-OIDC-001 (TBD)
- **Depends on:** spec-platform-access-model.md, spec-authentication.md, spec-admin-user-management.md, spec-ldap-authentication.md

---

> **Note on this revision.** This is a **design** spec — OIDC is not yet implemented. It describes the
> target behaviour and the proposed backend layout so implementation is a faithful follow-up. Sections
> §14 (acceptance criteria) and `[CODEBASE FIX]` notes will be filled in during implementation.
>
> **Relationship to LDAP.** [spec-ldap-authentication.md](spec-ldap-authentication.md) introduces
> `auth_provider`, `external_id`, JIT provisioning, and break-glass local login. OIDC is the
> **redirect-based** external provider (`auth_provider = 'oauth'`). Implement LDAP (or at least its
> migration + user columns) before or together with OIDC so both share the same data model.

## 1. Summary

ninjasset adds **OpenID Connect (OIDC)** as an enterprise SSO option alongside local email + password
and (optionally) LDAP. The IdP answers *who you are* via a standard **Authorization Code + PKCE**
flow; ninjasset keeps full ownership of **authorization** — the `ADMIN`/`USER` role model from
[spec-platform-access-model.md](spec-platform-access-model.md) is untouched.

- **Authentication vs authorization:** OIDC supplies `sub`, email, and display name; no IdP group is
  mapped to a ninjasset role.
- **JIT provisioning:** the first successful OIDC login auto-creates a local `user` row with role
  `USER`. Admins promote individuals later via admin user management
  ([spec-admin-user-management.md](spec-admin-user-management.md)).
- **Break-glass:** a seeded local **super-admin** (`auth_provider = 'local'`) always logs in via the
  existing password form, even when the IdP is misconfigured or unreachable.
- **Provider seam:** OIDC extends the external-identity model from [spec-ldap-authentication.md](spec-ldap-authentication.md)
  §9 with a **redirect** provider interface (LDAP remains password-based on `POST /login`).

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Sign in users against a standards-compliant OIDC provider (Azure AD, Okta, Keycloak, Google Workspace, etc.). |
| G2 | **Just-in-time** provision IdP users as local `USER` rows on first successful login. |
| G3 | Keep the in-app role model authoritative; promotion happens in ninjasset, not the IdP. |
| G4 | Preserve a local **super-admin** break-glass account independent of SSO. |
| G5 | Coexist with local and LDAP login; all successful flows issue the same JWT session shape. |
| G6 | Reuse `auth_provider` / `external_id` from SPEC-LDAP-001; no duplicate identity columns. |
| G7 | Use **PKCE** and **state**/**nonce** validation suitable for a public SPA client talking to a confidential backend. |

## 3. Non-goals (v1)

- IdP **group / role → ninjasset role** mapping (roles are managed in-app).
- **SAML** federation (OIDC only in v1; SAML may be a separate spec).
- **Client-credentials** or machine-to-machine OIDC (API keys remain per [spec-api-automation.md](spec-api-automation.md)).
- MFA enforcement at the ninjasset layer (rely on IdP MFA when configured there).
- Scheduled directory **sync** or automatic **deprovisioning** when an IdP account is disabled.
- Multiple concurrent OIDC providers (single issuer per deployment in v1).
- **Account linking** UI when OIDC email matches an existing local/LDAP user (reject by default; explicit linking is P2).
- **Social** consumer IdPs as a product goal (the same OIDC stack may work technically; v1 targets corporate IdPs).

## 4. Glossary

| Term | Definition |
|------|------------|
| OIDC | OpenID Connect — identity layer on OAuth 2.0; returns an ID Token (JWT) with claims such as `sub`, `email`. |
| IdP | Identity Provider (authorization server + OIDC discovery document). |
| Authorization Code + PKCE | OAuth2 flow where the browser receives a `code`, the backend exchanges it with a `code_verifier`; mitigates interception for public clients. |
| JIT provisioning | "Just-in-time": create the local `user` row on first successful external login. |
| `sub` | Stable subject identifier from the ID Token; stored as `external_id` with `auth_provider = 'oauth'`. |
| BFF callback | Backend receives the IdP redirect, completes token exchange, issues the ninjasset JWT, then redirects the browser to the SPA. |
| Break-glass | The seeded local super-admin that authenticates without SSO. |

## 5. Personas and user stories

| ID | Story | Priority |
|----|-------|----------|
| US-O1 | As a corporate user, I click **Sign in with SSO** and land in the app with a `USER` account created automatically. | Must |
| US-O2 | As an admin, I promote an SSO user to `ADMIN` from the user-management UI. | Must |
| US-O3 | As the super-admin, I can always log in with email + password, even when SSO is misconfigured. | Must |
| US-O4 | As an operator, I enable OIDC via configuration and IdP app registration without code changes. | Must |
| US-O5 | As a security owner, I can disable self-service registration and rely on SSO + admin provisioning. | Should |
| US-O6 | As a returning SSO user, my promoted `ADMIN` role is preserved across logins. | Must |

## 6. Flows

### 6.1 High-level SSO login

```
User on /login
  → clicks "Sign in with SSO"
  → browser navigates to GET /api/session/oauth/start
       backend: generate state, nonce, PKCE verifier/challenge
       store { state, nonce, codeVerifier, returnUrl? } in Redis (TTL ~10 min)
       redirect 302 → IdP authorization endpoint
  → user authenticates at IdP
  → IdP redirects to GET /api/session/oauth/callback?code=…&state=…
       backend: validate state (Redis lookup + delete)
       exchange code + code_verifier for tokens (openid-client)
       validate ID Token (issuer, audience, expiry, nonce)
       extract IExternalIdentity { externalId: sub, email, displayName }
       JIT provision (§6.3)
       sign ninjasset JWT + insert session row
       redirect 302 → FRONTEND_URL/auth/oauth/callback?token=…  (one-time handoff; see §11)
  → SPA stores token (same as POST /login) → route by role
```

### 6.2 Coexistence with local and LDAP login

| Flow | Entry | Notes |
|------|-------|-------|
| Local password | `POST /api/session/login` | Unchanged; super-admin always eligible. See [spec-authentication.md](spec-authentication.md). |
| LDAP | `POST /api/session/login` | When `LDAP_ENABLED` and provider resolution selects LDAP (SPEC-LDAP-001 §6.1). |
| OIDC | `GET /api/session/oauth/start` → callback | Separate redirect path; **not** mixed into password login. |

`LOCAL_LOGIN_ENABLED=false` (from LDAP spec) still allows **only** the super-admin on the password
form; all other users must use SSO (or LDAP if enabled).

### 6.3 JIT provisioning (OIDC)

```
After ID Token validated:
1. find user by (auth_provider='oauth', external_id=sub)
2. else find ACTIVE user by email:
     • auth_provider='local'  → reject (§7 email collision)
     • auth_provider='ldap'   → reject in v1 (no silent link)
     • auth_provider='oauth' with different external_id → reject (data integrity)
3. else INSERT user {
     auth_provider: 'oauth',
     external_id: sub,
     email, display_name,
     role: USER,
     status: ACTIVE,
     hashed: null, salt: null
   }
4. issue session (identical JWT + response user shape to local login)
```

Subsequent logins reuse the row; **`role_id` is never overwritten** by JIT.

### 6.4 Logout

| Layer | Behaviour |
|-------|-----------|
| ninjasset | `GET /api/session/logout` invalidates the app session (unchanged). |
| IdP | v1 **RP-initiated logout** is optional (`OIDC_END_SESSION_ENDPOINT`); if unset, only local session ends. P2: front-channel logout redirect. |

### 6.5 Break-glass

```
OIDC misconfigured / IdP outage / invalid client secret
  → SSO button may error on start or callback
  → super-admin (auth_provider='local') still uses POST /login with password
  → other users cannot authenticate until SSO is restored (unless LDAP is also enabled)
```

## 7. State and business rules

| Rule | Detail |
|------|--------|
| Identity key | `(auth_provider='oauth', external_id=sub)` is canonical; email may change at IdP — v1 treats `sub` as stable (email updates on login are **out of scope**; P2). |
| JIT role | New OIDC users are always `USER`. Never `ADMIN` from the IdP. |
| Role authority | After creation, `role_id` is owned by ninjasset; subsequent logins do not reset a promoted role. |
| Email collision | If OIDC `email` matches an existing `'local'` or `'ldap'` user, **reject** with a safe error (no silent takeover). |
| External users have no password | `hashed`/`salt` are `null`; forgot/reset-password remain local-only. |
| Status | `INACTIVE` blocks login for any provider. OIDC users are created `ACTIVE` (IdP authentication is the verification). |
| Registration | `SIGNUP_ENABLED` is independent; operators may disable public register while SSO is on. |
| Captcha | Not used on the OIDC redirect path (IdP handles bot resistance). Password login keeps captcha. |
| Lockout | Per-email lockout does **not** apply to OIDC (no password attempts). Rate-limit OAuth start/callback per IP in implementation (P2 detail). |
| State / nonce | Single-use; stored server-side with short TTL; mismatch → `400` generic error. |
| Token handoff | JWT passed to SPA via **one-time** redirect query param; frontend must strip it from the URL immediately after read. |

## 8. Data model

No new tables in v1 beyond what [spec-ldap-authentication.md](spec-ldap-authentication.md) §8 defines.

| Column | OIDC usage |
|--------|------------|
| `auth_provider` | `'oauth'` for SSO users. |
| `external_id` | ID Token `sub` (string). |
| `hashed` / `salt` | `null` for OAuth users. |

**Ephemeral OAuth state** (not migrated to Postgres):

| Store | Key | Payload | TTL |
|-------|-----|---------|-----|
| Redis | `oauth:state:{state}` | `{ nonce, codeVerifier, returnUrl? }` | 600 s (configurable) |

## 9. API specification

### 9.1 Public routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/session/oauth/start` | No | Create PKCE + state; redirect to IdP |
| GET | `/api/session/oauth/callback` | No | Validate callback; JIT user; issue JWT; redirect to SPA |
| GET | `/api/session/public-config` | No | Extended: `oauthEnabled`, `oauthProviderLabel` (see §11) |
| POST | `/api/session/login` | No | Unchanged — local / LDAP password login |

Query parameters for **start** (optional):

| Param | Purpose |
|-------|---------|
| `returnUrl` | Relative path only (e.g. `/dashboard`); validated against allowlist; default post-login routing if omitted |

Callback query params (from IdP): `code`, `state`; error responses: `error`, `error_description` → mapped to safe redirect to `/login?error=sso_failed`.

### 9.2 Provider interfaces (extends LDAP seam)

Password-based external auth (LDAP) keeps the interface from SPEC-LDAP-001 §9. OIDC adds a
sibling contract:

```typescript
interface IExternalIdentity {
  externalId: string;   // sub
  email: string;
  displayName: string;
}

interface IExternalOidcProvider {
  readonly name: 'oauth';
  /** Build authorization URL; caller persists state/nonce/verifier. */
  buildAuthorizationUrl(params: {
    state: string;
    nonce: string;
    codeChallenge: string;
  }): string;
  /** Exchange code; validate ID Token; return identity or throw. */
  completeLogin(params: {
    code: string;
    codeVerifier: string;
    nonce: string;
  }): Promise<IExternalIdentity>;
}
```

Registry: `getPasswordProvider('ldap')`, `getOidcProvider('oauth')` — or a single registry module
exporting both kinds.

**Login response shape** after SSO (`{ token, user }`) matches `POST /api/session/login` — no client
API change beyond new routes and the callback handoff page.

### 9.3 ID Token claims

| Claim | Required | Maps to |
|-------|----------|---------|
| `sub` | Yes | `external_id` |
| `email` | Yes* | `user.email` |
| `email_verified` | Should | If `false`, reject login in production (`OIDC_REQUIRE_EMAIL_VERIFIED=true`) |
| `name` / `preferred_username` | No | `display_name` — first non-empty of configured claim list |

\*If the IdP omits `email`, v1 **fails** login with a clear operator-facing log (no fallback username).

## 10. Email

Not applicable for SSO users (no local password, no verification email on JIT create). Admin-created
**local** users and verification flows are unchanged — see [spec-email-notifications.md](spec-email-notifications.md).

## 11. Frontend

| Element | Behaviour |
|---------|-----------|
| Login page | When `publicConfig.oauthEnabled`, show **Sign in with {oauthProviderLabel}** (secondary button). Password form remains for local/LDAP. |
| `/auth/oauth/callback` | Read `token` from query once → `localStorage` (same key as password login) → `replaceState` to strip token → redirect ADMIN → `/admin/overview`, USER → `/dashboard`. Honor `returnUrl` when present and allowed. |
| Provider badge | Admin user list/detail: `SSO` / `LDAP` / `Local` badge from `auth_provider` (extend LDAP spec §11). |
| Register | Unchanged; operators may set `SIGNUP_ENABLED=false` for SSO-only tenants. |
| Forgot password | Unchanged for local users; SSO users have no local password. |

**[CODEBASE FIX]** Confirm `GET /api/session/public-config` path matches
`session.route.ts` (currently exposed as `publicConfig` handler).

## 12. Security

| Control | Detail |
|---------|--------|
| PKCE | S256 code challenge on every authorization request. |
| State | Cryptographically random; bound to server-side Redis entry; prevents CSRF. |
| Nonce | Sent to IdP; must match ID Token `nonce` claim. |
| ID Token validation | Issuer, audience (`client_id`), `exp`, signature via IdP JWKS (`openid-client`). |
| Client secret | `OIDC_CLIENT_SECRET` from environment/secret store only on backend token exchange. |
| Redirect URI | Exact match registered at IdP; typically `{BACKEND_URL}/api/session/oauth/callback`. |
| Token handoff | Short-lived redirect to SPA; strip query param immediately; prefer `Cache-Control: no-store` on callback redirect. |
| HTTPS | Required in production for callback and SPA origin. |
| Break-glass | Local super-admin unaffected by SSO outage. |
| Hardening | `LOCAL_LOGIN_ENABLED=false` limits password login to super-admin. |
| No privilege from IdP | JIT always yields `USER`. |
| Secrets in browser | Never expose `client_secret` or long-lived IdP tokens to the SPA — only the ninjasset JWT. |

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `OIDC_ENABLED` | Master switch (default `false`). |
| `OIDC_ISSUER` | Issuer URL (discovery: `{ISSUER}/.well-known/openid-configuration`). |
| `OIDC_CLIENT_ID` | OAuth2 client id. |
| `OIDC_CLIENT_SECRET` | Confidential client secret (backend only). |
| `OIDC_REDIRECT_URI` | Callback URL registered at IdP (default derived from `BACKEND_URL` if unset). |
| `OIDC_SCOPES` | Default `openid profile email`. |
| `OIDC_PROVIDER_LABEL` | Button text, e.g. `Corporate SSO` (default `SSO`). |
| `OIDC_CLAIM_EMAIL` | Claim for email (default `email`). |
| `OIDC_CLAIM_NAME` | Ordered fallbacks for display name, e.g. `name,preferred_username` (comma-separated). |
| `OIDC_REQUIRE_EMAIL_VERIFIED` | Reject if `email_verified` is false (default `true` in production). |
| `OIDC_STATE_TTL_SEC` | Redis TTL for OAuth state (default `600`). |
| `OIDC_END_SESSION_ENDPOINT` | Optional; if set, logout may redirect here (P2 behaviour). |
| `LOCAL_LOGIN_ENABLED` | Shared with LDAP spec — password login for non-super-admins. |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Break-glass seed (shared with LDAP spec). |
| `FRONTEND_URL` / `BACKEND_URL` | SPA origin and API base for redirects. |

## 14. Acceptance criteria (E2E)

**TBD** — Draft spec; E2E lives under `e2e/tests/oidc/` once implemented. Planned `REQ-OIDC-001`:

### REQ-OIDC-001

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Valid OIDC mock/login → JIT user with role `USER`; lands on `/dashboard`. |
| AC-001.2 | Second login by same `sub` → no duplicate row; same user reused. |
| AC-001.3 | IdP returns invalid/expired code → safe error; no user row created. |
| AC-001.4 | `OIDC_ENABLED=false` → SSO button hidden; start endpoint returns 404 or disabled. |
| AC-001.5 | Admin promotes SSO user to `ADMIN`; next SSO login reaches admin UI (role not reset). |
| AC-001.6 | OIDC email matches existing **local** user → login rejected; no account takeover. |
| AC-001.7 | Super-admin logs in via password when OIDC is enabled. |
| AC-001.8 | `LOCAL_LOGIN_ENABLED=false` → non-super local user refused on password form; SSO still works. |
| AC-001.9 | Tampered `state` on callback → rejected; no session issued. |

E2E should use a **mock OIDC** server or stubbed `IExternalOidcProvider` (similar to `MOCK_CAPTCHA`)
— not a live corporate IdP in CI.

## 15. Implementation phases

| Phase | Scope | Status |
|-------|-------|--------|
| P1 | Depends on SPEC-LDAP-001 P1 migration (`auth_provider`, `external_id`, nullable password) | Draft |
| P2 | `IExternalOidcProvider` + `openid-client`; Redis state; start/callback routes; JIT + session issuance | Draft |
| P3 | Frontend SSO button, `public-config` flags, `/auth/oauth/callback`; admin `SSO` badge | Draft |
| P4 | E2E `REQ-OIDC-001` with mock IdP; docs + `.env.example` | Draft |

## 16. Backend layering (proposed)

- `domain/session/providers/externalIdentity.interface.ts` — shared `IExternalIdentity`.
- `domain/session/providers/oidc/oidc.provider.ts` — `openid-client` Issuer/Client; discovery + token exchange.
- `domain/session/providers/oidc/oidc.stateStore.ts` — Redis get/set/delete for PKCE state.
- `domain/session/providers/registry.ts` — register LDAP (password) and OIDC (redirect) providers.
- `domain/session/oauth.domain.ts` — `start()`, `callback()` orchestration (JIT, JWT, redirect URL).
- `domain/session/session.domain.ts` — password `login()` unchanged; shared `issueSession(user)` helper extracted.
- `infrastructure/routes/session/session.controller.ts` — `oauthStart`, `oauthCallback` handlers.
- `infrastructure/repositories/userDb/userDb.repository.ts` — `findByExternalId`, `createExternalUser` (from LDAP spec).
- `backend/src/config/config.ts` — parse §13 variables.
- `frontend/app/routes/auth-oauth-callback.tsx` (or equivalent) — token handoff page.

Recommended library: **`openid-client`** (maintained, discovery, PKCE, JWKS validation).

## 17. Open decisions (resolved)

| # | Question | Decision |
|---|----------|----------|
| D1 | Map IdP groups to roles? | **No** — same as LDAP; JIT users are `USER`. |
| D2 | Pre-provision or JIT? | **JIT** on first successful OIDC login. |
| D3 | Replace local login? | **No — coexist.** Optional `LOCAL_LOGIN_ENABLED=false`; super-admin exempt. |
| D4 | OAuth2 generic vs OIDC? | **OIDC** (ID Token + `sub`); Authorization Code + PKCE only in v1. |
| D5 | Email collision with local/LDAP? | **Reject** by default; explicit linking P2. |
| D6 | Where to exchange the code? | **Backend (BFF)** — secret stays server-side; SPA receives only ninjasset JWT. |
| D7 | Store `sub` vs email as `external_id`? | **`sub`** — stable per IdP issuer. |
| D8 | Multiple IdPs? | **Single** issuer per deployment in v1. |
| D9 | LDAP interface reuse? | **Shared** `IExternalIdentity` + JIT rules; **separate** `IExternalOidcProvider` (redirect ≠ password). |

## 18. Documentation updates

- [spec-index.md](spec-index.md) — register SPEC-OIDC-001.
- [spec-authentication.md](spec-authentication.md) — add OIDC as SSO provider; remove "Social login / SSO" from non-goals when implemented.
- [spec-ldap-authentication.md](spec-ldap-authentication.md) — cross-link OIDC spec; clarify `oauth` provider name in registry.
- [spec-platform-access-model.md](spec-platform-access-model.md) — note provider-agnostic JWT issuance.
- `README.md` — OIDC / IdP registration section.
- `.env.example` — add §13 variables.

## 19. Reference: touchpoints

| Area | Location |
|------|----------|
| Login domain | `backend/src/domain/session/session.domain.ts` |
| Session routes | `backend/src/infrastructure/routes/session/session.route.ts` |
| Public config | `backend/src/infrastructure/routes/session/session.controller.ts` |
| User repository | `backend/src/infrastructure/repositories/userDb/userDb.repository.ts` |
| Config | `backend/src/config/config.ts` |
| Login UI | `frontend/app/routes/login.tsx` (or equivalent) |
| Admin user UI | per [spec-admin-user-management.md](spec-admin-user-management.md) |
| Redis | existing Redis config (state store) |

## 20. Codebase validation

To be completed during implementation (record `[CODEBASE FIX]` items here — e.g. confirmed
`public-config` route path, `openid-client` version, exact redirect URL registered in dev Docker,
whether `returnUrl` allowlist lives in config or code).

---

*End of specification.*
