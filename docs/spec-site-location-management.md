# Feature specification: Site and location management

- **Document ID:** SPEC-SITE-001
- **Status:** Implemented
- **Last updated:** 2026-06-01
- **Related requirements (E2E):** REQ-SITE-001
- **Depends on:** spec-platform-access-model.md

---

## 1. Summary

Admins maintain **physical locations** (sites) with WGS84 coordinates and an optional free-text **address** (not geocoded). Assets optionally link via `site_id`; maps use **Leaflet + OpenStreetMap**. Deleting a site unlinks assets by default or deletes them when `deleteAssets=true`.

- **Access:** Admin-only (`/admin/sites`, `/api/p/sites`).
- **Users:** See location via asset records on My Assets (no site CRUD).

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Centralize geo coordinates for asset grouping. |
| G2 | Map picker on create/edit; overview map on list. |
| G3 | Safe delete with explicit cascade option. |
| G4 | Moving site coordinates moves non-overridden asset map pins. |

## 3. Non-goals (v1)

- Geofencing, address autocomplete, or geocoding (address is stored as plain text only).
- Site hierarchy (region → building).
- User-facing site management.

## 4. Glossary

| Term | Definition |
|------|------------|
| Site | Named location with lat/lng and optional address |
| Effective coords | Asset override OR site coords |

## 5. Personas and user stories

| ID | Story | Priority |
|----|-------|----------|
| US-S1 | As an admin, I create sites with map picker and optional address. | Must |
| US-S1b | As an admin, I view and edit a site's address on the list and detail pages. | Must |
| US-S2 | As an admin, I delete empty sites. | Must |
| US-S3 | As an admin, I delete a site and optionally its linked assets. | Must |

## 7. State and business rules

| Rule | Detail |
|------|--------|
| Coordinates required | latitude/longitude on create |
| Address optional | Free-text `varchar`; empty string stored as `NULL` |
| Search | List `search` matches name, description, or address |
| Delete default | `site_id` SET NULL on assets (FK) |
| Delete with assets | Query `?deleteAssets=true` removes linked assets first |
| List counts | Site list includes linked asset count for delete dialog |

## 8. Data model

**Table `site`:**

| Column | Notes |
|--------|-------|
| `id` | uuid |
| `name` | |
| `description` | optional text |
| `address` | optional varchar (max 500 in API validation) |
| `latitude`, `longitude` | decimal degrees |

**Asset FK:** `asset.site_id` → `site.id` ON DELETE SET NULL

## 9. API specification

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/p/sites` | JWTAdmin | List (`search` on name/description/address, `page`; omit page for full list) |
| GET | `/api/p/sites/{id}` | JWTAdmin | Detail + assets |
| POST | `/api/p/sites` | JWTAdmin | Create |
| PATCH | `/api/p/sites/{id}` | JWTAdmin | Update |
| DELETE | `/api/p/sites/{id}` | JWTAdmin | Delete (`deleteAssets` query) |
| GET | `/api/p/sites/{id}/assets` | JWTAdmin | Assets at site |

## 10. Email

Not applicable.

## 11. Frontend

| Route | Features |
|-------|----------|
| `/admin/sites` | Table (name, address, description, coordinates), overview Leaflet map, CRUD modals with address field |
| `/admin/sites/{siteId}` | Site detail: inline edit (name, address, description, map picker, coordinates), linked assets table |

Map components: `LocationMap`, click/drag picker in modals and detail form. Address uses a plain text input (no map/autocomplete integration).

## 12. Security

Admin-only (`JWTAdmin`).

## 13. Configuration

None specific.

## 14. Acceptance criteria (E2E)

From `e2e/tests/sites/req-site-001.spec.ts`:

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Create site with lat/lng and optional address → persisted; address visible in list; map visible in modal and list. |
| AC-001.1b | Create with address → open detail → change address → save → address persisted in DB. |
| AC-001.2 | Delete site with no assets → site count 0. |
| AC-001.3 | Delete with "also delete these assets" → site and linked asset removed. |

## 15. Implementation phases

| Phase | Status |
|-------|--------|
| P1 | Sites CRUD + maps | Done |
| P2 | Cascade delete option | Done |
| P3 | Optional address field (list + detail) | Done |

## 16. Backend layering

- `domain/sites/sites.domain.ts`
- `infrastructure/routes/admin/sites/sites.route.ts`

## 17. Open decisions (resolved)

| # | Decision |
|---|----------|
| D1 | Default delete | Unlink assets (SET NULL) |

## 18. Documentation updates

- README Site & Location Management

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `migrations/20260529165252_create_sites.ts` | Initial schema |
| `migrations/20260601103919_add_address_to_sites.ts` | `address` column |
| `admin.sites.tsx` | List + CRUD modals |
| `admin.sites.$siteId.tsx` | Detail + inline edit |
| `Map.tsx` | Leaflet wrapper |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | Leaflet in modals | E2E checks `.leaflet-container` |

---

*End of specification.*
