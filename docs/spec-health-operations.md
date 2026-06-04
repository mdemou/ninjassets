# Feature specification: Health checks and E2E operations

- **Document ID:** SPEC-OPS-001
- **Status:** Implemented
- **Last updated:** 2026-06-04
- **Related requirements (E2E):** smoke.spec.ts
- **Depends on:** spec-platform-access-model.md

---

## 1. Summary

Operational endpoints verify the API process and database connectivity. Playwright **smoke** tests exercise the full stack (frontend proxy → backend → Postgres). E2E runs use an isolated **`ninjasset_test`** database recreated per run.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Orchestrator-friendly liveness (process up). |
| G2 | Readiness includes DB ping. |
| G3 | Smoke tests catch broken proxy or DB before feature suite. |
| G4 | E2E never mutates developer `ninjasset_dev` DB. |

## 3. Non-goals (v1)

- Metrics / Prometheus.
- Deep dependency checks (SMTP, disk space, Redis ping in readiness).

## 4. Periodic maintenance (Redis-backed scheduler)

A single in-process **scheduler** (`backend/src/infrastructure/proceses/scheduler.ts`) drives all periodic jobs. One ticker runs registered tasks; each job's `lastRunAt` is stored in Redis so **process restarts do not reset cadence**, and a SETNX lock (per task, unless disabled) keeps work **single-runner across API instances**.

If Redis is unavailable, the scheduler falls back to an in-memory `lastRun` map and skips locking — jobs still run (same posture as `importExportWorker.ts`).

Registered at boot in `init.ts`:

| Task name | Default cadence | Gated by | Purpose |
|-----------|-----------------|----------|---------|
| `token-cleanup` | 6 h | always | Purge expired email-verification and password-reset tokens |
| `api-retention-purge` | 6 h | always | Trim old API access logs (`API_ACCESS_LOG_RETENTION_DAYS`) |
| `notification-reaper` | 15 s | `NOTIFICATIONS_ENABLED` | Reclaim stranded notification jobs (`lock: false`) |
| `data-quality-scan` | 1 h (`WEBHOOK_ALERT_SCAN_INTERVAL_MS`) | `WEBHOOKS_ENABLED` | Publish `alert.raised` for new hygiene issues (webhook pipeline) |
| `import-export-sweep` | 30 s (`IMPORT_SAFETY_SWEEP_MS`) | `IMPORT_EXPORT_ENABLED` | Drain import/export jobs missed while Redis was down |
| `import-artifact-purge` | 6 h | always | Delete import/export files past `IMPORT_ARTIFACT_RETENTION_DAYS` |

Configuration (root `.env`): `MAINTENANCE_TICK_MS`, `MAINTENANCE_LOCK_TTL_SEC`, `MAINTENANCE_KEY_PREFIX`, `TOKEN_CLEANUP_INTERVAL_MS`, `API_RETENTION_PURGE_INTERVAL_MS`, `IMPORT_ARTIFACT_PURGE_INTERVAL_MS`, plus feature-specific intervals above.

**Note:** Data-quality **rules** for the UI and reports are computed on read ([spec-data-quality-and-alerts.md](spec-data-quality-and-alerts.md)); only the webhook **scan** runs on this schedule.

## 9. API specification

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/__health/liveness` | None | 200 if server running |
| GET | `/api/__health/readiness` | None | 200 if Postgres reachable |

**[CODEBASE FIX]** Paths use `/api/__health/*` (double underscore), not `/api/health/*` as in some README snippets.

Proxied through frontend dev server as `/api/__health/...` → backend.

## 6. E2E stack (reference)

```text
Browser → localhost:4000 (frontend)
       → proxy /api/* → localhost:4001 (backend)
       → PostgreSQL ninjasset_test
```

| Env (E2E) | Value |
|-----------|-------|
| `MOCK_EMAIL` | true |
| `MOCK_CAPTCHA` | true |
| `DB_NAME` | ninjasset_test |

Setup: `e2e/scripts/create-test-db.ts` migrates before Playwright; teardown drops DB.

## 14. Acceptance criteria (E2E)

From `e2e/tests/smoke.spec.ts`:

| AC | Given / When / Then |
|----|---------------------|
| S1 | `GET /` → 200. |
| S2 | `GET /login` → 200. |
| S3 | `GET /api/__health/liveness` via frontend → 200. |
| S4 | `GET /api/__health/readiness` → 200. |

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `DB_*` / `DATABASE_URL` | Readiness probe (Postgres) |
| `MAINTENANCE_*`, `TOKEN_CLEANUP_INTERVAL_MS`, `API_RETENTION_PURGE_INTERVAL_MS`, `IMPORT_ARTIFACT_PURGE_INTERVAL_MS` | Scheduler ticker, lock TTL, key prefix, per-job cadences |
| `NOTIFICATIONS_REAPER_INTERVAL_MS` | Notification reaper cadence |
| `WEBHOOK_ALERT_SCAN_INTERVAL_MS` | Data-quality webhook scan |
| `IMPORT_SAFETY_SWEEP_MS` | Import/export safety sweep |

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `health.route.ts` | Route definitions |
| `health.controller.ts` | Handlers |
| `proceses/scheduler.ts` | Redis-backed periodic task runner |
| `proceses/init.ts` | Registers scheduler tasks at boot |
| `docs/e2e-testing.md` | Full E2E architecture |
| `e2e/playwright.config.ts` | webServer env |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | Path prefix | `__health` in code and smoke tests |
| 2 | README drift | Update root README health paths to match |

---

*End of specification.*
