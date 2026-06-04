# Feature specification: LDAP authentication

- **Document ID:** SPEC-LDAP-001
- **Status:** Draft
- **Last updated:** 2026-06-03
- **Related requirements (E2E):** REQ-LDAP-001 (TBD)
- **Depends on:** spec-platform-access-model.md, spec-authentication.md, spec-admin-user-management.md

---

> **Note on this revision.** This is a **design** spec — LDAP is not yet implemented. It describes the
> target behaviour and the proposed backend layout so implementation is a faithful follow-up. Sections
> §14 (acceptance criteria) and `[CODEBASE FIX]` notes will be filled in during implementation.

## 1. Summary

ninjasset adds **LDAP** as a second way to authenticate, alongside the existing local
email + password flow (see [spec-authentication.md](spec-authentication.md)). LDAP **verifies
identity only**; ninjasset keeps full ownership of **authorization** — the `ADMIN`/`USER` role model
from [spec-platform-access-model.md](spec-platform-access-model.md) is untouched.

- **Authentication vs authorization:** LDAP answers *who you are*; the in-app role answers *what you
  can do*. No directory group is mapped to a ninjasset role.
- **JIT provisioning:** the first successful LDAP bind auto-creates a local `user` row with role
  `USER`. Admins promote individuals later via admin user management
  ([spec-admin-user-management.md](spec-admin-user-management.md)).
- **Break-glass:** a seeded local **super-admin** (`auth_provider = 'local'`) always logs in locally,
  even if the directory is unreachable.
- **OAuth2-ready:** LDAP is the first implementation of a generic **external identity provider** seam
  that the forthcoming OAuth2 spec reuses without refactoring.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Authenticate users against an LDAP/AD directory via **search-then-bind**. |
| G2 | **Just-in-time** provision directory users as local `USER` rows on first successful login. |
| G3 | Keep the in-app role model authoritative; promotion happens in ninjasset, not the directory. |
| G4 | Preserve a local **super-admin** break-glass account independent of LDAP availability. |
| G5 | Coexist with local password login; both flows issue the same JWT session. |
| G6 | Introduce a pluggable external-provider seam so OAuth2 reuses it (no group→role coupling). |

## 3. Non-goals (v1)

- AD/LDAP **group → role** mapping (roles are managed in-app).
- OIDC / SSO (see [spec-oidc-authentication.md](spec-oidc-authentication.md); reuses §8 data model and JIT rules; redirect provider is separate from password-based LDAP).
- MFA.
- Nested-group resolution / directory-driven authorization.
- Scheduled directory **sync** or **deprovisioning** jobs (disabling a directory user does not
  retroactively deactivate their ninjasset row in v1).
- LDAP write-back (password changes, profile edits pushed to the directory).

## 4. Glossary

| Term | Definition |
|------|------------|
| Search-then-bind | Service account binds, searches for the user's DN, then re-binds **as that DN** with the supplied password to verify credentials. |
| JIT provisioning | "Just-in-time": create the local `user` row on first successful external login. |
| External provider | An implementation of the `IExternalAuthProvider` seam (LDAP now, OAuth2 next). |
| `auth_provider` | The identity owner for a user row: `'local'`, `'ldap'`, or `'oauth'`. |
| Break-glass | The seeded local super-admin that authenticates without LDAP. |
| Service account | The directory account ninjasset binds with to search (`LDAP_BIND_DN`). |

## 5. Personas and user stories

| ID | Story | Priority |
|----|-------|----------|
| US-L1 | As a directory user, I sign in with my corporate credentials and get a `USER` account automatically. | Must |
| US-L2 | As an admin, I promote a directory user to `ADMIN` from the user-management UI. | Must |
| US-L3 | As the super-admin, I can always log in locally, even when LDAP is down. | Must |
| US-L4 | As an operator, I enable LDAP via configuration without code changes. | Must |
| US-L5 | As a security owner, I can restrict local login to the super-admin once LDAP is live. | Should |

## 6. Flows

### 6.1 Login (provider resolution)

```
POST /api/session/login { email, password, captchaToken, platform }
  → captcha + lockout checks (unchanged; see spec-authentication.md §6.2, §7)
  → resolve provider:
      • local user with a password hash AND (LOCAL_LOGIN_ENABLED or user is super-admin)
            → bcrypt compare (existing path)
      • else if LDAP_ENABLED
            → external provider 'ldap' (see 6.2)
      • else → invalid credentials
  → on success: sign JWT + insert session row (reuse session.domain JWT/session logic)
```

### 6.2 LDAP search-then-bind + JIT

```
1. service bind         → connect LDAP_URL, bind LDAP_BIND_DN / LDAP_BIND_PASSWORD
2. search               → LDAP_SEARCH_BASE filtered by LDAP_SEARCH_FILTER ({{username}} = email)
                          → resolve { userDN, mail (LDAP_ATTR_EMAIL), name (LDAP_ATTR_NAME) }
                          → 0 results = invalid credentials
3. user bind            → re-bind as userDN + supplied password  (verifies the password)
                          → bind failure = invalid credentials
4. JIT provision        → find user by (auth_provider='ldap', external_id=userDN)
                          → else find ACTIVE local user by email → link/reject (see §7)
                          → else INSERT user { auth_provider:'ldap', external_id:userDN,
                                               email, display_name:name, role:USER, status:ACTIVE,
                                               hashed:null, salt:null }
5. issue session        → sign JWT + insert session  (identical to local login response shape)
```

### 6.3 Break-glass

```
LDAP unreachable / misconfigured
  → super-admin (auth_provider='local') still logs in via bcrypt path (step "local user" in 6.1)
  → directory users receive invalid-credentials until LDAP is restored
```

## 7. State and business rules

| Rule | Detail |
|------|--------|
| Provider resolution | Local-with-password first, then LDAP. Super-admin always uses the local path. |
| JIT role | New LDAP users are always created as `USER`. Never `ADMIN` from the directory. |
| Role authority | After creation, `role_id` is owned by ninjasset; subsequent logins **do not** overwrite a locally promoted role. |
| Email collision | If an LDAP login resolves to an email that already belongs to a `'local'` user, **reject** by default (no silent takeover); linking is an explicit P2 decision (see §17 D5). |
| External users have no password | `hashed`/`salt` are `null`; they cannot use forgot/reset-password (those remain local-only). |
| Status | `INACTIVE` still blocks login for any provider (unverified/soft-deleted). LDAP users are created `ACTIVE` (the directory bind is the verification). |
| Lockout | Existing in-memory per-email lockout (`ACCOUNT_LOCKOUT_*`) applies to LDAP failures too. |
| Captcha | Unchanged on login. |
| Hardening | With `LOCAL_LOGIN_ENABLED=false`, only the super-admin may use the local path; all other local-password rows are refused and must authenticate via LDAP. |

## 8. Data model

Migration extends the existing `user` table (see `2_create_users.ts`); no new tables in v1.

| Column | Type | Notes |
|--------|------|-------|
| `auth_provider` | string, default `'local'`, NOT NULL | `'local' \| 'ldap' \| 'oauth'`. Backfilled to `'local'` for existing rows. |
| `external_id` | string, nullable | Directory DN (or uid) for external users; `null` for local. |
| `hashed` | string, **now nullable** | `null` for external-provider users. |
| `salt` | string, **now nullable** | `null` for external-provider users. |

Constraints:

| Constraint | Detail |
|------------|--------|
| Unique external identity | Partial unique index on `(auth_provider, external_id) WHERE external_id IS NOT NULL`. |
| Local password presence | App-level check: `auth_provider='local'` ⇒ `hashed`/`salt` present; external ⇒ both `null`. |
| Email uniqueness | Existing unique `email` retained; collision handling per §7. |

## 9. API specification

No new **public** route in v1 — LDAP is transparent to the client and handled inside the existing
login endpoint.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/session/login` | No | Issue JWT; resolves local **or** LDAP provider internally |

Internal provider seam (not an HTTP surface):

```typescript
interface IExternalIdentity {
  externalId: string;   // directory DN / provider subject
  email: string;
  displayName: string;
}

interface IExternalAuthProvider {
  readonly name: 'ldap' | 'oauth';
  // Returns the verified identity, or null when credentials are invalid.
  authenticate(username: string, password: string): Promise<IExternalIdentity | null>;
}
```

The LDAP implementation is the first registrant. The login response shape (`{ token, user }`) is
**identical** to local login — no client change.

## 10. Email

Not applicable. LDAP users do not receive verification or reset emails (no local password). Local
flows are unchanged — see [spec-email-notifications.md](spec-email-notifications.md) and
[spec-authentication.md](spec-authentication.md).

## 11. Frontend

| Element | Behaviour |
|---------|-----------|
| Login form | Unchanged — same email + password fields; directory users enter corporate credentials. |
| Provider badge | Admin user list/detail shows an `auth_provider` badge (`LDAP` / `Local`) — light addition for support visibility. |
| Forgot password | Hidden/disabled for external users is **not** required in v1 (they simply won't have a local match); local users keep the link. |

No new routes. Post-login routing is unchanged (ADMIN → `/admin/overview`, USER → `/dashboard`).

## 12. Security

| Control | Detail |
|---------|--------|
| Transport | **LDAPS** (`ldaps://`) or StartTLS required in production; `LDAP_TLS_REJECT_UNAUTHORIZED=true`. |
| Service-account secrets | `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD` from environment/secret store, never committed. |
| No password storage | Directory passwords are verified by bind and never persisted; external rows store no hash. |
| Break-glass | Local super-admin survives LDAP outage / misconfiguration. |
| Hardening | `LOCAL_LOGIN_ENABLED=false` restricts local login to the super-admin. |
| Brute-force | Existing per-email lockout applies to LDAP attempts. |
| Injection | `{{username}}` is escaped per RFC 4515 before substitution into `LDAP_SEARCH_FILTER`. |
| No privilege from directory | JIT always yields `USER`; elevation is an explicit in-app action. |

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `LDAP_ENABLED` | Master switch (default `false`). |
| `LDAP_URL` | e.g. `ldaps://ldap.example.com:636`. |
| `LDAP_BIND_DN` | Service account used to search. |
| `LDAP_BIND_PASSWORD` | Service account password. |
| `LDAP_SEARCH_BASE` | e.g. `ou=people,dc=example,dc=com`. |
| `LDAP_SEARCH_FILTER` | e.g. `(\|(uid={{username}})(mail={{username}}))`. |
| `LDAP_ATTR_EMAIL` | Attribute for email (default `mail`). |
| `LDAP_ATTR_NAME` | Attribute for display name (default `cn`). |
| `LDAP_TLS_REJECT_UNAUTHORIZED` | Verify server cert (default `true`). |
| `LOCAL_LOGIN_ENABLED` | Allow local-password login for non-super-admins (default `true`). |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Seed/break-glass super-admin (reconcile with existing admin seeding). |

## 14. Acceptance criteria (E2E)

**TBD** — Draft spec; E2E lives under `e2e/tests/ldap/` once implemented. Planned `REQ-LDAP-001`:

### REQ-LDAP-001

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Valid directory credentials → JIT user created with role `USER`; lands on `/dashboard`. |
| AC-001.2 | Second login by same directory user → no duplicate row; existing user reused. |
| AC-001.3 | Wrong directory password → HTTP ≥ 400; no user row created. |
| AC-001.4 | `LDAP_ENABLED=false` → directory credentials rejected; only local accounts log in. |
| AC-001.5 | LDAP unreachable → super-admin still logs in locally; directory users get invalid credentials. |
| AC-001.6 | Admin promotes an LDAP user to `ADMIN`; on next login the user reaches admin UI (role not reset by JIT). |
| AC-001.7 | `LOCAL_LOGIN_ENABLED=false` → a local non-super-admin row is refused on the local path. |

## 15. Implementation phases

| Phase | Scope | Status |
|-------|-------|--------|
| P1 | `auth_provider`/`external_id` migration; nullable `hashed`/`salt`; super-admin seed | Draft |
| P2 | Provider seam + LDAP provider (`ldapts`); login provider resolution | Draft |
| P3 | Admin provider badge; `LOCAL_LOGIN_ENABLED` hardening; E2E `REQ-LDAP-001` | Draft |

## 16. Backend layering (proposed)

- `domain/session/providers/externalAuthProvider.interface.ts` — `IExternalAuthProvider`, `IExternalIdentity`.
- `domain/session/providers/ldap/ldap.provider.ts` — search-then-bind via **`ldapts`** (promise-based, TypeScript-native).
- `domain/session/providers/registry.ts` — name → provider lookup (OAuth2 registers here next).
- `domain/session/session.domain.ts` — extend `login()` with provider resolution (§6.1); reuse existing JWT signing + `insertJWT`.
- `infrastructure/repositories/userDb/userDb.repository.ts` — `findByExternalId`, `createExternalUser`.
- New migration under `backend/migrations/` — adds columns + partial unique index (§8); backfill `auth_provider='local'`.
- `backend/src/config/config.ts` — parse the §13 variables.

The provider seam keeps LDAP isolated from the local path: OAuth2 adds a sibling under
`providers/oauth/` and a registry entry, with **no** change to role logic.

## 17. Open decisions (resolved)

| # | Question | Decision |
|---|----------|----------|
| D1 | Map LDAP groups to roles? | **No** — roles managed in-app; JIT users are `USER`. |
| D2 | Pre-provision or JIT? | **JIT** on first successful bind (industry standard). |
| D3 | Replace local login? | **No — coexist.** Optional `LOCAL_LOGIN_ENABLED=false` hardening; super-admin always exempt. |
| D4 | Build OAuth2-ready abstraction now? | **Yes** — generic `IExternalAuthProvider` seam; LDAP is the first implementation. |
| D5 | LDAP login whose email matches an existing local user? | **Reject** by default (no silent takeover). Explicit account linking is P2. |
| D6 | Bind strategy? | **Search-then-bind** (service account searches; user DN re-binds to verify). |

## 18. Documentation updates

- [spec-index.md](spec-index.md) — register SPEC-LDAP-001.
- [spec-authentication.md](spec-authentication.md) — note LDAP as a coexisting provider; remove "Social login / SSO" from non-goals once OIDC lands.
- [spec-oidc-authentication.md](spec-oidc-authentication.md) — OIDC SSO; shares `auth_provider` / JIT semantics.
- [spec-platform-access-model.md](spec-platform-access-model.md) — note that JWT/session issuance is provider-agnostic.
- `README.md` — LDAP configuration section.
- `.env.example` — add the §13 variables.

## 19. Reference: touchpoints

| Area | Location |
|------|----------|
| Login domain | `backend/src/domain/session/session.domain.ts` |
| Auth strategies (issuance unchanged) | `backend/src/infrastructure/strategies/strategies.ts` |
| User repository | `backend/src/infrastructure/repositories/userDb/userDb.repository.ts` |
| User migration (extended) | `backend/migrations/2_create_users.ts` (+ new migration) |
| Config | `backend/src/config/config.ts` |
| Admin user UI (provider badge, promotion) | per [spec-admin-user-management.md](spec-admin-user-management.md) |

## 20. Codebase validation

To be completed during implementation (record `[CODEBASE FIX]` items here — e.g. confirmed login
route path, actual super-admin seeding mechanism, `ldapts` vs alternative, exact nullable-column
migration behaviour).

---

*End of specification.*
