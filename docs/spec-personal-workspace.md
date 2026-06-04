# Feature specification: Personal workspace

- **Document ID:** SPEC-PERSONAL-001
- **Status:** Implemented
- **Last updated:** 2026-06-02
- **Related requirements (E2E):** REQ-PERSONAL-001
- **Depends on:** spec-platform-access-model.md, spec-asset-management.md, spec-handover-magic-link.md

---

## 1. Summary

Regular users (and admins using personal views) access **My Assets** (`/assets`) and the **personal dashboard** (`/dashboard`) — read-only views of assignments, maps, history, and **pending handovers**. No access to admin routes or `/api/p/*`.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Assignees see only their custody. |
| G2 | Clear empty state when no assignments. |
| G3 | Surface open handovers on dashboard and assets pages. |
| G4 | Admins retain personal nav items (not hidden). |

## 3. Non-goals (v1)

- User-initiated asset requests or transfers.
- Editing asset fields as assignee.

## 7. State and business rules

| Rule | Detail |
|------|--------|
| `/api/me/assets` | `assigned_user_id = caller.id` |
| `/api/me/transactions` | `target_user_id = caller.id` |
| Admin on personal pages | Same endpoints; sees own assignments only |
| Nav | `hideForAdmin: false` on dashboard/assets (admins see both admin + personal nav) |

## 11. Frontend

| Route | Purpose |
|-------|---------|
| `/dashboard` (`home.tsx`) | My-asset count, assignment preview, map (when geolocated), empty state, `MyPendingHandoversPanel`, paginated `HistoryTable` |
| `/assets` | Read-only assigned asset list + map + handover panel |
| `/handover/accept` | Magic-link confirm (handover spec) |

## 14. Acceptance criteria (E2E)

From `e2e/tests/personal/req-personal-001.spec.ts`:

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | User with assigned asset → `/assets` shows name and serial. |
| AC-001.2 | User with no assets → empty state message. |

Cross-ref REQ-AUTH-002.5 and platform spec for admin route blocking.

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `assets.tsx` | My Assets |
| `home.tsx` | Dashboard |
| `HandoverPanel.tsx` / `MyPendingHandoversPanel.tsx` | Pending custody |
| `me.route.ts` | Personal APIs |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | REQ-HANDOVER-006 | Pending panel also tested in handover E2E |

---

*End of specification.*
