# Feature specification: Admin user management

- **Document ID:** SPEC-USER-001
- **Status:** Implemented
- **Last updated:** 2026-06-04
- **Related requirements (E2E):** REQ-USER-001
- **Depends on:** spec-platform-access-model.md, spec-asset-management.md, spec-email-notifications.md

---

## 1. Summary

Admins with the **`users:write`** capability create, edit, and delete platform users (`users:read` for list/detail). In MVP every admin holds `*`, so access is effectively role-gated via `JWTAdmin`. Admin-created users start **INACTIVE** and receive a **verification email** (same activation path as self-registration). User detail pages show assigned assets and transaction history.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Central user directory for assignment targets. |
| G2 | Promote/demote ADMIN vs USER safely. |
| G3 | Deactivate or remove users without breaking audit readability. |
| G4 | Capability-gated mutations on user records (P2 when scoped keys ship). |

## 3. Non-goals (v1)

- Fine-grained custom roles beyond ADMIN/USER.
- Bulk user import (see [spec-import-export.md](spec-import-export.md) — P2).

## 7. State and business rules

| Rule | Detail |
|------|--------|
| Admin create | User INACTIVE + verification email |
| Role change | Updates `role_id` |
| Delete | Hard delete or soft per domain (E2E expects removal from list) |
| List | Paginated search like other admin lists |

## 9. API specification

| Method | Path | Capability | Purpose |
|--------|------|------------|---------|
| GET | `/api/p/users` | `users:read` | List |
| GET | `/api/p/users/{id}` | `users:read` | Detail |
| POST | `/api/p/users` | `users:write` | Create |
| PATCH | `/api/p/users/{id}` | `users:write` | Update role, status, display name |
| PATCH | `/api/p/users/{id}/password` | `users:write` | Set a new password (no current-password check; admin-only) |
| DELETE | `/api/p/users/{id}` | `users:write` | Delete |
| GET | `/api/p/users/{id}/assets` | `users:read` | User's assigned assets |
| GET | `/api/p/users/{id}/transactions` | `users:read` | User-scoped history |

## 11. Frontend

| Route | Purpose |
|-------|---------|
| `/admin/users` | User table, create/edit/delete, **Change password** modal (password icon per row) |
| `/admin/users/{userId}` | Detail: assets + history |

## 14. Acceptance criteria (E2E)

From `e2e/tests/users/req-user-001.spec.ts`:

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Create user → listed; status INACTIVE. |
| AC-001.2 | Edit display name and role → persisted. |
| AC-001.3 | Delete user → removed from list/DB. |

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `admin/users/users.route.ts` | Routes (`app.capability`) |
| `users.domain.ts` | Business rules |
| `admin.users.tsx` | List UI |

---

*End of specification.*
