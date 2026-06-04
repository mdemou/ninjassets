# Feature specification: Platform access model

- **Document ID:** SPEC-PLATFORM-001
- **Status:** Implemented
- **Last updated:** 2026-06-01
- **Related requirements (E2E):** REQ-AUTH-002 (RBAC), REQ-PERSONAL-001 (access control)
- **Depends on:** —

---

## 1. Summary

Defines how **authentication and authorization** work across ninjasset: two roles (`ADMIN`, `USER`), JWT-based sessions, separate admin and personal API surfaces, a unified **capability** catalog for fine-grained admin/API-key checks (see [spec-api-automation.md](spec-api-automation.md)), and matching frontend route guards.

- **Backend:** Hapi auth strategies `JWTAdmin`, `JWTUser`, and composite `JWTAdminAndUser`.
- **API layout:** Admin inventory at `/api/p/*`; caller-scoped reads at `/api/me/*`; public auth at `/api/session/*`.
- **Frontend:** `useRequireAuth`, per-route `roleName === 'ADMIN'` checks, and nav filtering in `NavItems.ts`.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Enforce admin-only mutations on global ITAM data via `JWTAdmin`. |
| G2 | Allow any authenticated user (including admins) to read their own assignments via `/api/me/*`. |
| G3 | Prevent regular users from calling admin APIs or viewing admin UI. |
| G4 | Keep magic-link query tokens out of JWT validation (`urlKey: false`). |

## 3. Non-goals (v1)

- Per-asset or per-site ABAC beyond admin vs user.
- OAuth / SSO (UI).
- Separate “read-only admin” role (P2; same capability machinery as scoped API keys).

## 4. Glossary

| Term | Definition |
|------|------------|
| ADMIN | Role with full ITAM access; lands on `/admin/overview` after login. |
| USER | Role with personal workspace only; lands on `/dashboard`. |
| Capability | `area:action` permission string (e.g. `users:write`) from the unified catalog (SPEC-API-001 §7.5). |
| `/api/p/*` | **Privileged** admin prefix (historical “p” = privileged). |
| `/api/me/*` | **Personal** prefix; always scoped to the authenticated user. |

## 5. Personas and user stories

### 5.1 All users

| ID | Story | Priority |
|----|-------|----------|
| US-P1 | As a user, I must present a valid JWT to access protected pages and APIs. | Must |
| US-P2 | As a user, I can call `/api/me/*` to see only my own assets and history. | Must |

### 5.2 Admin

| ID | Story | Priority |
|----|-------|----------|
| US-P3 | As an admin, I can call `/api/p/*` to manage the full inventory. | Must |
| US-P4 | As an admin, I still use `/api/me/*` when viewing my personal dashboard data. | Must |

### 5.3 Regular user

| ID | Story | Priority |
|----|-------|----------|
| US-P5 | As a regular user, I am blocked from admin routes and `/api/p/*`. | Must |

## 6. Auth strategy matrix

```
Request ──► JWTAdminAndUser ──► try JWTAdmin ──► else JWTUser ──► 401
Request ──► JWTAdmin only     ──► admin session + role ADMIN ──► else 401
Request ──► JWTUser only      ──► (rare; most personal routes use AdminAndUser)
```

| Strategy | Secret | Validates | Used by |
|----------|--------|-----------|---------|
| `JWTAdmin` | `JWT_ADMIN_SECRET_KEY` | Session row + `roleName === 'ADMIN'` | `/api/p/*` |
| `JWTUser` | `JWT_USER_SECRET_KEY` | Session row + user role | Available; most routes use composite |
| `JWTAdminAndUser` | Both (try admin first) | Either valid session | `/api/me/*`, session logout/me, avatars |

**[CODEBASE FIX]** `JWTAdminAndUser` tries admin token first, then user token. Admins always use the admin JWT from login even on personal endpoints.

## 7. State and business rules

### 7.1 User status

| Status | Can log in? |
|--------|-------------|
| `INACTIVE` | No (unverified registration) |
| `ACTIVE` | Yes |

### 7.2 Role → capabilities

| Capability | ADMIN | USER |
|------------|-------|------|
| `/api/p/assets`, sites, catalog, stats, alerts, handovers (admin) | Yes | No |
| `/api/me/assets`, transactions, handovers (accept) | Yes (own data) | Yes (own data) |
| Admin UI routes under `/admin/*` | Yes | No (redirected) |
| Personal UI `/dashboard`, `/assets`, `/settings` | Yes | Yes |

### 7.3 Fine-grained admin permissions

User-management and other `/api/p/*` routes declare required **capabilities** on `route.options.app.capability`. A global `requireCapability` hook ([`apiHooks.ts`](../backend/src/infrastructure/hooks/apiHooks.ts)) enforces them after auth.

| Capability | Typical routes |
|------------|----------------|
| `users:read` | `GET /api/p/users`, user detail |
| `users:write` | `POST` / `PATCH` / `DELETE /api/p/users` |

**MVP:** every `ADMIN` JWT and full-admin API key hold `["*"]`, so capability checks are a no-op. **P2:** scoped API keys and optional custom admin roles use the same catalog.

## 8. Data model

| Table | Purpose |
|-------|---------|
| `role` | `ADMIN`, `USER` |
| `session` | Active JWT sessions (see migration `3_create_sessions.ts`) |
| `user.role_id` | FK → `role` |
| `api_key.capabilities` | Capability grant for machine access (SPEC-API-001) |

## 9. API specification

### 9.1 Public (no auth)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/session/register` | Self-registration |
| POST | `/api/session/verify-email` | Activate account |
| POST | `/api/session/resend-verification` | Resend verification |
| POST | `/api/session/login` | Issue JWT |
| POST | `/api/users/password/forgot` | Request reset |
| POST | `/api/users/password/reset` | Complete reset |
| GET | `/api/health/liveness` | Process up |
| GET | `/api/health/readiness` | DB reachable |

### 9.2 Authenticated (JWTAdminAndUser)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/session/me` | Current user profile |
| GET | `/api/session/logout` | End session |
| GET/PATCH/DELETE | `/api/users/*` (profile) | Self-service profile |
| GET/POST/DELETE | `/api/users/me/avatar` | Own avatar |
| GET | `/api/me/assets` | Own assigned assets |
| GET | `/api/me/transactions` | Own history |
| GET/POST | `/api/me/handovers/*` | Custody accept flow |

### 9.3 Admin only (JWTAdmin)

All routes under `backend/src/infrastructure/routes/admin/**` and `/api/p/*` prefix in route files.

### 9.4 Credentials shape

JWT validation returns:

```typescript
{
  id: string;      // user id
  email: string;
  role: string;    // 'ADMIN' | 'USER'
}
// API-key auth adds: capabilities, apiKeyId, authMethod: 'api_key'
```

## 10. Email

Not applicable (see [spec-email-notifications.md](spec-email-notifications.md)).

## 11. Frontend

| Mechanism | Location |
|-----------|----------|
| Auth gate | `useRequireAuth` — redirects unauthenticated users to `/login` |
| Admin gate | Each `admin.*` route: `user.roleName !== 'ADMIN'` → redirect away |
| Nav | `NavItems.ts` — `adminOnly: true` items hidden from USER |
| Token storage | `localStorage.auth_token` (Bearer on API calls) |
| Post-login redirect | Admin → `/admin/overview`; USER → `/dashboard` (login route) |

**[CODEBASE FIX]** Non-admins visiting `/admin/*` are bounced (E2E: URL no longer `/admin/assets`, admin heading not shown)—typically to public home, not `/dashboard`.

## 12. Security

| Control | Detail |
|---------|--------|
| Separate JWT secrets | Compromise of user token cannot mint admin token |
| Session invalidation | Logout removes session row; JWT becomes invalid |
| `urlKey: false` | Prevents `?token=` from being treated as JWT (handover magic links) |
| Capability seam | User CRUD requires `users:write` / `users:read` via `app.capability` (no-op for full admin in MVP) |
| Account lockout | Failed login attempts (see spec-authentication.md) |

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `JWT_ADMIN_SECRET_KEY` | Admin JWT signing |
| `JWT_USER_SECRET_KEY` | User JWT signing |
| `ACCOUNT_LOCKOUT_MAX_ATTEMPTS` | Login brute-force limit |
| `ACCOUNT_LOCKOUT_DURATION_MS` | Lockout window |

## 14. Acceptance criteria (E2E)

Derived from `e2e/tests/auth/req-auth-002.spec.ts` and `e2e/tests/personal/req-personal-001.spec.ts`.

### AC-AUTH-002.5 (access control excerpt)

| AC | Given / When / Then |
|----|---------------------|
| AC-002.5.1 | Unauthenticated visitor opens `/dashboard` → redirect to `/login`. |
| AC-002.5.2 | USER opens `/admin/assets` → not on admin page; no admin heading. |
| AC-002.5.3 | USER calls `GET /api/p/assets` with their token → HTTP ≥ 400. |

### REQ-PERSONAL-001 (admin API rejection)

Regular users cannot access admin-only pages/APIs (see spec-personal-workspace.md §14).

## 15. Implementation phases

| Phase | Scope | Status |
|-------|-------|--------|
| P1 | Roles, sessions, JWT strategies | Done |
| P2 | `/api/p` vs `/api/me` split | Done |
| P3 | Frontend guards + E2E | Done |

## 16. Backend layering

- Strategies: `backend/src/infrastructure/strategies/strategies.ts`
- Composite scheme: `JWTAdminAndUser.schema.ts`
- Capability helper: `backend/src/infrastructure/roles/roles.service.ts` + `capabilities.ts`
- Session validation: `domain/session/admin|user/session.domain.ts`

## 17. Open decisions (resolved)

| # | Question | Decision |
|---|----------|----------|
| D1 | Single API with role branching? | **No** — separate `/api/p` and `/api/me` routes |
| D2 | Can admins use personal endpoints? | **Yes** — same JWT strategy, data scoped to caller |
| D3 | Capability tags on all admin routes? | **Incremental** — users/assets tagged; remainder rely on `JWTAdmin` until tagged |

## 18. Documentation updates

- [spec-index.md](spec-index.md) — this document
- [README.md](../README.md) — “Admin vs personal endpoints”
- Referenced by all feature specs’ **Depends on**
- [spec-api-automation.md](spec-api-automation.md) — `JWTAdminOrApiKey`, API keys, unified capability catalog

## 19. Reference: touchpoints

| Area | Location |
|------|----------|
| Route registration | `backend/src/infrastructure/routes/routes.ts` |
| Strategies | `backend/src/infrastructure/strategies/strategies.ts` |
| Capability catalog | `backend/src/infrastructure/roles/capabilities.ts` |
| Nav filtering | `frontend/app/components/NavItems.ts` |
| Session provider | `frontend/app/providers/SessionProvider.tsx` |

## 20. Codebase validation

| # | Note | Detail |
|---|------|--------|
| 1 | Admin-first composite | `JWTAdminAndUser` tries admin JWT before user JWT |
| 2 | Frontend admin check | Pattern duplicated per admin route (`roleName === 'ADMIN'`) |
| 3 | Capability tags partial | Some `/api/p/*` routes still rely on `JWTAdmin` only until `app.capability` is added |

---

*End of specification.*
