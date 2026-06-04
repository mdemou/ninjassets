# Feature specification: Dashboards and audit history

- **Document ID:** SPEC-DASH-001
- **Status:** Implemented
- **Last updated:** 2026-06-02
- **Related requirements (E2E):** REQ-DASH-001
- **Depends on:** spec-platform-access-model.md, spec-asset-management.md

---

## 1. Summary

Two dashboards plus a shared **transaction audit log**:

- **Admin overview** (`/admin/overview`) — KPIs, charts, sites map, attention tiles, global transaction log.
- **Personal dashboard** (`/dashboard`) — My asset count, map, My History via `/api/me/transactions`.
- **Audit** — Every asset mutation appends `transaction` rows (best-effort; never fails the parent operation).

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Give admins an at-a-glance operational picture. |
| G2 | Give users visibility into their own assignment history. |
| G3 | Immutable-style event log with human-readable snapshots. |
| G4 | Paginated, searchable admin transaction list. |

## 3. Non-goals (v1)

- Export audit to CSV.
- Real-time websocket updates.

## 7. Transaction actions

`ITransactionAction` includes: `CREATED`, `UPDATED`, `ASSIGNED`, `UNASSIGNED`, `STATUS_CHANGED`, `SITE_CHANGED`, `WARRANTY_CHANGED`, `RETURN_DATE_CHANGED`, `DELETED`, plus handover actions (see handover spec).

Each row stores: `asset_name`, `actor_*`, `target_*`, `detail`, `action` (Postgres enum).

## 9. API specification

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/p/stats/overview` | JWTAdmin | KPIs, charts data, `attention` counts |
| GET | `/api/p/transactions` | JWTAdmin | Global log (`search`, `page`) |
| GET | `/api/me/transactions` | JWTAdminAndUser | Caller-scoped log (`target_user_id`) |
| GET | `/api/me/assets` | JWTAdminAndUser | Personal dashboard asset count/map |

## 11. Frontend

| Route | Features |
|-------|----------|
| `/admin/overview` | StatCards, Recharts donut/bar, Leaflet sites map, HistoryTable, Needs attention |
| `/dashboard` (`home.tsx`) | My-asset StatCard, assignment preview, locations map, empty state, `MyPendingHandoversPanel`, paginated `HistoryTable` (`/api/me/*`) |

## 14. Acceptance criteria (E2E)

From `e2e/tests/dashboards/req-dash-001.spec.ts`:

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Admin overview → KPI tiles, status chart, Latest Transactions heading. |
| AC-001.2 | Admin log lists seeded transaction event. |
| AC-001.3 | User dashboard → personal history includes events about them. |

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `admin.overview.tsx` | Admin dashboard |
| `home.tsx` | Personal dashboard |
| `transactions.domain.ts` / asset deriveUpdateEvents | Log writes |
| `admin/stats/stats.route.ts` | Overview API |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | `/dashboard` route | Implemented as `home.tsx` in routes config |

---

*End of specification.*
