# E2E Testing

End-to-end tests use [Playwright](https://playwright.dev/) and live in the `e2e/` directory at the project root.

## Agents and automation

Automated agents should always run the suite through the agent script:

```bash
cd e2e
npm run test:agent
```

`npm run test:agent` enables `E2E_AGENT=1`, uses a compact reporter, stops after the first failure, and suppresses dev-server logs. Humans can use `npm test`, `npm run test:ui`, and `npm run test:headed` when debugging locally.

## Architecture

Tests run against dedicated infrastructure so they do not touch local development state.

```text
Browser
  -> Frontend dev server  (localhost:4000)
      -> Vite proxy (/api/*)
          -> Backend dev server (localhost:4001)
              -> PostgreSQL: ninjasset_test
```

The test servers use ports `4000` and `4001`, leaving the normal development ports `3000` and `3001` free.

## Prerequisites

- Docker Compose services must be running with PostgreSQL reachable on `DB_HOST` / `DB_PORT`.
- `backend/` and `frontend/` dependencies must be installed.
- The root `.env` file must exist. Copy `.env.example` if needed.

## Setup

```bash
cd e2e
npm install
npm run install:browsers
```

## Running Tests

```bash
cd e2e

# Agents / automation
npm run test:agent

# Local human runs
npm test
npm run test:ui
npm run test:headed
```

## What Happens On Each Run

The npm script runs `scripts/create-test-db.ts` before Playwright starts web servers. It drops and recreates `ninjasset_test`, enables `uuid-ossp`, runs all backend Knex migrations with `backend/knexfile.test.cjs`, and exits before the browser launches.

Playwright then starts:

- The backend on `localhost:4001`, using `DB_NAME=ninjasset_test`, `DATABASE_URL` for the test database, `MOCK_EMAIL=true`, and `MOCK_CAPTCHA=true`.
- The frontend on `localhost:4000`, with `API_URL=http://localhost:4001` so `/api/*` calls go to the test backend.

After tests, `global-teardown.ts` terminates remaining connections to `ninjasset_test`, and drops the test database.

## Smoke Tests

`e2e/tests/smoke.spec.ts` verifies the basic request chain:

- Frontend home page responds.
- Frontend login page responds.
- Backend liveness works through the frontend proxy.
- Backend readiness can reach PostgreSQL.

## Coverage

The suite is requirement-backed and exercises the whole platform built so far. Tests are grouped by feature folder under `e2e/tests/`. Feature specifications: [spec-index.md](spec-index.md).

| Folder | Requirements | Spec | What it covers |
| --- | --- | --- | --- |
| `auth/` | `REQ-AUTH-001..003` | [spec-authentication.md](spec-authentication.md) | Registration + email verification, login/logout, invalid-credential and inactive-account handling, password reset |
| `profile/` | `REQ-PROFILE-001` | [spec-profile-settings.md](spec-profile-settings.md) | Settings page: display-name update, password change, language, account deletion, avatar upload |
| `assets/` | `REQ-ASSET-001..002` | [spec-asset-management.md](spec-asset-management.md), [spec-asset-media-qr.md](spec-asset-media-qr.md) | Admin CRUD, the `STOCK`/`ASSIGNED` lifecycle + assignee rule, omnipresent search, image upload, QR codes |
| `sites/` | `REQ-SITE-001` | [spec-site-location-management.md](spec-site-location-management.md) | CRUD with coordinates, Leaflet map rendering, delete-with-linked-assets |
| `catalog/` | `REQ-CATALOG-001..002` | [spec-itam-catalog.md](spec-itam-catalog.md) | Manufacturer and vendor CRUD, image upload, the "in use" delete guard |
| `users/` | `REQ-USER-001` | [spec-admin-user-management.md](spec-admin-user-management.md) | Admin user-management CRUD |
| `dashboards/` | `REQ-DASH-001` | [spec-dashboards-and-audit-history.md](spec-dashboards-and-audit-history.md) | Admin overview, personal dashboard, transactions/audit log |
| `alerts/` | `REQ-ALERT-001..003` | [spec-data-quality-and-alerts.md](spec-data-quality-and-alerts.md) | Warranty/return dates, data-quality reports, overview attention, notification bell, RBAC, signature-based discard/undo |
| `personal/` | `REQ-PERSONAL-001` | [spec-personal-workspace.md](spec-personal-workspace.md) | My Assets view and non-admin access control |
| `handovers/` | `REQ-HANDOVER-001..006` | [spec-handover-magic-link.md](spec-handover-magic-link.md) | Verified checkout/return, blocking, token/identity, admin override, personal pending panel |
| `custody-documents/` | `REQ-CUSTODY-DOC-001` | [spec-custody-receipt.md](spec-custody-receipt.md) | Printable custody PDF, signed upload, preview on asset detail |
| `webhooks/` | `REQ-WEBHOOK-001` | [spec-webhooks-notifications.md](spec-webhooks-notifications.md) | Event catalog + Slack/Discord/Telegram destinations: CRUD, masked target, per-destination subscription filtering, disabled = no delivery, failure isolation, admin-only (mock receiver) |
| `api-automation/` | `REQ-API-001` | [spec-api-automation.md](spec-api-automation.md) | Bearer API keys, `JWTAdminOrApiKey`, machine access to `/api/p/*` |
| `import-export/` | `REQ-IMPORT-001..002` | [spec-import-export.md](spec-import-export.md) | Template download, upload → map → dry-run → commit (asset create), FULL export round-trips `id`, duplicate-serial dry-run error, admin-only gate |
| `admin-qr-print.spec.ts` | — | [spec-asset-media-qr.md](spec-asset-media-qr.md) | QR label print page |
| `smoke.spec.ts` | — | [spec-health-operations.md](spec-health-operations.md) | Infrastructure connectivity |

## Adding Tests

Place tests under `e2e/tests/`, grouped by feature folder. Requirement-backed tests use this naming style:

```text
e2e/tests/<feature>/
  req-<feature-code>-001.spec.ts
  req-<feature-code>-002.spec.ts
```

Each test file starts with a JSDoc block naming the requirement and user story, then groups tests by acceptance criteria:

```typescript
import { expect, test } from "@playwright/test";

/**
 * REQ-EXAMPLE-001: Example behavior
 *
 * "As a user, I can understand the e2e test shape."
 */

test.describe("REQ-EXAMPLE-001: Example behavior", () => {
  test.describe("AC-EXAMPLE-001.1: Acceptance criterion", () => {
    test("does the expected thing", async ({ page }) => {
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);
    });
  });
});
```

## Conventions

- **Self-contained files.** Each spec owns its setup — it connects to the test database with `pg`, seeds the rows it needs in `beforeEach`, and cleans them up in `afterEach`. There is no shared fixture module, so a spec can be read, run, or removed on its own.
- **Seed login users as `ACTIVE`.** Registration leaves a user `INACTIVE` until verified, so specs that only need to log in insert the user (with a bcrypt hash) directly with `status = 'ACTIVE'`.
- **Unique, prefixed data.** Emails, serial numbers, and entity names are unique per file so reruns and the shared database never collide.
- **Mocked captcha and email.** The backend runs with `MOCK_CAPTCHA=true` and `MOCK_EMAIL=true`. Verification / password-reset tokens are read from the `email_verification_token` / `password_reset_token` tables rather than an inbox.
- **Image uploads use the real endpoints.** Specs POST a PNG buffer to the upload endpoint via Playwright's API request context with a `Bearer` token, instead of driving the crop UI.

## Direct Database Access

Tests that need to seed or inspect data import `pg` and connect to `TEST_DB_NAME` from `e2e/config.ts`. Keep direct DB writes scoped to a single test with `beforeEach` / `afterEach` cleanup.
