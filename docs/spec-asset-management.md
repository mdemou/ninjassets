# Feature specification: Asset management (core)

- **Document ID:** SPEC-ASSET-001
- **Status:** Implemented
- **Last updated:** 2026-05-31
- **Related requirements (E2E):** REQ-ASSET-001
- **Depends on:** spec-platform-access-model.md, spec-site-location-management.md, spec-itam-catalog.md, spec-handover-magic-link.md (blocking rules), [spec-custody-receipt.md](spec-custody-receipt.md) (custody PDFs)

---

## 1. Summary

IT asset **inventory** with a strict **lifecycle**, **assignee rules**, **omnipresent search**, optional **site** and **catalog** links, and **warranty/return date** fields. Admins manage all assets via `/admin/assets`; users see assigned assets read-only via `/api/me/assets`.

- **Lifecycle:** `STOCK`, `ASSIGNED`, `MAINTENANCE`, `ARCHIVED`.
- **Assignment rule:** `assigned_user_id` only when `ASSIGNED`; enforced in `resolveAssignment`.
- **Handover interaction:** Open handover blocks direct `status` / `assignedUserId` PATCH (409).
- **Categories (proposed):** an admin-defined **category** (Laptop, Mobile, Server, License, …) gives each asset a set of **type-specific custom fields** rendered on demand. See **§21**.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Single source of truth for asset state and ownership. |
| G2 | Prevent orphan assignee data on non-ASSIGNED statuses. |
| G3 | Fast admin search across name, model, serial, assignee display name. |
| G4 | Audit all mutations via transaction log. |
| G5 | Coexist with verified handover without breaking direct assign. |

## 3. Non-goals (v1)

- Asset parent/child hierarchy UI (fields may exist for future use).
- Depreciation calculations in UI (enum may exist on model).
- Bulk import/export (see [spec-import-export.md](spec-import-export.md) — SPEC-IMPORT-001).
- Per-category custom fields are **not yet implemented**; the design is captured as a proposed extension in **§21**.

## 4. Glossary

| Term | Definition |
|------|------------|
| Direct assign | Admin PATCH immediately sets ASSIGNED + assignee |
| Effective coordinates | `COALESCE(asset.lat/lng, site.lat/lng)` on read |

## 5. Personas and user stories

### 5.1 Admin

| ID | Story | Priority |
|----|-------|----------|
| US-AM1 | Create, edit, delete assets. | Must |
| US-AM2 | Assign user → ASSIGNED; clear assignee when leaving ASSIGNED. | Must |
| US-AM3 | Search and paginate the asset list. | Must |
| US-AM4 | Set site, manufacturer, vendor, warranty/return dates. | Should |

### 5.2 User

| ID | Story | Priority |
|----|-------|----------|
| US-AM5 | View only assets assigned to me (read-only). | Must |

## 6. Lifecycle

```
STOCK ──assign──► ASSIGNED ──return──► STOCK
  │                    │
  ├──► MAINTENANCE     ├──► MAINTENANCE (clears assignee)
  └──► ARCHIVED        └──► ARCHIVED (clears assignee)
```

| Status | assigned_user_id |
|--------|------------------|
| ASSIGNED | Required (valid ACTIVE user) |
| Other | Forced `null` |

## 7. State and business rules

### 7.1 Domain (`assets.domain.ts`)

- `resolveAssignment` — lifecycle + assignee consistency
- `deriveUpdateEvents` — transaction actions: CREATED, UPDATED, ASSIGNED, UNASSIGNED, STATUS_CHANGED, SITE_CHANGED, WARRANTY_CHANGED, RETURN_DATE_CHANGED, DELETED
- `assertOpenHandoverBlocksDirectMutation` — when handover repo injected on admin PATCH
- Unique `serial_number`
- FK validation for site, manufacturer, vendor

### 7.2 Handover blocking (policy A)

When `handoverRepository` reports open handover on asset:

- Reject PATCH changing `status` or `assignedUserId` → **409**
- Other fields (name, note, site, dates) still allowed

### 7.3 Unassignment email

Clearing assignee may trigger `asset-unassigned` email (see email spec).

## 8. Data model

**Table `asset`** (migrations `create_assets`, `itam_catalogs_and_asset_fields`, warranty/return migration):

| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `name`, `model`, `serial_number` | |
| `status` | `asset_status` enum |
| `assigned_user_id` | FK user, nullable |
| `site_id` | FK site, ON DELETE SET NULL |
| `manufacturer_id`, `vendor_id` | FK catalog |
| `warranty_end_date`, `expected_return_date` | date |
| `image_filename`, `note` | |
| `latitude`, `longitude` | optional override |
| Financial / depreciation fields | optional |
| `category_id` *(proposed)* | FK category, nullable, ON DELETE RESTRICT — see §21 |
| `custom_fields` *(proposed)* | jsonb `{}` — per-category values, validated in domain — see §21 |

**Enum `asset_status`:** STOCK, ASSIGNED, MAINTENANCE, ARCHIVED

## 9. API specification

### Admin (`JWTAdmin`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/p/assets` | List (`search`, `page`, filters) |
| GET | `/api/p/assets/{id}` | Detail + transactions |
| POST | `/api/p/assets` | Create |
| PATCH | `/api/p/assets/{id}` | Update |
| DELETE | `/api/p/assets/{id}` | Delete |
| GET | `/api/p/assets/{id}/transactions` | Asset history |

### Personal (`JWTAdminAndUser`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/me/assets` | Caller's assigned assets only |

Pagination: server `ADMIN_PAGE_SIZE`; client sends `search`, `page`.

## 10. Email

Optional unassignment notification (spec-email-notifications.md).

## 11. Frontend

| Route | Purpose |
|-------|---------|
| `/admin/assets` | List, create/edit/delete modals |
| `/admin/assets/{assetId}` | Detail, handover panel, custody documents (see [spec-custody-receipt.md](spec-custody-receipt.md)), history |
| `/assets` | Personal read-only list + map |

Assignee combobox only when status ASSIGNED.

## 12. Security

| Control | Detail |
|---------|--------|
| Admin-only writes | JWTAdmin on `/api/p/assets` |
| Personal read scope | `/api/me/assets` filters `assigned_user_id = caller` |

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `ADMIN_PAGE_SIZE` | List page size |
| `ASSET_IMAGE_STORAGE_PATH` | Images (see media spec) |

## 14. Acceptance criteria (E2E)

From `e2e/tests/assets/req-asset-001.spec.ts`:

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Create asset → listed; DB status STOCK. |
| AC-001.2 | Create with assignee → ASSIGNED + assignee id. |
| AC-001.3 | Edit ASSIGNED → In Stock → STOCK, assignee null. |
| AC-001.4 | Search "Alpha" → only matching rows. |
| AC-001.5 | Delete → removed from DB. |
| AC-001.6 | Open CHECK_OUT handover → PATCH assign → 409; stays STOCK. |

## 15. Implementation phases

| Phase | Status |
|-------|--------|
| P1 | CRUD + lifecycle | Done |
| P2 | Catalog + site FKs | Done |
| P3 | Warranty/return + handover block | Done |

## 16. Backend layering

- `domain/assets/assets.domain.ts`
- `infrastructure/routes/admin/assets/assets.route.ts`
- `infrastructure/routes/me/me.route.ts`

## 17. Open decisions (resolved)

| # | Decision |
|---|----------|
| D1 | Block PATCH during open handover | Yes (status/assignee only) |
| D2 | CHECK_OUT from MAINTENANCE | No (handover spec) |
| D3 | Custom-field value storage | **JSONB on asset** validated against `category_field` defs (not EAV, not subtype tables) — see §21.7 |

## 18. Documentation updates

- README Asset Management
- spec-handover-magic-link.md §6
- spec-custody-receipt.md — printable custody PDF + signed upload
- spec-import-export.md — bulk import/export (draft)

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `assets.domain.ts` | resolveAssignment, transactions |
| `asset.interface.ts` | IAssetStatus |
| `admin.assets.tsx` | Admin UI |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | handoverRepository optional | Only admin PATCH injects blocker |
| 2 | AC-001.6 | Regression for policy A |

---

## 21. Proposed extension: Asset categories and custom fields

> **Status:** Implemented — see [spec-asset-categories.md](spec-asset-categories.md) (SPEC-CATEGORY-002) for the as-built specification. The design below is retained for context. (Implementation refinement: field definitions are managed **embedded** in the category create/update payload — replace-all — rather than via the granular `/fields` endpoints sketched in §21.6.)
>
> Adds type-specific fields so a *Laptop*, *Mobile*, *Server*, or *Software License* can capture data a generic asset cannot, without a developer-authored migration per type.

### 21.1 Motivation and principles

Different asset types need different attributes (a laptop has RAM/CPU; a license has seat count and expiry; a server has rack position). The platform principle is **hide anything not actively used** — so rather than bloating the asset form with every conceivable column, an asset belongs to **one admin-defined category**, and only that category's fields are rendered.

This mirrors existing conventions:

- **Normalized master data** like `manufacturer` / `vendor` (separate table, not embedded strings — catalog decision D1).
- **Admin self-service**: admins define categories and their field schema through the UI — no code/migration to add a field (this drives the JSONB storage choice, §21.7).
- **Delete-guard when in use** (catalog §7).
- **UPPER_SNAKE enums** with i18n display labels.

### 21.2 Entities

**`category`** — admin-managed master data, parallel to `manufacturer`/`vendor`.

| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `date_created`, `date_updated` | timestamps |
| `name` | unique case-insensitive (`LOWER(TRIM(name))`), e.g. "Laptop" |
| `icon` | optional short key for friction-free UI list (nullable) |
| `description` | optional |

**`category_field`** — the custom-field *schema* for a category (one row per field).

| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `category_id` | FK → category, **ON DELETE CASCADE** (schema belongs to the category) |
| `field_key` | stable machine key, snake_case, **unique within category** — the JSONB key |
| `label` | display label / i18n key |
| `data_type` | enum `category_field_type` (§21.3) |
| `required` | boolean, default false |
| `options` | jsonb — allowed values for `SELECT` / `MULTI_SELECT`; else null |
| `help_text`, `placeholder`, `unit` | optional UI hints |
| `sort_order` | integer — render order on the form |
| `date_created`, `date_updated` | timestamps |

**`asset`** gains two columns (see §8):

- `category_id` — nullable FK → category, **ON DELETE RESTRICT** (mirrors catalog: cannot delete a category still referenced by assets).
- `custom_fields` — `jsonb NOT NULL DEFAULT '{}'` — map of `field_key → value` for the asset's category.

### 21.3 Field types — enum `category_field_type`

`TEXT`, `TEXTAREA`, `NUMBER`, `BOOLEAN`, `DATE`, `SELECT`, `MULTI_SELECT`.

(Extensible later: `URL`, `EMAIL`, `CURRENCY`. New values append-only, matching the existing `transaction_action` enum practice.)

### 21.4 Domain validation (`assets.domain.ts`)

A `resolveCustomFields(category, fieldDefs, input)` helper, called on create/update alongside `resolveAssignment`:

- **No category** → `custom_fields` must be `{}` (reject non-empty).
- **Unknown keys** → reject any key not defined in the category's `category_field` set (422).
- **Required** → every `required` field must be present and non-empty.
- **Type checks / coercion** — `NUMBER` numeric, `DATE` ISO `YYYY-MM-DD`, `BOOLEAN` true/false, `SELECT` value ∈ `options`, `MULTI_SELECT` subset of `options`. Unknown/extra select values rejected.
- **Category change** → re-validate against the new category's schema; values whose `field_key` is absent in the new category are **dropped** (not silently kept). Surfaced as a `CATEGORY_CHANGED` transaction.

### 21.5 Lifecycle / transactions

Add transaction actions (append-only to `transaction_action`):

- `CATEGORY_CHANGED` — category set/changed/cleared.
- `CUSTOM_FIELDS_CHANGED` — one or more custom values edited (diff stored in transaction metadata).

Category and custom fields are **independent of the STOCK/ASSIGNED lifecycle** — they describe *what* the asset is, not *who holds it*. No handover-block interaction (custom fields stay editable during an open handover, like name/note — §7.2).

### 21.6 API

**Categories (`JWTAdmin`)** — mirrors manufacturers/vendors.

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/p/categories` | List (`search`, `page`; omit `page` for full list) / create |
| GET/PATCH/DELETE | `/api/p/categories/{id}` | Detail (incl. fields) / update / delete (RESTRICT if in use) |
| GET/POST | `/api/p/categories/{id}/fields` | List / add a field definition |
| PATCH/DELETE | `/api/p/categories/{id}/fields/{fieldId}` | Edit / remove a field definition |

- Asset list filter: add `categoryId` to `IListAssetsParams` and `GET /api/p/assets`.
- Asset create/update payloads gain `categoryId` and `customFields` (validated per §21.4).
- Personal read (`/api/me/assets`) returns resolved `customFields` + their labels read-only.

### 21.7 Value storage — decision (D3)

| Option | Verdict | Rationale |
|--------|---------|-----------|
| **JSONB `custom_fields` on asset, validated in domain against `category_field`** | **Chosen** | Admins add fields with no migration; flexible; single-row reads; fits self-service goal. Per-field querying available later via a GIN index. |
| EAV table `asset_field_value (asset_id, field_id, value)` | Rejected (v1) | Stronger relational integrity and per-field indexing, but heavier joins and more code than the admin-self-service goal warrants now. Revisit if reporting needs per-field SQL filters/aggregates. |
| Subtype table per category | Rejected | Rigid; every new category needs a developer migration — directly contradicts admin self-service. |

### 21.8 Frontend

| Route | Purpose |
|-------|---------|
| `/admin/categories` | CRUD categories + manage each category's field schema (type, required, options, order) |
| `/admin/assets` (form) | Category selector; on select, **dynamically render only that category's fields** (hide-unused principle); changing category warns about dropped values |
| `/admin/assets/{assetId}` | Show category + custom field values; `CATEGORY_CHANGED` / `CUSTOM_FIELDS_CHANGED` in history |

Delete-category modal shows referencing-asset count and disables delete when in use (mirrors catalog).

### 21.9 Implementation phases

| Phase | Scope |
|-------|-------|
| P1 | `category` + `category_field` tables, CRUD API + `/admin/categories` UI |
| P2 | `asset.category_id` + `custom_fields`, domain validation, dynamic asset form |
| P3 | `categoryId` list filter, history actions, optional GIN index for field search |

### 21.10 Open questions

| # | Question |
|---|----------|
| Q1 | Can a category be renamed/`field_key` changed after values exist? (Proposed: rename label freely; `field_key` immutable once created.) |
| Q2 | Should default/global fields exist across all categories, or only per-category? (Proposed: per-category only in v1.) |
| Q3 | Surface custom field values in omnipresent search (§G3)? (Proposed: out of scope for v1; GIN index enables it later.) |

---

*End of specification.*
