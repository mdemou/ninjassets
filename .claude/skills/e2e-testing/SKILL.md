---
name: e2e-testing
description: >-
  How to run and extend Playwright E2E tests in this repo. Use when running,
  debugging, or adding end-to-end tests, or when validating UI/API flows through
  the browser.
---

**Read `docs/e2e-testing.md` first — it is the canonical guide** (architecture, prerequisites, setup, what runs on each phase, ports, DB/Redis isolation).

**Script reference** (`db:setup`, `test:agent`, etc.): see `e2e/README.md`.

### Automated agents (Claude Code, Cursor, other LLMs)

- **Always** run the suite from `e2e/` with: `npm run test:agent`. That script sets `E2E_AGENT=1`, minimal logs, `--max-failures=1`, and the agent summary reporter.

Place new tests under `e2e/tests/` as `*.spec.ts`; `baseURL` is the test frontend (port 4000). Details are in `docs/e2e-testing.md`.
