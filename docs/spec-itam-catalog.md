# Feature specification: ITAM catalog (manufacturers and vendors)

- **Document ID:** SPEC-CATALOG-001
- **Status:** Implemented
- **Last updated:** 2026-05-31
- **Related requirements (E2E):** REQ-CATALOG-001 … REQ-CATALOG-002
- **Depends on:** spec-platform-access-model.md

---

## 1. Summary

Admins maintain **manufacturer** and **vendor** master data used by assets. Both support **CRUD**, **logo images** (manufacturer E2E covers upload), and **delete protection** when assets still reference a row.

- **UI:** `/admin/manufacturers`, `/admin/vendors`
- **API:** `/api/p/manufacturers/*`, `/api/p/vendors/*`

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Normalize manufacturer/vendor names across assets. |
| G2 | Prevent deleting catalog entries still in use. |
| G3 | Optional brand images (WebP on disk). |
| G4 | Mirror parallel patterns for both entity types. |

## 3. Non-goals (v1)

- Supplier contracts or PO integration.
- Manufacturer–vendor relationships.

## 4. Glossary

| Term | Definition |
|------|------------|
| In use | ≥1 asset references `manufacturer_id` or `vendor_id` |

## 5. Personas and user stories

| ID | Story | Priority |
|----|-------|----------|
| US-C1 | CRUD manufacturers. | Must |
| US-C2 | CRUD vendors. | Must |
| US-C3 | Cannot delete referenced catalog row. | Must |
| US-C4 | Upload manufacturer image (WebP). | Should |

## 7. State and business rules

| Rule | Detail |
|------|--------|
| Delete guard | If assets reference row → UI disables delete; API rejects |
| Image storage | Separate paths: `MANUFACTURER_IMAGE_STORAGE_PATH`, `VENDOR_IMAGE_STORAGE_PATH` |
| Asset linkage | Optional FKs on asset form |

## 8. Data model

Migration `20260530113430_itam_catalogs_and_asset_fields.ts`:

| Table | Columns |
|-------|---------|
| `manufacturer` | `id`, `name`, `image_filename`, … |
| `vendor` | `id`, `name`, `image_filename`, … |
| `asset` | `manufacturer_id`, `vendor_id` (nullable FK) |

## 9. API specification

### Manufacturers

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/p/manufacturers` | List (`search`, `page`; omit `page` for full list) / create |
| GET/PATCH/DELETE | `/api/p/manufacturers/{id}` | Detail / update / delete |
| POST/GET/DELETE | `/api/p/manufacturers/{id}/image` | Image |

### Vendors

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/p/vendors` | List (`search`, `page`; omit `page` for full list) / create |
| GET/PATCH/DELETE | `/api/p/vendors/{id}` | Detail / update / delete |
| POST/GET/DELETE | `/api/p/vendors/{id}/image` | Image |

### Personal read

| GET | `/api/me/manufacturers/{id}/image` | Assignee may view manufacturer image on their assets |

## 10. Email

Not applicable.

## 11. Frontend

| Route | Entity |
|-------|--------|
| `/admin/manufacturers` | Manufacturers |
| `/admin/vendors` | Vendors |

Delete modal shows asset reference count.

## 12. Security

`JWTAdmin` for all `/api/p/manufacturers|vendors` mutations.

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `MANUFACTURER_IMAGE_STORAGE_PATH` | |
| `VENDOR_IMAGE_STORAGE_PATH` | |

## 14. Acceptance criteria (E2E)

### REQ-CATALOG-001 (`req-catalog-001.spec.ts`)

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Create manufacturer → in list and DB. |
| AC-001.2 | Rename → updated. |
| AC-001.3 | Upload image → 200 GET as `image/webp`; filename set. |
| AC-001.4 | Delete with referencing asset → dialog warns, button disabled; without refs → deleted. |

### REQ-CATALOG-002 (`req-catalog-002.spec.ts`)

| AC | Given / When / Then |
|----|---------------------|
| AC-002.1 | Create vendor → in list. |
| AC-002.2 | Rename vendor → updated. |
| AC-002.3 | Referenced vendor cannot delete; unreferenced can. |

**[CODEBASE FIX]** Vendor image upload not covered by E2E but API mirrors manufacturer.

## 15. Implementation phases

| Phase | Status |
|-------|--------|
| P1 | Tables + asset FKs | Done |
| P2 | CRUD UI + delete guard | Done |
| P3 | Images | Done |

## 16. Backend layering

- `domain/manufacturers/`, `domain/vendors/`
- `infrastructure/routes/admin/manufacturers/`, `vendors/`

## 17. Open decisions (resolved)

| # | Decision |
|---|----------|
| D1 | Separate tables | Yes (not embedded strings) |

## 18. Documentation updates

- README catalog bullet

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `manufacturers.domain.ts` | Delete in-use check |
| `admin.manufacturers.tsx` | UI |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | Vendor image E2E gap | API exists; add test later if needed |

---

*End of specification.*
