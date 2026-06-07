# Specification index (ninjasset ITAM)

Central registry of feature specifications. Each spec follows the numbered outline in [spec-handover-magic-link.md](spec-handover-magic-link.md) (§1–§20).

## How to write specs

1. Header: Document ID, Status, Last updated, Related E2E requirements, Depends on.
2. Describe the **implemented** system; validate against domain, routes, migrations, and UI.
3. §14 must mirror every `AC-*` block in the linked E2E files (Draft specs may use **TBD** placeholders until E2E exists).
4. Record codebase corrections in §20 (`[CODEBASE FIX]`).

## Registry

| Document ID | Spec | Status | E2E requirements | Depends on | Summary |
|-------------|------|--------|------------------|------------|---------|
| SPEC-PLATFORM-001 | [spec-platform-access-model.md](spec-platform-access-model.md) | Implemented | (cross-cutting) | — | Roles, JWT strategies, `/api/p/*` vs `/api/me/*`, capabilities, route guards |
| SPEC-EMAIL-001 | [spec-email-notifications.md](spec-email-notifications.md) | Implemented | — | — | SMTP / console mail, templates, token delivery, `MOCK_EMAIL` |
| SPEC-I18N-001 | [spec-internationalization.md](spec-internationalization.md) | Implemented | REQ-PROFILE-001 (language AC) | — | EN/ES UI via `translations.ts`; email locale policy |
| SPEC-AUTH-001 | [spec-authentication.md](spec-authentication.md) | Implemented | REQ-AUTH-001 … REQ-AUTH-003 | platform, email | Registration, verification, session, password reset, lockout |
| SPEC-LDAP-001 | [spec-ldap-authentication.md](spec-ldap-authentication.md) | Draft | REQ-LDAP-001 (TBD) | platform, auth, user | LDAP authentication via search-then-bind; JIT users as USER; generic external-provider seam (OAuth2-ready) |
| SPEC-OIDC-001 | [spec-oidc-authentication.md](spec-oidc-authentication.md) | Draft | REQ-OIDC-001 (TBD) | platform, auth, user, ldap | OIDC SSO (Authorization Code + PKCE); JIT users as `oauth`; BFF callback; shares LDAP identity columns |
| SPEC-PROFILE-001 | [spec-profile-settings.md](spec-profile-settings.md) | Implemented | REQ-PROFILE-001 | platform, i18n | Settings: profile, password, language, avatar, delete account |
| SPEC-ASSET-001 | [spec-asset-management.md](spec-asset-management.md) | Implemented | REQ-ASSET-001 | platform, sites, catalog | Asset CRUD, lifecycle, assignment, search, warranty/return dates |
| SPEC-SITE-001 | [spec-site-location-management.md](spec-site-location-management.md) | Implemented | REQ-SITE-001 | platform | Sites CRUD, maps, delete with linked assets |
| SPEC-CATALOG-001 | [spec-itam-catalog.md](spec-itam-catalog.md) | Implemented | REQ-CATALOG-001 … REQ-CATALOG-002 | platform | Manufacturers and vendors, images, in-use delete guard |
| SPEC-CATEGORY-002 | [spec-asset-categories.md](spec-asset-categories.md) | Implemented | REQ-CATEGORY-003 | platform, asset-management, catalog | Asset categories + per-category custom fields (JSONB), dynamic asset form |
| SPEC-ASSET-002 | [spec-asset-media-qr.md](spec-asset-media-qr.md) | Implemented | REQ-ASSET-002, admin-qr-print | asset-management | Asset images, QR codes, label print page |
| SPEC-USER-001 | [spec-admin-user-management.md](spec-admin-user-management.md) | Implemented | REQ-USER-001 | platform, asset-management | Admin user CRUD, change password, capabilities, user detail views |
| SPEC-DASH-001 | [spec-dashboards-and-audit-history.md](spec-dashboards-and-audit-history.md) | Implemented | REQ-DASH-001 | platform, asset-management, personal-workspace | Admin overview, audit log, personal history (`home.tsx`) |
| SPEC-PERSONAL-001 | [spec-personal-workspace.md](spec-personal-workspace.md) | Implemented | REQ-PERSONAL-001 | platform, asset-management, handover | Personal dashboard (`home.tsx` at `/dashboard`), My Assets, access control |
| SPEC-ALERT-001 | [spec-data-quality-and-alerts.md](spec-data-quality-and-alerts.md) | Implemented | REQ-ALERT-001 … REQ-ALERT-003 | platform, asset-management | Data-quality rules, reports, bell, overview attention, signature-based dismissals |
| SPEC-HANDOVER-001 | [spec-handover-magic-link.md](spec-handover-magic-link.md) | Implemented | REQ-HANDOVER-001 … REQ-HANDOVER-006 | asset-management, email | Verified custody via magic-link handover |
| SPEC-CUSTODY-DOC-001 | [spec-custody-receipt.md](spec-custody-receipt.md) | Implemented | REQ-CUSTODY-DOC-001 | asset-management, handover | Printable custody PDF, signed upload, asset detail preview |
| SPEC-BULK-ASSIGN-001 | [spec-bulk-assign.md](spec-bulk-assign.md) | Implemented | REQ-BULK-ASSIGN-001 | asset-management, handover, custody-receipt | Bulk checkout/return wizard from the assets list; multi-asset custody PDF |
| SPEC-PUBLIC-001 | [spec-public-landing.md](spec-public-landing.md) | Implemented | smoke.spec.ts | i18n | Public `/` marketing landing; docs at `/docs`; auth at `/login` |
| SPEC-OPS-001 | [spec-health-operations.md](spec-health-operations.md) | Implemented | smoke.spec.ts | platform | Liveness/readiness, Redis-backed periodic scheduler, E2E test stack |
| SPEC-API-001 | [spec-api-automation.md](spec-api-automation.md) | Implemented (MVP) | REQ-API-001 | platform | Bearer API keys, `JWTAdminOrApiKey`, machine access to `/api/p/*`; unified permission catalog (roles + keys), idempotency, regenerate |
| SPEC-IMPORT-001 | [spec-import-export.md](spec-import-export.md) | Implemented (MVP+P2) | REQ-IMPORT-001 / REQ-IMPORT-002 | platform, API, asset, site, catalog, user, handover | Bulk import/export hub, async jobs, CSV/XLSX/JSON |
| SPEC-WEBHOOK-001 | [spec-webhooks-notifications.md](spec-webhooks-notifications.md) | Implemented | REQ-WEBHOOK-001 | platform, asset, handover, alerts, user, import-export | Central domain event catalog + event bus; admin-managed Slack/Discord/Telegram webhook destinations with per-destination event subscriptions |
| SPEC-BRANDING-001 | [spec-app-branding.md](spec-app-branding.md) | Draft | REQ-BRANDING-001 (TBD) | platform, public-landing, email, custody-receipt | Admin-configurable logo, app name, tagline, and primary/secondary colors across UI, emails, PDFs, and QR codes |
| SPEC-AI-ASSISTANT-001 | [spec-ai-assistant.md](spec-ai-assistant.md) | Draft | REQ-AI-ASSISTANT-001 (TBD) | platform, i18n, api-automation | Admin-only RAG chatbot; backend proxy to aiagent; EN/ES; v2 agent actions |

## E2E folder → spec map

| `e2e/tests/` folder | Spec |
|---------------------|------|
| `auth/` | spec-authentication.md |
| `ldap/` (planned) | spec-ldap-authentication.md |
| `oidc/` (planned) | spec-oidc-authentication.md |
| `profile/` | spec-profile-settings.md |
| `assets/` | spec-asset-management.md, spec-asset-media-qr.md, spec-bulk-assign.md |
| `sites/` | spec-site-location-management.md |
| `catalog/` | spec-itam-catalog.md, spec-asset-categories.md |
| `users/` | spec-admin-user-management.md |
| `dashboards/` | spec-dashboards-and-audit-history.md |
| `personal/` | spec-personal-workspace.md |
| `alerts/` | spec-data-quality-and-alerts.md |
| `handovers/` | spec-handover-magic-link.md |
| `custody-documents/` | spec-custody-receipt.md |
| `admin-qr-print.spec.ts` | spec-asset-media-qr.md |
| `smoke.spec.ts` | spec-health-operations.md |
| `api-automation/` | spec-api-automation.md |
| `import-export/` | spec-import-export.md |
| `webhooks/` | spec-webhooks-notifications.md |
| `branding/` (planned) | spec-app-branding.md |
| `ai-assistant/` (planned) | spec-ai-assistant.md |

---

*Last updated: 2026-06-07*
