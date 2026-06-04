# Feature specification: Data quality and in-app alerts

- **Document ID:** SPEC-ALERT-001
- **Status:** Implemented
- **Last updated:** 2026-06-04
- **Related requirements (E2E):** REQ-ALERT-001 … REQ-ALERT-003
- **Depends on:** spec-platform-access-model.md, spec-asset-management.md

---

## 1. Summary

Computed **hygiene rules** (no cron, no alert email) flag assets and assignments for admins. Issues appear in the **reports** page, **overview attention** tiles, and navbar **bell**. Regular users do not see alerts.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Surface data problems before audits fail. |
| G2 | Track warranty and return-date risk on assigned assets. |
| G3 | Detect inconsistent assignment state. |
| G4 | Link UI tiles to filtered reports. |

## 3. Non-goals (v1)

- Email/push for alerts.
- Scheduled batch jobs (all computed on read).
- Auto-remediation.

## 4. Issue types

| Issue | Rule |
|-------|------|
| `INACTIVE_USER_ASSIGNED` | ASSIGNED + assignee INACTIVE |
| `ASSIGNED_WITHOUT_USER` | ASSIGNED + no `assigned_user_id` |
| `WARRANTY_EXPIRED` | `warranty_end_date` < today |
| `WARRANTY_EXPIRING_SOON` | warranty within 30 days |
| `RETURN_OVERDUE` | `expected_return_date` < today while ASSIGNED |
| `RETURN_DUE_SOON` | return within 7 days while ASSIGNED |

## 5. Dismissals (admin "discard")

Admins can **discard** a computed row so it stops cluttering the overview/bell lists, without
editing the underlying asset. Dismissals are persisted in `data_quality_dismissal` and are
**global** (any admin's discard hides the row for all admins).

### 5.1 Reliability model — signature, not permanent

Because issues are computed (not stored rows), a naive "hide this (asset, issue) forever"
dismissal would wrongly suppress a *new* occurrence of the same problem. Instead each dismissal
stores a **signature**: a fingerprint of the issue instance's defining value at dismiss time.

| Issue | Signature source |
|-------|------------------|
| `INACTIVE_USER_ASSIGNED` | `assigned_user_id` |
| `ASSIGNED_WITHOUT_USER` | `asset.date_updated` (no defining value; bumped on every asset write) |
| `WARRANTY_EXPIRED` / `WARRANTY_EXPIRING_SOON` | `warranty_end_date` |
| `RETURN_OVERDUE` / `RETURN_DUE_SOON` | `expected_return_date` |

A dismissed row is hidden **only while its recomputed signature still matches** the stored one.
Editing the warranty/return date, reassigning, or a resolve→recur cycle yields a different
signature, so the alert **resurfaces**. The signature is recomputed from live DB state at
dismiss time (never trusted from the client). The match is timing-independent — it never relies
on a background reconcile pass. `ON DELETE CASCADE` on `asset_id` cleans up on asset deletion.

### 5.2 Schema — `data_quality_dismissal`

| Column | Notes |
|--------|-------|
| `id` | UUID PK |
| `date_created` | timestamp (refreshed on re-dismiss) |
| `asset_id` | FK → `asset.id` **ON DELETE CASCADE** |
| `issue` | TEXT (same values as `IDataQualityIssue`; not a pg enum) |
| `signature` | TEXT — issue-instance fingerprint (§5.1) |
| `dismissed_by_user_id` | FK → `user.id` **ON DELETE SET NULL** |
| — | **UNIQUE** `(asset_id, issue)` — re-dismiss updates the signature |

### 5.3 Scope

| Surface | Honors dismissals? |
|---------|--------------------|
| Overview "Needs attention" panel (`/api/p/alerts?excludeDismissed=true`) | **Yes** |
| Navbar bell (`/api/p/alerts?excludeDismissed=true`) | **Yes** |
| Overview attention **tiles** (counts, `/api/p/stats/overview`) | No (unchanged) |
| Reports page (`/api/p/reports/data-quality`) | No (unchanged) |

Tiles and the Reports page intentionally show the full, unfiltered picture; discard only tidies
the two alert *lists*. Fixing the underlying data still clears the issue everywhere (AC-002.5).

## 9. API specification

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/p/reports/data-quality` | JWTAdmin | Paginated issues (`search`, `page`, `issue`) |
| POST | `/api/p/reports/data-quality/dismiss` | JWTAdminOrApiKey | Discard a row — body `{ assetId, issue }`; 409 if issue no longer present |
| DELETE | `/api/p/reports/data-quality/dismiss` | JWTAdminOrApiKey | Undo a dismissal — body `{ assetId, issue }` (idempotent) |
| GET | `/api/p/alerts` | JWTAdmin | Top N for bell/overview (`limit`, `issue`, `excludeDismissed`) |
| GET | `/api/p/stats/overview` | JWTAdmin | `attention` count object per issue type |

## 11. Frontend

| Surface | Behavior |
|---------|----------|
| `/admin/reports` | Searchable issue list, issue filter |
| `/admin/overview` | "Needs attention" panel with per-row **Discard** action (toast + **Undo**); clickable tiles → reports with filter |
| `Navbar` bell | Admin-only dropdown from `/api/p/alerts` (dismissed rows hidden). Refetches live when the overview discards/undoes via the `alertsBus` signal, so the badge count stays in sync without a reload. |

## 14. Acceptance criteria (E2E)

### REQ-ALERT-001

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Admin sets warranty/return dates on asset → persisted. |
| AC-001.2 | Overdue return → appears in data-quality API with `RETURN_OVERDUE`. |
| AC-001.3 | INACTIVE assignee → `INACTIVE_USER_ASSIGNED` in API. |
| AC-001.4 | Overview stats include attention counts. |
| AC-001.5 | Overview tile visible for seeded issue. |

### REQ-ALERT-002

| AC | Given / When / Then |
|----|---------------------|
| AC-002.1 | Alerts API returns issues for admin. |
| AC-002.2 | Bell shows alert count/text. |
| AC-002.3 | Overview needs-attention panel lists issue. |
| AC-002.4 | Reports page filters by issue type. |
| AC-002.5 | Fix underlying data → alert clears. |
| AC-002.6 | Regular user does not see bell. |
| AC-002.7 | Admin nav includes Reports link. |

### REQ-ALERT-003 (dismissals)

| AC | Given / When / Then |
|----|---------------------|
| AC-003.1 | Admin discards an overview row → row disappears from overview **and** bell; tiles + Reports page still show it. |
| AC-003.2 | Discard then **Undo** (or DELETE dismiss) → row reappears on overview and bell. |
| AC-003.3 | Discard a row, then change its defining value (e.g. edit `expected_return_date`) → alert resurfaces (signature mismatch). |
| AC-003.4 | Resolve a dismissed issue, then re-trigger it for a new reason → alert resurfaces (signature mismatch). |
| AC-003.5 | Dismiss is global — a second admin no longer sees the discarded row on overview/bell. |
| AC-003.6 | POST dismiss for an issue not currently present → 409. |
| AC-003.7 | Discarding on the overview updates the navbar bell badge count live (no reload). |

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `dataQuality.queries.ts` | SQL rules, signatures, `excludeDismissed` filter, `getCurrentSignature` |
| `dismissals.repository.ts` | `dismiss` / `restore` / `getDismissedMap` |
| `data_quality_dismissal` table | Persisted signatured dismissals |
| `reports.domain.ts` | `dismissDataQuality` / `restoreDataQuality` |
| `admin.reports.tsx` | Reports UI |
| `admin.overview.tsx` | Attention tiles + needs-attention panel with Discard/Undo |
| `Navbar.tsx` / `NotificationBell.tsx` | Bell (admin only, hides dismissed; live-refetch on `alertsBus`) |
| `utils/alertsBus.ts` | Cross-component signal so a discard/undo refreshes the bell badge without reload |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | On-read computation | Hygiene rules are computed on read (no batch job for UI/reports). Webhook `alert.raised` uses a separate periodic scan via the Redis-backed scheduler when `WEBHOOKS_ENABLED` (see [spec-health-operations.md](spec-health-operations.md) §4). |
| 2 | README table | Matches issue enum names |

---

*End of specification.*
