# Feature specification: Email and transactional notifications

- **Document ID:** SPEC-EMAIL-001
- **Status:** Implemented
- **Last updated:** 2026-06-02
- **Related requirements (E2E):** REQ-AUTH-001, REQ-AUTH-003, REQ-HANDOVER-001 (email flows; tokens read from DB in tests)
- **Depends on:** spec-webhooks-notifications.md (delivery pipeline)

---

> **Delivery moved to the notification queue (2026-06-02).** The transactional emails below are no
> longer sent inline — they are **reference-based jobs on the unified Redis notification pipeline**
> (SPEC-WEBHOOK-001 §6.3/§7): the domain enqueues `{ userId }` (or asset refs), and the queue
> consumer re-fetches the raw token + recipient from the DB, renders, and sends via `emailService`.
> Secrets never enter Redis; delivery is **at-least-once**. Each trigger maps to a `NotificationType`
> in `NOTIFICATION_CATALOG`. **Exception:** the **handover** email stays inline (its magic-link token
> is hash-only/unrecoverable). The templates and `emailService`/SMTP/`MOCK_EMAIL` behaviour below are
> unchanged — only *who calls them* (the consumer) changed.

## 1. Summary

Outbound email delivers **account verification**, **account activation**, **password reset**, **asset unassignment notices**, and **handover magic links**. When SMTP is not configured or `MOCK_EMAIL=true`, messages are **logged to the console** instead of sent—E2E tests read tokens from the database directly.

- **Transport:** Nodemailer when `SMTP_HOST` is set and `MOCK_EMAIL` is false.
- **Delivery:** via the notification queue + catalog (`NotificationType` → resolver); handover inline.
- **Templates:** HTML + plain text in `backend/src/services/email/templates/`.
- **Links:** Built with `FRONTEND_URL` + path + query token.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Deliver actionable links for verify, reset, and custody flows. |
| G2 | Degrade gracefully to console logging in dev/test. |
| G3 | Never block the primary HTTP operation if email fails (where domain allows). |
| G4 | Use consistent template styling across mail types. |

## 3. Non-goals (v1)

- Per-user email locale (see spec-internationalization.md).
- In-app notification center for email events.
- SMS / push.
- Email open tracking.

## 4. Glossary

| Term | Definition |
|------|------------|
| MOCK_EMAIL | When true, skip SMTP even if configured; log body only. |
| Raw token (auth) | Verification/reset tokens stored **in clear** in DB for lookup. |
| Hashed token (handover) | Handover stores SHA-256 of opaque token (see handover spec). |

## 5. Personas and user stories

| ID | Story | Priority |
|----|-------|----------|
| US-E1 | As a new user, I receive a verification link after registration. | Must |
| US-E2 | As a user, I receive a password reset link. | Must |
| US-E3 | As a handover recipient, I receive a custody confirmation link. | Must |
| US-E4 | As an operator without SMTP, I see email content in server logs. | Should |

## 6. Delivery modes

```
if MOCK_EMAIL → log only
else if SMTP_HOST set → nodemailer.sendMail
else → log only (no transporter)
```

## 7. Templates and triggers

| Template file | Trigger | `NotificationType` (queue) | Link path |
|---------------|---------|----------------------------|-----------|
| `verification.ts` | Registration, resend verification | `email.verification` | `/verify-email?token=` |
| `password-reset.ts` | Forgot password | `email.password_reset` | `/reset-password?token=` |
| `password-reset.ts` | Admin creates user (activation) | `email.account_activation` | `/reset-password?token=` |
| `asset-unassigned.ts` | Asset assignee cleared | `email.asset_unassigned` | (informational) |
| `handover.ts` | Admin starts handover (`sendEmail: true`) | — (inline, not queued) | `/handover/accept?token=` |

Queued types resolve their recipient + raw token in the consumer via `findLatestByUserId` (verification/reset/activation) or `userRepository.findById` (asset-unassigned). Handover renders inline at creation time with the raw token.

**[CODEBASE FIX]** Auth tokens use raw storage in `email_verification_token` / `password_reset_token`. Handover intentionally hashes tokens—do not copy auth pattern for handover.

## 8. Data model

| Table | Token storage |
|-------|---------------|
| `email_verification_token` | Raw token, `fk_user_id`, expiry |
| `password_reset_token` | Raw token, `fk_user_id`, expiry |
| `handover` | `token_hash` only (see handover spec) |

## 9. API specification

Email is sent from **domain/controllers**, not dedicated mail routes. Public endpoints that **cause** email:

| Method | Path | Email side effect |
|--------|------|-------------------|
| POST | `/api/session/register` | Verification |
| POST | `/api/session/resend-verification` | Verification |
| POST | `/api/users/password/forgot` | Reset (always returns success message) |
| POST | `/api/p/assets/{assetId}/handovers` | Handover (when `sendEmail: true`) |

## 10. Email

### 10.1 Service API

`emailService.sendMail({ to, subject, html, text })` in `backend/src/services/email/email.service.ts`.

### 10.2 Locale

Server-rendered templates use a **fixed language** (aligned with default verification copy). Frontend `translations.ts` does not apply to email bodies in v1.

### 10.3 E2E strategy

| Flow | Test approach |
|------|---------------|
| Auth verify/reset | Read token from Postgres (`email_verification_token`, `password_reset_token`) |
| Handover | Prefer `sendEmail: false` + `acceptUrl` in API response, or DB hash lookup per handover spec |

## 11. Frontend

| Route | Purpose |
|-------|---------|
| `/verify-email` | POST token to API, show success/error |
| `/forgot-password` | Request reset email |
| `/reset-password` | Submit new password with token query param |
| `/handover/accept` | Custody confirmation (see handover spec) |

## 12. Security

| Control | Detail |
|---------|--------|
| Token expiry | `EMAIL_VERIFICATION_EXPIRY_HOURS`, `PASSWORD_RESET_EXPIRY_HOURS`, `HANDOVER_TOKEN_EXPIRY_HOURS` |
| Forgot password | Non-enumerating response (same message whether email exists) |
| HTTPS | Required for production link handling |
| Secrets | SMTP credentials via env only |

## 13. Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `SMTP_HOST` | empty | If empty → console mode |
| `SMTP_PORT` | 587 | |
| `SMTP_SECURE` | false | |
| `SMTP_USER` / `SMTP_PASS` | | Auth |
| `SMTP_FROM` | noreply@example.com | From header |
| `MOCK_EMAIL` | false | Force log-only |
| `FRONTEND_URL` | http://localhost:3000 | Link base |
| `EMAIL_VERIFICATION_EXPIRY_HOURS` | 24 | |
| `PASSWORD_RESET_EXPIRY_HOURS` | 1 | |
| `HANDOVER_TOKEN_EXPIRY_HOURS` | 72 | Handover TTL |

## 14. Acceptance criteria (E2E)

Covered indirectly in auth and handover specs:

| REQ | Email-related AC |
|-----|------------------|
| REQ-AUTH-001 | Register → verify link activates account |
| REQ-AUTH-003 | Forgot → reset link rotates password |
| REQ-HANDOVER-001 | Checkout email/link path (or `sendEmail: false` + `acceptUrl`) |

## 15. Implementation phases

| Phase | Status |
|-------|--------|
| P1 | email.service + verification/reset templates | Done |
| P2 | Handover template | Done |
| P3 | asset-unassigned template | Done |

## 16. Backend layering

- Service: `backend/src/services/email/email.service.ts`
- Templates: `backend/src/services/email/templates/*.ts`
- Callers: registration domain, password reset domain, handovers domain, assets domain

## 17. Open decisions (resolved)

| # | Decision |
|---|----------|
| D1 | Console when no SMTP | Yes |
| D2 | Per-user email language | Deferred (fixed server copy) |

## 18. Documentation updates

- Referenced by spec-authentication.md, spec-handover-magic-link.md
- `.env.example` SMTP block

## 19. Reference: touchpoints

| File | Role |
|------|------|
| `email.service.ts` | Transport |
| `templates/verification.ts` | Verify mail |
| `templates/password-reset.ts` | Reset mail |
| `templates/handover.ts` | Custody mail |
| `templates/asset-unassigned.ts` | Unassign notice |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | Two token storage models | Raw (auth) vs hashed (handover) |
| 2 | MOCK_EMAIL in E2E | Playwright webServer sets `MOCK_EMAIL=true` |
| 3 | Fail-open logging | Missing SMTP never throws at startup |

---

*End of specification.*
