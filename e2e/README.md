# End-to-end tests

Playwright runs against an isolated test stack: PostgreSQL database `ninjasset_test`, backend on port `4001`, and frontend on port `4000`.

Install once:

```bash
npm install
npm run install:browsers
```

Scripts:

- `npm run db:setup` provisions the test database without running tests.
- `npm run test:agent` is for automated agents. It uses compact output and stops after the first failure.
- `npm test` runs the full suite headless.
- `npm run test:ui` opens Playwright UI.
- `npm run test:headed` runs with a visible browser.
- `npm run test:report` serves the latest HTML report.

Connection defaults come from `e2e/.env` (`DB_*` and `REDIS_*`, matching your local Postgres/Redis). See `docs/e2e-testing.md` for architecture and a deeper walk-through.

## Test layout

Tests live under `tests/`, grouped by feature folder, and follow a requirement-backed naming style (`req-<feature-code>-NNN.spec.ts`):

```text
tests/
  smoke.spec.ts                     infrastructure connectivity
  admin-qr-print.spec.ts            QR label print page
  auth/req-auth-001..003.spec.ts    registration/verification, login/logout, password reset
  profile/req-profile-001.spec.ts   settings: profile, password, language, delete, avatar
  assets/req-asset-001..002.spec.ts admin CRUD + lifecycle + search; image + QR
  sites/req-site-001.spec.ts        CRUD, Leaflet map, delete-with-assets
  catalog/req-catalog-001..002.spec.ts manufacturers and vendors CRUD + delete guard
  users/req-user-001.spec.ts        admin user management CRUD
  dashboards/req-dash-001.spec.ts   admin overview, personal dashboard, history/audit log
  alerts/req-alert-001..002.spec.ts warranty/return dates, data-quality, bell, reports
  personal/req-personal-001.spec.ts My Assets view + non-admin access control
  handovers/req-handover-001..005.spec.ts verified custody: checkout, return, blocking, tokens, admin override
```

## Conventions

- **Self-contained files.** Each spec owns its setup: it connects to `ninjasset_test` with `pg`, seeds exactly the rows it needs in `beforeEach`, and removes them in `afterEach`. There is no shared fixture module, so any spec can be read, run, or deleted on its own.
- **Seed users directly as `ACTIVE`.** Registration leaves a user `INACTIVE` until the email is verified, so tests that just need to log in insert the user (with a bcrypt hash) straight into the database with `status = 'ACTIVE'`. Use a unique email/prefix per file and clean it up afterwards.
- **Unique, prefixed test data.** Serial numbers, emails, and entity names are unique per file (e.g. `e2e-asset-…`) so reruns and the shared database never collide. The runner uses a single worker, but cleanup still matters.
- **Mocked captcha and email.** The backend runs with `MOCK_CAPTCHA=true` and `MOCK_EMAIL=true`. Email is logged, not sent — so verification and password-reset tests read the token from the `email_verification_token` / `password_reset_token` tables instead of an inbox. Handover specs create handovers with `sendEmail: false` and use the `acceptUrl` from the API response.
- **Image uploads go through the real endpoints.** The cropping UI is not driven directly; specs POST a real PNG buffer to the upload endpoint (e.g. `/api/p/assets/{id}/image`) via Playwright's API request context with a `Bearer` token, then assert the stored image is served back.
- **Requirement headers.** Each file opens with a JSDoc block naming the requirement and user story, and groups tests by acceptance criterion (`AC-…`) describe blocks.
