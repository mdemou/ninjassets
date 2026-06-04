# Feature specification: Asset categories and custom fields

- **Document ID:** SPEC-CATEGORY-002
- **Status:** Implemented
- **Last updated:** 2026-06-01
- **Related requirements (E2E):** REQ-CATEGORY-003
- **Depends on:** spec-platform-access-model.md, spec-asset-management.md, spec-itam-catalog.md (parallel master-data pattern)

---

## 1. Summary

Admins define **categories** (Laptop, Mobile, Server, Software License, …). Each category owns an ordered set of **custom field definitions** (RAM, CPU, seat count, expiry, rack position, …). An asset may belong to **one** category and carries its category-specific values in a `custom_fields` JSONB column, validated in the domain against the category's schema.

This realises the proposed extension in [spec-asset-management.md](spec-asset-management.md) §21. The asset core (lifecycle, assignment, search) is unchanged — category and custom fields describe *what* an asset is, not *who holds it*.

- **UI:** `/admin/categories` (manage categories + their fields); category selector and dynamic fields in the asset form.
- **API:** `/api/p/categories/*`; `categoryId` + `customFields` on asset create/update; `categoryId` asset-list filter.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Type-specific fields per asset without a developer migration per type. |
| G2 | Admin self-service: define categories and their field schema in the UI. |
| G3 | Only the chosen category's fields are shown on the asset form (hide-unused). |
| G4 | Validate custom values against the schema so bad data can't be persisted. |
| G5 | Reuse the catalog conventions (normalized table, in-use delete guard, audit log). |

## 3. Non-goals (v1)

- Per-field SQL reporting/aggregation (JSONB GIN search index deferred — §10).
- Global fields shared across all categories (per-category only).
- Conditional/dependent fields, computed fields, file-typed fields.
- Including custom field values in omnipresent asset search.

## 4. Glossary

| Term | Definition |
|------|------------|
| Category | Admin-defined asset type; owns a field schema. |
| Field definition | One `category_field` row: key, label, type, required, options, order. |
| Custom fields | The asset's `field_key → value` JSONB map for its category. |
| In use | ≥1 asset references `category_id`. |

## 5. Personas and user stories

### 5.1 Admin

| ID | Story | Priority |
|----|-------|----------|
| US-CT1 | Create / edit / delete categories. | Must |
| US-CT2 | Define a category's fields (type, required, options, order). | Must |
| US-CT3 | Cannot delete a category referenced by assets. | Must |
| US-CT4 | Assign a category to an asset and fill its fields. | Must |
| US-CT5 | Filter the asset list by category. | Should |

### 5.2 User

| ID | Story | Priority |
|----|-------|----------|
| US-CT6 | See my asset's category and field values (read-only). | Should |

## 6. Field types — enum `category_field_type`

`TEXT`, `TEXTAREA`, `NUMBER`, `BOOLEAN`, `DATE`, `SELECT`, `MULTI_SELECT`.

`SELECT` / `MULTI_SELECT` carry an `options` string array. New types append-only (matching the `transaction_action` enum practice).

## 7. State and business rules

### 7.1 Domain (`categories.domain.ts`)

- `assertNameAvailable` — unique case-insensitive name (mirrors catalog).
- Field-schema normalization on create/update: trims, derives a snake_case `field_key` from the label when not supplied, dedupes keys within a category, sequences `sort_order`, requires ≥1 option for `SELECT`/`MULTI_SELECT`.
- Fields are managed **with the category** (create/update accept the full `fields` array; replace-all semantics) — simpler than granular endpoints and gives a single admin form. The category detail returns its fields.
- Delete guard: reject when `asset` rows reference the category (409, like manufacturer/vendor). Deleting a category cascades its `category_field` rows.

### 7.2 Domain (`assets.domain.ts`) — `resolveCustomFields`

Called on asset create/update alongside `resolveAssignment`:

- **No category** → `custom_fields` forced to `{}` (any supplied values rejected).
- **Unknown keys** → reject keys not defined for the category (400).
- **Required** → each `required` field must be present and non-empty.
- **Type checks** — `NUMBER` numeric; `DATE` ISO `YYYY-MM-DD`; `BOOLEAN` boolean; `SELECT` value ∈ options; `MULTI_SELECT` array ⊆ options; `TEXT`/`TEXTAREA` string (length-capped).
- **Category change** → values re-validated against the new schema; keys absent from the new category are dropped.

### 7.3 Transactions

Append-only `transaction_action` values:

- `CATEGORY_CHANGED` — category set / changed / cleared (detail = new category name or "none").
- `CUSTOM_FIELDS_CHANGED` — one or more custom values changed (emitted only when no `CATEGORY_CHANGED` fired, like the generic `UPDATED` fallback).

No handover-block interaction — custom fields stay editable during an open handover (like name/note).

## 8. Data model

Migration `add_asset_categories.ts`:

| Table | Columns |
|-------|---------|
| `category` | `id` uuid PK, `date_created`, `date_updated`, `name` (unique `LOWER(TRIM)`), `icon` (nullable), `description` (nullable) |
| `category_field` | `id` uuid PK, `category_id` FK → category **ON DELETE CASCADE**, `field_key`, `label`, `data_type` (`category_field_type`), `required` bool, `options` jsonb null, `help_text`/`placeholder`/`unit` null, `sort_order` int, timestamps; unique (`category_id`, `field_key`) |
| `asset` | `category_id` uuid null FK → category **ON DELETE RESTRICT**; `custom_fields` jsonb `NOT NULL DEFAULT '{}'` |

Indexes: `category.name`, `category_field.category_id`, `asset.category_id`.

## 9. API specification

### Admin (`JWTAdminOrApiKey`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/p/categories` | List (`search`, `page`; omit `page` for full list). Each row has `assetCount`, `fieldCount`. |
| GET | `/api/p/categories/{id}` | Detail incl. ordered `fields`. |
| POST | `/api/p/categories` | Create `{ name, icon?, description?, fields[] }`. |
| PATCH | `/api/p/categories/{id}` | Update; `fields[]` replaces the schema. |
| DELETE | `/api/p/categories/{id}` | Delete (409 if in use). |

### Asset endpoints (extended)

- `POST/PATCH /api/p/assets` payloads gain `categoryId` (uuid|null) and `customFields` (object).
- `GET /api/p/assets` gains `categoryId` filter; asset responses include `categoryId`, `categoryName`, `customFields`.

## 10. Implementation phases

| Phase | Scope | Status |
|-------|-------|--------|
| P1 | `category` + `category_field` tables, CRUD API, `/admin/categories` UI | Done |
| P2 | `asset.category_id` + `custom_fields`, domain validation, dynamic asset form, detail display | Done |
| P3 | `categoryId` list filter, history actions | Done |
| P4 | Optional GIN index + per-field search | Deferred |

## 11. Frontend

| Route | Purpose |
|-------|---------|
| `/admin/categories` | CRUD categories + inline field-schema editor; delete guarded by asset count |
| `/admin/assets` (form) | Category `SearchSelect`; on select, renders only that category's fields; clearing/changing category drops stale values |
| `/admin/assets/{assetId}` | Category + custom field values shown; `CATEGORY_CHANGED` / `CUSTOM_FIELDS_CHANGED` in history |

## 12. Security

`JWTAdminOrApiKey` + `ASSETS_*`-style admin auth on all `/api/p/categories`. Personal asset reads expose resolved values read-only.

## 13. Configuration

Reuses `ADMIN_PAGE_SIZE` (`config.pagination.pageSize`). No new env vars.

## 14. Acceptance criteria (E2E)

From `e2e/tests/catalog/req-category-003.spec.ts`:

| AC | Given / When / Then |
|----|---------------------|
| AC-003.1 | Create category with a required field → listed + persisted; detail API returns fields ordered by `sort_order`. |
| AC-003.2 | Create asset with category + valid custom values → persisted; detail returns `categoryName` + `customFields`. |
| AC-003.3 | Required field missing → 400, asset not created; unknown field key → 400. |
| AC-003.4 | Change asset category (no values supplied) → stale keys dropped; `CATEGORY_CHANGED` in history. |
| AC-003.5 | Delete category referenced by an asset → UI disables delete + warns, API returns 409; unreferenced category deletes. |

## 15. Open decisions (resolved)

| # | Decision |
|---|----------|
| D1 | Value storage | JSONB on asset, validated in domain (SPEC-ASSET-001 §21.7 / D3) |
| D2 | Field management API | Embedded `fields[]` on category create/update (replace-all), not granular endpoints |
| D3 | `field_key` mutability | Auto-derived from label; immutable once values may exist (treated as new field if changed) |
| D4 | Category delete | RESTRICT + UI guard (mirrors catalog), not SET NULL |

## 16. Backend layering

- `domain/categories/categories.domain.ts`, `categories.errors.ts`
- `domain/_interfaces/category.interface.ts`, `domain/_repositories/category.repository.ts`
- `infrastructure/repositories/categoryDb/*`
- `infrastructure/routes/admin/categories/*`
- Asset touchpoints: `assets.domain.ts` (`resolveCustomFields`), `assetDb.*`, `assets.doc.ts`, `assetApi.mapper.ts`

## 17. Reference: touchpoints

| Path | Role |
|------|------|
| `categories.domain.ts` | CRUD, field normalization, delete guard |
| `assets.domain.ts` | `resolveCustomFields`, CATEGORY/CUSTOM_FIELDS transactions |
| `admin.categories.tsx` | Admin UI + field editor |
| `admin.assets.tsx` | Category selector + dynamic field inputs |

---

*End of specification.*
