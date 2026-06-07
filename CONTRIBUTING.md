# Contributing to Ninjasset

Thank you for your interest in contributing. Ninjasset is MIT-licensed; by submitting a pull request, you agree that your contributions are licensed under the same terms (see [LICENSE](LICENSE)).

## Before you start

1. **Search existing issues and pull requests** — Avoid duplicate work; discuss large changes in an issue first if you are unsure about direction.
2. **Set up locally** — Follow [README.md](README.md#quick-start) (Docker for PostgreSQL/Redis, backend on `:3001`, frontend on `:3000`, `backend/.env` from `backend/.env.example`).
3. **Never commit secrets** — Do not add `.env` files, API keys, passwords, or real customer data. Use placeholders in `*.env.example` only.

## How we work

Ninjasset is **spec-driven**. Feature behavior, API contracts, and acceptance criteria live in [docs/](docs/). Code changes should match the relevant spec (or update the spec in the same PR when behavior intentionally changes).

| Topic | Guide |
| --- | --- |
| Spec registry | [docs/spec-index.md](docs/spec-index.md) |
| Backend structure | [backend/docs/backend-layering.md](backend/docs/backend-layering.md) |
| Database migrations | [backend/docs/database-migrations.md](backend/docs/database-migrations.md) |
| Frontend layout | [frontend/README.md](frontend/README.md) |
| E2E testing | [docs/e2e-testing.md](docs/e2e-testing.md) · [e2e/README.md](e2e/README.md) |

### New features or behavior changes

1. Find or add the spec under `docs/` (see [spec-index.md](docs/spec-index.md) and the outline in [spec-handover-magic-link.md](docs/spec-handover-magic-link.md)).
2. Implement in the appropriate layer:
   - **Backend** — Controllers (HTTP only) → domains (logic) → repositories (DB/services). See [backend layering](backend/docs/backend-layering.md).
   - **Frontend** — React Router SPA; follow patterns in neighboring routes and components.
3. Add or update **E2E tests** when user-visible behavior changes (see below).
4. Run lint and the agent E2E suite before opening a PR.

### Bug fixes

A minimal fix with a focused test is ideal. If the bug is not covered by E2E yet, add a test in the feature folder that would have caught it.

## End-to-end tests

Behavior changes should include Playwright coverage when practical. Tests run on an **isolated stack** (frontend `:4000`, backend `:4001`, database `ninjasset_test`) so development data is never touched.

```bash
cd e2e
npm install
npm run install:browsers   # first time only
npm run test:agent         # required before PRs (agents & CI-style runs)
```

For local debugging: `npm test`, `npm run test:ui`, or `npm run test:headed`. Full conventions (requirement IDs, file layout, seeding, DB access): [docs/e2e-testing.md](docs/e2e-testing.md).

Requirement-backed specs use names like `req-<feature>-NNN.spec.ts` and JSDoc headers linking to `REQ-*` / `AC-*` identifiers that mirror the feature spec.

## Lint and format

From each package directory:

```bash
cd backend && npm run lint
cd frontend && npm run lint
```

Optional formatting (run only on paths you changed):

```bash
cd backend && npm run format
cd frontend && npm run format
```

## Database changes

Schema changes need a Knex migration in `backend/migrations/`. Follow [backend/docs/database-migrations.md](backend/docs/database-migrations.md). Include rollback considerations and note any seed/demo impact in the PR description.

## Pull request checklist

- [ ] Linked issue (if any) and a clear summary of **what** changed and **why**
- [ ] Relevant spec read or updated in `docs/`
- [ ] E2E added/updated for behavior changes; `cd e2e && npm run test:agent` passes
- [ ] `npm run lint` clean in `backend/` and `frontend/` for touched areas
- [ ] No secrets, `.env`, or personal data in the diff
- [ ] Screenshots or short notes for notable UI changes (optional but helpful)

Keep PRs **focused** — one feature or fix per PR is easier to review than a large mixed diff.

## Commit messages

Use clear, imperative subjects (e.g. `Add dismiss signature to alert bell`, `Fix handover token expiry on return`). Reference spec or requirement IDs when helpful (`REQ-HANDOVER-003`).

## Questions

Open an issue in the repository tracker for bugs, feature ideas, or design questions.

For security vulnerabilities, do **not** open a public issue; report them privately to the maintainers (add a `SECURITY.md` policy when the repo is public).

## License and attribution

Contributions are released under the [MIT License](LICENSE). Redistributions must retain copyright and license notices as described in [NOTICE](NOTICE).
