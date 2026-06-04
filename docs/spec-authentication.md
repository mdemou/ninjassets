# Feature specification: Authentication and session

- **Document ID:** SPEC-AUTH-001
- **Status:** Implemented
- **Last updated:** 2026-05-31
- **Related requirements (E2E):** REQ-AUTH-001 … REQ-AUTH-003
- **Depends on:** spec-platform-access-model.md, spec-email-notifications.md

---

## 1. Summary

End users and admins **register**, **verify email**, **sign in/out**, and **reset passwords**. Sessions are JWT-backed rows in `session`; inactive users cannot authenticate. Registration uses optional reCAPTCHA (`MOCK_CAPTCHA` in tests).

- **Roles:** New self-registrations receive `USER`; admins are seeded or promoted via admin user management.
- **Post-login routing:** ADMIN → `/admin/overview`; USER → `/dashboard`.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Only verified (`ACTIVE`) users can obtain a session. |
| G2 | Protect login with account lockout after repeated failures. |
| G3 | Password reset via one-time email token. |
| G4 | Issue role-appropriate JWT (admin vs user secret). |

## 3. Non-goals (v1)

- Social login / SSO.
- MFA.
- Magic-link passwordless login (separate from handover custody links).
- Admin self-registration as ADMIN.

## 4. Glossary

| Term | Definition |
|------|------------|
| INACTIVE | Registered but email not verified (or soft-deleted account). |
| ACTIVE | Can log in. |
| Session | DB row + signed JWT returned to client. |

## 5. Personas and user stories

| ID | Story | Priority |
|----|-------|----------|
| US-AU1 | As a visitor, I register and must verify email before login. | Must |
| US-AU2 | As a user, I sign in and out securely. | Must |
| US-AU3 | As a user, I reset a forgotten password via email. | Must |
| US-AU4 | As the platform, I reject inactive accounts and bad credentials. | Must |

## 6. Flows

### 6.1 Registration → verification

```
POST /register → user INACTIVE → email with token
POST /verify-email { token } → ACTIVE
```

### 6.2 Login

```
POST /login → validate password + ACTIVE → JWT in response → localStorage
```

### 6.3 Password reset

```
POST /password/forgot → token row + email
POST /password/reset { token, newPassword } → rotate hash
```

## 7. State and business rules

| Rule | Detail |
|------|--------|
| Unique email | Enforced at registration |
| Password hashing | bcrypt with per-user salt |
| Lockout | In-memory per email; `ACCOUNT_LOCKOUT_*` env |
| Verify token expiry | `EMAIL_VERIFICATION_EXPIRY_HOURS` |
| Reset token expiry | `PASSWORD_RESET_EXPIRY_HOURS` |
| Captcha | Required on register unless `MOCK_CAPTCHA=true` |

## 8. Data model

| Table | Purpose |
|-------|---------|
| `user` | `status`, `hashed`, `salt`, `role_id` |
| `email_verification_token` | Raw token, expiry |
| `password_reset_token` | Raw token, expiry |
| `session` | Active JWT sessions |

## 9. API specification

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/session/register` | No | Create INACTIVE user |
| POST | `/api/session/verify-email` | No | Activate account |
| POST | `/api/session/resend-verification` | No | Resend mail |
| POST | `/api/session/login` | No | Issue JWT |
| GET | `/api/session/public-config` | No | Public flags (`signupEnabled`) for login/register UI |
| GET | `/api/session/logout` | JWTAdminAndUser | Invalidate session |
| GET | `/api/session/me` | JWTAdminAndUser | Profile for SPA |
| POST | `/api/users/password/forgot` | No | Request reset |
| POST | `/api/users/password/reset` | No | Complete reset |

**[CODEBASE FIX]** Registration routes live under `/api/session/*`, not `/api/users/register`.

## 10. Email

See [spec-email-notifications.md](spec-email-notifications.md). Verification and reset templates.

## 11. Frontend

| Route | Purpose |
|-------|---------|
| `/register` | Registration form; loads `public-config`, redirects to `/login` when signup disabled |
| `/verify-email?token=` | Verification UI |
| `/login` | Login; loads `public-config` to show/hide register link; supports return URL for handover |
| `/logout` | Clears session client-side + API |
| `/forgot-password` | Request reset |
| `/reset-password?token=` | New password form |

## 12. Security

| Control | Detail |
|---------|--------|
| Lockout | Brute-force mitigation on login |
| Non-enumeration | Forgot-password generic success message |
| JWT secrets | Separate admin/user keys |
| HTTPS | Production links in email |

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `JWT_ADMIN_SECRET_KEY` / `JWT_USER_SECRET_KEY` | Signing |
| `EMAIL_VERIFICATION_EXPIRY_HOURS` | |
| `PASSWORD_RESET_EXPIRY_HOURS` | |
| `ACCOUNT_LOCKOUT_MAX_ATTEMPTS` | |
| `ACCOUNT_LOCKOUT_DURATION_MS` | |
| `RECAPTCHA_SECRET_KEY` / `MOCK_CAPTCHA` | Bot protection |
| `SIGNUP_ENABLED` | When `false`, registration API and UI are disabled (`public-config.signupEnabled`) |
| `FRONTEND_URL` | Email links |

## 14. Acceptance criteria (E2E)

From `e2e/tests/auth/`.

### REQ-AUTH-001

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Register → success message; user `INACTIVE`. |
| AC-001.2 | INACTIVE user cannot login (HTTP ≥ 400). |
| AC-001.3 | Valid verify token → `ACTIVE`; can login to `/dashboard`. Invalid token → error UI. |

### REQ-AUTH-002

| AC | Given / When / Then |
|----|---------------------|
| AC-002.1 | Admin login → `/admin/overview`; user → `/dashboard`. |
| AC-002.2 | Wrong password → stay on login, HTTP ≥ 400. |
| AC-002.3 | INACTIVE user cannot login. |
| AC-002.4 | Logout → protected pages redirect to login. |
| AC-002.5 | Unauthenticated `/dashboard` → login; USER blocked from admin UI/API. |

### REQ-AUTH-003

| AC | Given / When / Then |
|----|---------------------|
| AC-003.1 | Forgot password → confirmation; token in DB. |
| AC-003.2 | `/reset-password` without token → error. |
| AC-003.3 | Valid reset → new password works; old rejected. |

## 15. Implementation phases

| Phase | Status |
|-------|--------|
| P1 | Registration + verification | Done |
| P2 | Login + lockout + sessions | Done |
| P3 | Password reset + E2E | Done |

## 16. Backend layering

- `domain/session/session.domain.ts` — login, lockout
- `domain/users/registration/` — register, verify
- `domain/users/passwordReset/` — forgot/reset
- Routes: `infrastructure/routes/session/`, `users/registration/`, `users/passwordReset/`

## 17. Open decisions (resolved)

| # | Decision |
|---|----------|
| D1 | Soft delete blocks login | Yes (`INACTIVE`) |
| D2 | E2E reads tokens from DB | Yes when `MOCK_EMAIL` |

## 18. Documentation updates

- README auth bullet list
- spec-platform-access-model.md (JWT strategies)

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `session.domain.ts` | Login, lockout store |
| `registration.route.ts` | Register/verify paths |
| `frontend/app/routes/login.tsx` | Login UI |
| `SessionProvider.tsx` | Token + `/api/session/me` |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | Lockout in-memory | Resets on server restart |
| 2 | Register path | `/api/session/register` |
| 3 | Account delete | Sets INACTIVE (profile spec), not hard delete |

---

*End of specification.*
