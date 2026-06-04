# Feature specification: Import / export (bulk data)

- **Document ID:** SPEC-IMPORT-001
- **Status:** Implemented (MVP + P2)
- **Last updated:** 2026-06-03
- **Related requirements (E2E):** REQ-IMPORT-001 / REQ-IMPORT-002
- **Depends on:** [spec-platform-access-model.md](spec-platform-access-model.md), [spec-api-automation.md](spec-api-automation.md), [spec-asset-management.md](spec-asset-management.md), [spec-site-location-management.md](spec-site-location-management.md), [spec-itam-catalog.md](spec-itam-catalog.md), [spec-admin-user-management.md](spec-admin-user-management.md), [spec-handover-magic-link.md](spec-handover-magic-link.md), [spec-email-notifications.md](spec-email-notifications.md), [spec-webhooks-notifications.md](spec-webhooks-notifications.md)

> **Implementation notes (2026-06-03).** MVP + P2 shipped: assets, sites, users,
> manufacturers, and vendors are all importable/exportable; mapping presets and
> per-job options are live. Two refinements vs. the original draft:
> - **Category + custom fields** (added to the asset model after this spec was
>   first written) round-trip fully: import resolves `category_name` → category and
>   validates a `custom_fields` JSON column against the category schema; export emits
>   both columns.
> - **`ALL_OR_NOTHING`** is enforced at the dry-run gate (commit is blocked unless the
>   dry-run is error-free). Cross-row transactional rollback on an unexpected mid-batch
>   failure is best-effort (the job is marked `FAILED`), because the reused entity
>   domains commit per-row rather than through a shared transaction.
> P3 (scheduled exports, `external_id`) remains deferred. Job-completion **webhook** events are implemented via [spec-webhooks-notifications.md](spec-webhooks-notifications.md) (see §3.1).

---

## 1. Summary

Provide an **admin-only** import and export hub for **one-time migration** and occasional bulk operations. Admins upload **CSV, XLSX, or JSON**, map columns to ninjasset fields, run a **mandatory dry-run**, then commit changes asynchronously. Exports support **full dumps** or **filtered** lists (same filters as admin list pages).

- **UI:** `/admin/import-export` wizard (upload → map → preview → dry-run → commit → history).
- **API:** Job endpoints under `/api/p/import-jobs` and `/api/p/export-jobs` (auth via [spec-api-automation.md](spec-api-automation.md) `JWTAdminOrApiKey`).
- **Entities (phased):** assets (MVP), then sites, users, manufacturers/vendors (P2); scheduled export and advanced presets (P3).
- **Not** a recurring sync engine, not user self-export, not image/QR bundles in v1.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Migrate inventory from spreadsheets or other ITAM tools without manual re-entry. |
| G2 | Never commit bulk changes without a dry-run that surfaces row-level errors. |
| G3 | Preserve domain rules (lifecycle, serial uniqueness, handover blocking) with explicit admin override when needed. |
| G4 | Audit bulk outcomes (per-job summary + existing entity transaction log for mutations). |
| G5 | Support EN/ES UI strings; server-side job messages in English unless extended later. |
| G6 | Enable the same flows via UI and API (integrations drive exports/imports via jobs). |

## 3. Non-goals

| Item | Notes |
|------|-------|
| Recurring / scheduled sync | One-time migration focus in v1; scheduled export deferred to P3. |
| Regular user export | Personal `/api/me/*` unchanged; no `/assets` export for USER role. |
| Asset images / QR in files | Out of scope v1 (see [spec-asset-media-qr.md](spec-asset-media-qr.md)). |
| Vendor-specific column packs | No “Snipe-IT preset”; capability-driven templates and saved mappings only. |
| Audit log / transactions as import targets | Export-only for audit data (future); not in MVP import entities. |
| Webhooks on job complete | Implemented — see §3.1 and [spec-webhooks-notifications.md](spec-webhooks-notifications.md) §6.2. |
| Virus scanning of uploads | Non-goal; rely on file type + size limits. |
| All-or-nothing only | Admin chooses per job (see §7.5). |

### 3.1 Webhook events on job completion

When an async import/export job reaches a **terminal phase**, `importExport.domain` publishes a domain event on the bus ([spec-webhooks-notifications.md](spec-webhooks-notifications.md)). Delivery is best-effort and gated by per-destination `subscribed_events` (not by import/export itself).

| Event | Fires when | `detail` (English) |
|-------|------------|-------------------|
| `import.dry_run_completed` | Dry-run worker finishes (`DRY_RUN_SUCCEEDED` or `DRY_RUN_FAILED`) | Status + ok/error/warning counts |
| `import.commit_completed` | Commit worker finishes (`SUCCEEDED`, `PARTIAL_SUCCEEDED`, or `FAILED`) | Status + created/updated/skipped/failed counts |
| `export.completed` | Export worker finishes (`SUCCEEDED` or `FAILED`) | Status + row count when succeeded |

Deep link in payloads: `/admin/import-export`. Actor is the job’s `created_by_user` when resolvable.

## 4. Glossary

| Term | Definition |
|------|------------|
| Import job | Async unit of work: parse file → map columns → dry-run or commit. |
| Export job | Async unit of work: query entities → write CSV/XLSX/JSON artifact. |
| Dry-run | Validate every row and simulate writes **without** persisting (required before commit). |
| Commit | Transition job from `DRY_RUN_SUCCEEDED` to applying mutations. |
| Mapping preset | Saved column map (source header → canonical field) reusable across jobs. |
| Canonical field | Internal name used by domain (e.g. `serial_number`, `site_name`). |
| Force override | Job flag allowing status/assignee changes when an open handover exists. |
| Artifact | Generated file stored temporarily (export download, error report CSV). |
| Upsert | Create row if no `id`; update row if `id` matches existing entity. |

## 5. Personas and user stories

### 5.1 Admin

| ID | Story | Priority | Phase |
|----|-------|----------|-------|
| US-IE1 | Download a template CSV/XLSX per entity type with canonical headers and hints. | Must | MVP (assets) |
| US-IE2 | Upload CSV/XLSX/JSON via drag-and-drop and map columns in the UI. | Must | MVP |
| US-IE3 | Save and reuse a mapping preset (e.g. “Generic ITAM export”). | Should | MVP |
| US-IE4 | Run dry-run and see a preview grid with per-row errors before commit. | Must | MVP |
| US-IE5 | Choose all-or-nothing vs import-valid-rows-only when committing. | Must | MVP |
| US-IE6 | Commit import asynchronously and poll until complete. | Must | MVP |
| US-IE7 | Download a result report (errors + summary counts) after import. | Must | MVP |
| US-IE8 | Export all assets or export using current list filters (status, site, search). | Must | MVP |
| US-IE9 | View import/export job history on the hub page. | Should | MVP |
| US-IE10 | Import sites, users, manufacturers, vendors in the same hub. | Must | P2 |
| US-IE11 | Set `force` on a job to override open-handover blocks on status/assignee. | Must | MVP |
| US-IE12 | Schedule recurring exports. | Could | P3 |
| US-IE13 | Receive email when a long job completes (optional). | Could | MVP/P2 |

### 5.2 Regular user

No stories — feature is admin-only.

## 6. End-to-end flows

### 6.1 Import (happy path)

```
┌──────────┐   upload    ┌─────────────┐   map columns   ┌──────────────┐
│  Admin   │────────────►│  import_job │────────────────►│   MAPPED     │
│  UI/API  │             │   QUEUED    │                 │  (metadata)  │
└──────────┘             └──────┬──────┘                 └──────┬───────┘
                                │ dry-run                        │
                                ▼                                │
                         ┌──────────────┐                        │
                         │ DRY_RUNNING  │                        │
                         └──────┬───────┘                        │
                    errors?    │                                │
              ┌────────────────┴────────────────┐               │
              ▼                                 ▼               │
     DRY_RUN_FAILED                      DRY_RUN_SUCCEEDED      │
     (report artifact)                          │               │
                                                │ admin commit  │
                                                ▼               │
                                         ┌──────────────┐       │
                                         │  COMMITTING  │◄──────┘
                                         └──────┬───────┘
                                                │
                         ┌──────────────────────┼──────────────────────┐
                         ▼                      ▼                      ▼
                   SUCCEEDED               PARTIAL_SUCCEEDED         FAILED
                   (counts)               (valid rows only)        (rollback policy)
```

### 6.2 Export

```
Admin selects entity + format + scope (full | filtered query)
  → POST /api/p/export-jobs
  → worker writes artifact
  → job SUCCEEDED → GET download URL (time-limited)
```

### 6.3 Integration (API key)

Same job endpoints as UI; polling `GET /api/p/import-jobs/{id}` / `export-jobs/{id}`. No browser session required ([spec-api-automation.md](spec-api-automation.md)).

## 7. State and business rules

### 7.1 Job status enum

| Status | Meaning |
|--------|---------|
| `QUEUED` | Accepted; worker not started |
| `PARSING` | Reading file into staging rows |
| `MAPPED` | Column mapping stored; ready for dry-run |
| `DRY_RUNNING` | Validating rows |
| `DRY_RUN_SUCCEEDED` | No blocking errors (warnings allowed); commit allowed |
| `DRY_RUN_FAILED` | Blocking errors; commit disallowed until mapping/file fixed |
| `COMMITTING` | Applying mutations |
| `SUCCEEDED` | All targeted rows committed per mode |
| `PARTIAL_SUCCEEDED` | Valid-rows-only mode; some rows skipped |
| `FAILED` | Unrecoverable error or all-or-nothing rollback |
| `CANCELLED` | Admin cancelled before commit |

### 7.2 Upsert and match keys (D-IMPORT-1)

| Row `id` column | Action |
|-----------------|--------|
| Empty / absent | **Create** — insert new entity; `serial_number` must be unique for assets. |
| Valid UUID matching existing row | **Update** — upsert fields present in file. |
| Valid UUID not found | Row error (do not create duplicate identity). |
| Invalid UUID format | Row error |

**D-IMPORT-1b (resolved):** No **update-by-serial** in v1. Legacy spreadsheets without UUIDs use the **create** path only; re-import for updates requires exporting from ninjasset first (export always includes `id`).

Optional future column `external_id` (not in MVP schema) is reserved for legacy asset tags without changing v1 rules.

### 7.3 Entity-specific rules

#### Assets

- Reuse `assets.domain.ts`: `resolveAssignment`, `deriveUpdateEvents`, serial uniqueness, FK validation.
- **Assignment on import:** `status=ASSIGNED` + `assignee_email` performs **direct (unverified) assign**, same as admin PATCH ([spec-asset-management.md](spec-asset-management.md)).
- **Open handover:** Default **block** changes to `status` / `assigned_user_id` (409 equivalent at row level). Job payload `force: true` applies admin override ([spec-handover-magic-link.md](spec-handover-magic-link.md) policy).
- Non-conflicting fields (name, note, site, warranty, etc.) may update even when handover blocks status/assignee unless domain says otherwise.

#### Sites

- Match/create by normalized **name** (trim, case-fold for duplicate detection).
- Auto-create missing site on asset import when `site_name` provided and `createMissingSites` job option true (default **true**).

#### Manufacturers / vendors

- Auto-create by normalized name when missing (default **true**).

#### Users (P2)

- **Assignee references:** email must match an **ACTIVE** user; otherwise row error.
- **User import rows:** do not auto-create users from asset assignee columns.
- Promoting to `ADMIN` requires explicit `role` column value `ADMIN` **and** job flag `allowAdminPromotion: true` (default **false**).
- New users via import follow admin-create rules: `INACTIVE` + verification email ([spec-admin-user-management.md](spec-admin-user-management.md)).

### 7.4 Inline references (resolved)

| Reference | v1 behaviour |
|-----------|--------------|
| `site_name` | Create site if missing (when option enabled) |
| `manufacturer_name` / `vendor_name` | Create catalog row if missing |
| `assignee_email` | Must exist, ACTIVE; never auto-create |
| `assigned_user_id` | UUID alternative to email; same ACTIVE rule |

### 7.5 Partial import mode

Per job, admin selects:

| Mode | Behaviour |
|------|-----------|
| `ALL_OR_NOTHING` | Any blocking dry-run error prevents commit; commit rolls back on mid-batch failure |
| `VALID_ROWS_ONLY` | Commit rows that passed dry-run; skipped rows listed in report |

Dry-run always reports **all** row errors regardless of mode.

### 7.6 Export scope

| Scope | Behaviour |
|-------|-----------|
| `FULL` | All rows of entity type (respect admin visibility; no USER scope) |
| `FILTERED` | Same query params as list APIs (`search`, `page` not used — export all matching filters) |

Sensitive fields (purchase price, notes, financial columns) included for all admins (no redaction v1).

### 7.7 File formats

| Format | Import | Export |
|--------|--------|--------|
| CSV | Yes | Yes |
| XLSX | Yes | Yes |
| JSON | Yes (array of objects) | Yes |

Encoding: UTF-8 with BOM optional for Excel CSV compatibility.

### 7.8 Permissions

All **ADMIN** role users may use import/export. No new scopes (`MANAGE_IMPORT`) in v1.

## 8. Data model

### 8.1 Table `import_job`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `created_by_user_id` | uuid FK | Admin who started job |
| `entity_type` | enum | `ASSET`, `SITE`, `USER`, `MANUFACTURER`, `VENDOR` |
| `status` | enum | §7.1 |
| `file_format` | enum | `CSV`, `XLSX`, `JSON` |
| `original_filename` | text | |
| `storage_path` | text | Uploaded source file |
| `mapping_json` | jsonb | Column map + options (`force`, `partialMode`, flags) |
| `preset_id` | uuid FK nullable | → `import_mapping_preset` |
| `dry_run_summary` | jsonb | Counts: total, ok, error, warning |
| `commit_summary` | jsonb | Created/updated/skipped/failed counts |
| `error_artifact_path` | text nullable | CSV of row errors |
| `created_at`, `updated_at` | timestamptz | |
| `started_at`, `finished_at` | timestamptz nullable | |

### 8.2 Table `import_job_row` (staging)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `import_job_id` | uuid FK | |
| `row_number` | int | 1-based source line |
| `raw_json` | jsonb | Parsed row before map |
| `mapped_json` | jsonb nullable | After mapping |
| `severity` | enum | `OK`, `WARNING`, `ERROR` |
| `messages` | jsonb | Array of `{ code, field, message }` |
| `target_entity_id` | uuid nullable | Set on successful commit |

Index: `(import_job_id, row_number)` unique.

### 8.3 Table `export_job`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `created_by_user_id` | uuid FK | |
| `entity_type` | enum | Same as import |
| `status` | enum | Subset: QUEUED → PROCESSING → SUCCEEDED / FAILED |
| `file_format` | enum | CSV, XLSX, JSON |
| `scope` | enum | FULL, FILTERED |
| `filter_json` | jsonb nullable | Serialized list filters |
| `artifact_path` | text nullable | |
| `row_count` | int nullable | |
| `created_at`, `finished_at` | timestamptz | |

### 8.4 Table `import_mapping_preset` (optional MVP, full P2)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | Admin-visible label |
| `entity_type` | enum | |
| `mapping_json` | jsonb | |
| `created_by_user_id` | uuid FK | |
| `created_at` | timestamptz | |

### 8.5 Canonical import columns (assets — MVP)

| Canonical field | Required | Notes |
|-----------------|----------|-------|
| `id` | No | Omit to create |
| `name` | Yes on create | |
| `model` | No | |
| `serial_number` | Yes on create | Unique |
| `status` | No | Default STOCK |
| `assignee_email` | When ASSIGNED | |
| `site_name` | No | Resolved to `site_id` |
| `manufacturer_name` | No | |
| `vendor_name` | No | |
| `warranty_end_date` | No | ISO date |
| `expected_return_date` | No | ISO date |
| `note` | No | |
| Financial fields | No | As in asset model |

P2 specs add columns for sites, users, catalog in §8 annex (to be expanded at implementation).

## 9. API specification

Auth: **`JWTAdminOrApiKey`** on all routes below ([spec-api-automation.md](spec-api-automation.md)).

### 9.1 Import jobs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/p/import-jobs` | Multipart upload + `entityType`, `fileFormat`; returns `jobId` |
| PATCH | `/api/p/import-jobs/{id}/mapping` | Set column mapping + job options |
| POST | `/api/p/import-jobs/{id}/dry-run` | Start dry-run (idempotent if already succeeded) |
| POST | `/api/p/import-jobs/{id}/commit` | Start commit (requires `DRY_RUN_SUCCEEDED`) |
| POST | `/api/p/import-jobs/{id}/cancel` | Cancel if not committed |
| GET | `/api/p/import-jobs` | List jobs (paginated) |
| GET | `/api/p/import-jobs/{id}` | Status + summaries |
| GET | `/api/p/import-jobs/{id}/rows` | Staging rows (paginated, `severity` filter) |
| GET | `/api/p/import-jobs/{id}/errors` | Download error artifact |

### 9.2 Export jobs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/p/export-jobs` | Body: `entityType`, `fileFormat`, `scope`, `filter?` |
| GET | `/api/p/export-jobs` | List |
| GET | `/api/p/export-jobs/{id}` | Status |
| GET | `/api/p/export-jobs/{id}/download` | Stream artifact (auth required; short-lived token optional) |

### 9.3 Mapping presets

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/p/import-mapping-presets` | List for entity type |
| POST | `/api/p/import-mapping-presets` | Create |
| DELETE | `/api/p/import-mapping-presets/{id}` | Delete |

### 9.4 Templates (static)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/p/import-templates/{entityType}` | Download empty template (.csv or .xlsx via query) |

### 9.5 Response codes (representative)

| Code | When |
|------|------|
| 400 | Invalid mapping, unsupported format |
| 401 | Missing/invalid auth |
| 404 | Unknown job |
| 409 | Commit while not `DRY_RUN_SUCCEEDED`; concurrent commit |
| 413 | File too large |
| 422 | Domain validation surfaced at job level |

## 10. Email

| Event | Policy |
|-------|--------|
| Job completed (optional) | Email admin with link to hub + error report; use same locale policy as other transactional mail (EN default; see [spec-internationalization.md](spec-internationalization.md)) |
| User verification | Unchanged — user import still triggers verification template |

Controlled by env `IMPORT_EXPORT_NOTIFY_ON_COMPLETE` (default false in dev).

## 11. Frontend

### 11.1 Route

| Route | Purpose |
|-------|---------|
| `/admin/import-export` | Hub: Import / Export / History tabs |

Admin gate: `roleName === 'ADMIN'`. Nav entry: `adminOnly: true` in `NavItems.ts`.

### 11.2 Import wizard steps

1. **Choose entity** — Asset (MVP); others enabled in P2.
2. **Upload** — Drag-and-drop; format auto-detect or select.
3. **Map columns** — Grid: source header → canonical field; load/save preset.
4. **Options** — Partial mode, `force`, auto-create sites/catalog toggles.
5. **Dry-run** — Progress bar; preview table with error highlighting.
6. **Commit** — Confirm summary; poll status.
7. **Done** — Download error report; link to affected entities.

### 11.3 Export panel

- Entity selector, format, scope (full / use current filters from last visited list — pass filter state via query or session).
- Poll + download button when ready.

### 11.4 History tab

- Table: type, entity, status, started, duration, created by, actions (download artifacts).

### 11.5 i18n

All user-visible strings in `translations.ts` (EN/ES).

## 12. Security

| Control | Detail |
|---------|--------|
| Admin-only | JWTAdmin or ApiKeyAdmin; USER receives 401/403 |
| File limits | Max size (e.g. 20 MB) and max rows (e.g. 50 000) per job — configurable |
| MIME / extension | Reject unknown types; parse server-side only |
| Secrets in files | Document: never put API keys/passwords in CSV |
| Artifact TTL | Auto-delete artifacts after retention window (§13) |
| IDOR | Jobs scoped to deployment; only admins list all jobs |
| Rate | No per-admin throttle v1; rely on async queue |

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `IMPORT_MAX_FILE_BYTES` | Upload cap |
| `IMPORT_MAX_ROWS` | Row cap per job |
| `IMPORT_ARTIFACT_RETENTION_DAYS` | Delete files after N days |
| `IMPORT_STORAGE_PATH` | Disk root for uploads/artifacts |
| `IMPORT_WORKER_BLOCK_SECONDS` | BLPOP block (seconds) for the event-driven consumer |
| `IMPORT_SAFETY_SWEEP_MS` | Scheduler safety sweep when Redis was down |
| `IMPORT_EXPORT_ENABLED` | In-process worker on API node (disable when running a separate worker) |
| `IMPORT_EXPORT_NOTIFY_ON_COMPLETE` | Email on completion |
| `REDIS_*` | Optional queue (see §17 D-IMPORT-2) |

## 14. Acceptance criteria (E2E)

Planned file: `e2e/tests/import-export/req-import-001.spec.ts` (not yet implemented).

### REQ-IMPORT-001 — Asset import/export (MVP)

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Admin downloads asset template → CSV contains canonical headers including `id`. |
| AC-001.2 | Admin uploads CSV without `id` → dry-run → commit → assets created with STOCK. |
| AC-001.3 | Admin exports FULL assets → file contains `id` for all rows. |
| AC-001.4 | Admin re-imports with `id` changing `name` → upsert updates name. |
| AC-001.5 | Duplicate `serial_number` on create → dry-run row ERROR. |
| AC-001.6 | Row with ASSIGNED + unknown email → dry-run ERROR. |
| AC-001.7 | Open handover on asset → import changes assignee without `force` → row ERROR. |
| AC-001.8 | Same with `force: true` → commit succeeds. |
| AC-001.9 | `VALID_ROWS_ONLY` with one bad row → partial commit + report lists skipped row. |
| AC-001.10 | USER calls `POST /api/p/import-jobs` → HTTP ≥ 400. |

### REQ-IMPORT-002 — Multi-entity (P2)

| AC | Given / When / Then |
|----|---------------------|
| AC-002.1 | Import site by name → asset import references site. |
| AC-002.2 | User import with ADMIN role without `allowAdminPromotion` → row ERROR. |

## 15. Implementation phases

| Phase | Scope | Status |
|-------|-------|--------|
| **MVP** | Asset import/export, async jobs, dry-run, hub UI, templates, API jobs, `JWTAdminOrApiKey` | Planned |
| **P2** | Sites, users, catalog entities; mapping presets; optional completion email | Planned |
| **P3** | Scheduled exports; `external_id` column if needed | Planned |

**Recommended build order:** [spec-api-automation.md](spec-api-automation.md) MVP before import jobs API testing.

## 16. Backend layering

| Layer | Responsibility |
|-------|----------------|
| `domain/importExport/` | Row validation, upsert orchestration, handover force policy |
| `domain/assets/` etc. | Existing entity rules — import domain calls, does not duplicate |
| `infrastructure/repositories/importJobDb/` | Job + row persistence |
| `infrastructure/routes/admin/importExport/` | Routes, `.doc.ts`, `.responses.ts` |
| `workers/importExport.worker.ts` | Poll queue or `import_job` status; parse files (e.g. `xlsx`, `csv-parse`) |
| `services/importFileStorage.service.ts` | Disk I/O for uploads/artifacts |

## 17. Open decisions

| # | Question | Decision |
|---|----------|----------|
| D-IMPORT-1 | Primary upsert key | **UUID `id`**; empty `id` = create |
| D-IMPORT-1b | Update by serial without id | **No** in v1 |
| D-IMPORT-2 | Job queue transport | **Prefer Redis list** on existing `redis.service.ts` with DB fallback polling if Redis unavailable in test |
| D-IMPORT-3 | Worker deployment | Same Node process as API in dev; separate worker process in production (document in README) |
| D-IMPORT-4 | Column mapper in MVP | **Yes** — templates alone insufficient for migration |
| D-IMPORT-5 | Commit without dry-run | **Forbidden** |

## 18. Documentation updates

- [spec-index.md](spec-index.md) — register SPEC-IMPORT-001
- [spec-asset-management.md](spec-asset-management.md) — §3 cross-link
- [README.md](../README.md) — “Bulk import/export” + link to hub
- `backend/README.md` — job routes and worker
- `docs/e2e-testing.md` — `import-export/` folder when tests exist
- [spec-webhooks-notifications.md](spec-webhooks-notifications.md) — job-completion events (§3.1)

## 19. Reference: touchpoints

| Area | Location / note |
|------|-----------------|
| Asset rules | `backend/src/domain/assets/assets.domain.ts` |
| Handover block | `assertOpenHandoverBlocksDirectMutation` |
| Admin routes pattern | `backend/src/infrastructure/routes/admin/assets/` |
| Redis | `backend/src/services/redis.service.ts` |
| Swagger | `backend/docs/api-documentation.md` |
| Translations | `frontend/app/translations.ts` |
| Platform auth | [spec-api-automation.md](spec-api-automation.md) |

## 20. Changes from draft validation

| # | Item | Detail |
|---|------|--------|
| 1 | Depends on API spec | Import job routes require `JWTAdminOrApiKey` from SPEC-API-001 |
| 2 | User import safety | `allowAdminPromotion` flag prevents accidental ADMIN rows |
| 3 | Serial-only migration | Exporters must round-trip once to obtain UUIDs for updates |

---

*End of specification.*
