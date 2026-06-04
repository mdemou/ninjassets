# Feature specification: Custody receipt (printable PDF + signed upload)

- **Document ID:** SPEC-CUSTODY-DOC-001
- **Status:** Implemented
- **Last updated:** 2026-06-02
- **Related requirements (E2E):** REQ-CUSTODY-DOC-001
- **Depends on:** spec-asset-management.md, spec-handover-magic-link.md, spec-platform-access-model.md

---

## 1. Summary

Admins can **generate and print** a professional **custody receipt** (checkout or check-in) between the **organization** and an **employee**, aligned with common ITAM practice (tabular asset/assignee blocks, terms, signature lines). After the employee signs on paper, an admin **uploads** the scanned or signed PDF; the file is **stored per asset**, listed in custody history, and **previewed** on the admin asset detail page.

This complements — does not replace — existing custody flows:

| Flow | Channel | Proof |
|------|---------|--------|
| Direct assign | Admin PATCH | Platform audit only |
| Verified handover | Email magic link | `CUSTODY_ACCEPTED` transaction |
| **Custody receipt (this spec)** | Print → sign → upload | Archived PDF on asset |

- **Primary users:** admins (generate, print, upload, preview, delete).
- **Assignees:** no upload in v1 (admin collects signed copy); optional later: user upload from personal workspace.
- **Out of scope for v1:** e-signature providers (DocuSign), multi-tenant branding UI (use configurable org name + placeholder logo like QR spec).

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Standardized, printable checkout/check-in document with asset + user + company fields. |
| G2 | Persistent storage of signed PDFs linked to an asset (and optionally a handover). |
| G3 | In-browser PDF preview on `/admin/assets/{assetId}` without downloading. |
| G4 | Audit trail when documents are uploaded or removed. |
| G5 | Work with both verified handover and direct assign (receipt not tied exclusively to magic link). |

## 3. Non-goals (v1)

- Legally binding e-sign inside the product.
- User self-upload of signed receipts.
- Automatic OCR or signature detection.
- Replacing magic-link verification or direct assign.
- Public/unauthenticated access to custody PDFs.
- Bulk print across many assets (single-asset + optional batch later).

## 4. Glossary

| Term | Definition |
|------|------------|
| Custody receipt | PDF document for CHECK_OUT or CHECK_IN between organization and employee. |
| Template generation | Server- or client-rendered PDF/HTML filled with current asset + assignee data at print time. |
| Signed copy | PDF uploaded after physical signature (scan or digital export). |
| Custody period | Time between a CHECK_OUT receipt and the matching CHECK_IN receipt (logical; not a DB entity in v1). |

## 5. Personas and user stories

### 5.1 Admin

| ID | Story | Priority |
|----|-------|----------|
| US-CR1 | Print a checkout receipt when assigning or starting verified checkout. | Must |
| US-CR2 | Print a check-in receipt when requesting return or before direct return to stock. | Must |
| US-CR3 | Upload the signed PDF and see it on the asset detail page. | Must |
| US-CR4 | Preview uploaded PDFs inline (new tab optional). | Must |
| US-CR5 | See list of all custody documents for an asset (newest first). | Must |
| US-CR6 | Delete an incorrectly uploaded file. | Should |
| US-CR7 | Link uploaded receipt to an open or completed handover when applicable. | Should |

### 5.2 Assignee

| ID | Story | Priority |
|----|-------|----------|
| US-CR8 | (v2) Upload signed copy from personal workspace. | Could |

## 6. Relationship to handover and assignment

```
┌──────────────────────────────────────────────────────────────────┐
│ Optional parallel tracks (any combination per custody event)      │
├──────────────────────────────────────────────────────────────────┤
│ A) Admin: direct assign OR verified handover → platform state     │
│ B) Admin: Print custody receipt → user signs offline                │
│ C) Admin: Upload signed PDF → archived on asset                     │
└──────────────────────────────────────────────────────────────────┘
```

**Rules**

- Printing a receipt **does not** change asset status or create a handover.
- Uploading a signed PDF **does not** complete a handover or assign an asset (admin must still use existing flows).
- When `handover_id` is provided at upload or auto-linked, the document appears in context of that handover in the UI.
- Recommended UX copy: *"Upload does not confirm custody in the system; use verified handover or assign as today."*

## 7. State and business rules

### 7.1 Document types

| `type` | When used | Typical asset state at print |
|--------|-----------|------------------------------|
| `CHECK_OUT` | Employee receives equipment | STOCK (pending handover) or ASSIGNED (direct assign) |
| `CHECK_IN` | Employee returns equipment | ASSIGNED |

### 7.2 Template content (industry-style layout)

Single-page (allow 2 pages if accessories list is long) PDF with:

1. **Header** — Organization legal/display name (`CUSTODY_ORG_NAME` env), optional logo (reuse QR placeholder until tenant branding).
2. **Document title** — e.g. *Equipment Custody Receipt — Assignment* / *— Return*.
3. **Reference** — Document ID (uuid short), print date, optional `handover_id`. For a single-asset receipt this also shows the asset id; a multi-asset (batch) receipt shows an asset **count** instead.
4. **Parties table**

   | Field | Source |
   |-------|--------|
   | Organization | Config + support contact line (optional env) |
   | Employee name | `target_user` or current `assigned_user` |
   | Employee email | User record |
   | Employee ID / department | User profile fields if present; else blank |

5. **Asset table** — rendered as a **grid with one row per asset** (so a single receipt can cover a batch from the bulk-assign wizard). Column headers repeat on each page when the batch spills past the first page.

   | Column | Source |
   |--------|--------|
   | Asset name | Asset |
   | Model | Asset |
   | Serial number | Asset |
   | Category | Category name if set |
   | Site / location | Site name |

   The **Condition at handover** (print-dialog dropdown: New / Good / Fair) and **Accessories included** (free text) are shared across the whole batch and rendered as label/value rows **below** the grid. A single-asset receipt is just a one-row grid.

6. **Terms** — Short standard clauses (care, reporting loss, return on termination, data security); rendered in the **admin's current UI locale** (EN/ES) from a static template-text map (same policy as handover emails for v1).
7. **Signature block** — Two columns: *Employee* and *Authorized representative (IT/Admin)* with printed name, signature line, date.
8. **Footer** — Platform name + "Generated by {app} on {ISO date}".

### 7.3 Upload validation

- Content-Type: `application/pdf` only.
- Max size: **10 MB** (configurable).
- Store original bytes (no image pipeline).
- Filename on disk: `{uuid}.pdf` (never expose raw path).
- Optional `document_date` (date written on form) — admin-entered, default today.

### 7.4 Lifecycle

```
[Generate template] → (print) → user signs offline
       → [Admin upload] → STORED
       → [Admin delete] → removed from disk + row deleted + audit
```

### 7.5 Audit

Extend `transaction_action` (migration):

- `CUSTODY_DOCUMENT_UPLOADED`
- `CUSTODY_DOCUMENT_DELETED`

The audit log row (`transaction`) exposes a single `detail: string | null` column (see `ICreateTransaction` in `transaction.interface.ts`) — there is no structured metadata column. Flatten the relevant context into `detail` (e.g. `type` plus the document id / original filename), following the handover precedent (`detail: input.type`).

## 8. Data model

### 8.1 Table: `asset_custody_document`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `date_created` | timestamp | |
| `asset_id` | uuid FK → asset | ON DELETE CASCADE |
| `type` | enum `CHECK_OUT`, `CHECK_IN` | |
| `handover_id` | uuid FK → handover, nullable | ON DELETE SET NULL |
| `storage_filename` | string | Opaque name on disk |
| `original_filename` | string | User-facing upload name |
| `file_size_bytes` | integer | |
| `document_date` | date nullable | Date on signed form |
| `condition_at_handover` | string nullable | From print dialog |
| `accessories_note` | text nullable | From print dialog |
| `uploaded_by_user_id` | uuid FK → user | Admin |
| `notes` | text nullable | Admin comment |
| `created_by_user_id` | uuid FK → user | Who generated or uploaded |

**Indexes:** `asset_id`, `handover_id`, `(asset_id, date_created DESC)`.

No partial unique constraint — multiple CHECK_OUT documents allowed over asset lifetime (re-assignments).

### 8.2 Storage

- Path: `CUSTODY_DOCUMENT_STORAGE_PATH` (default `./uploads/custody-documents`).
- Separate from `ASSET_IMAGE_STORAGE_PATH` (PDFs are not processed with Sharp).

## 9. API specification

### 9.1 Admin (`JWTAdminOrApiKey`)

Matches the auth strategy of the existing asset routes (e.g. `assetImage.route.ts`), and uses the `{id}` asset path param for consistency.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/p/assets/{id}/custody-documents` | List documents for asset (newest first). |
| POST | `/api/p/assets/{id}/custody-documents/upload` | Multipart or raw body PDF; body fields: `type`, `handoverId?`, `documentDate?`, `notes?`. |
| GET | `/api/p/assets/{id}/custody-documents/{documentId}` | Metadata only. |
| GET | `/api/p/assets/{id}/custody-documents/{documentId}/file` | Stream PDF (`Content-Type: application/pdf`, `Content-Disposition: inline` for preview). |
| DELETE | `/api/p/assets/{id}/custody-documents/{documentId}` | Remove file + row + audit. |
| POST | `/api/p/assets/{id}/custody-documents/generate` | Body: `{ type, targetUserId?, handoverId?, condition?, accessoriesNote? }` → returns PDF bytes **or** `{ downloadUrl }` (implementation choice). |
| POST | `/api/p/custody-documents/generate-batch` | Body: `{ type, assetIds[], targetUserId?, condition?, accessoriesNote? }` → returns one PDF covering all assets. Not nested under an asset id. |

**Generate preconditions**

- `CHECK_OUT`: asset exists; if `targetUserId` omitted, use proposed assignee from open CHECK_OUT handover or current assignee.
- `CHECK_IN`: asset `ASSIGNED`; assignee required on template.
- Invalid type for status → 400.

**Batch generate preconditions** (`generate-batch`)

- `CHECK_OUT`: `targetUserId` required; every asset must be `STOCK`/`MAINTENANCE` or already `ASSIGNED` to that user (so the receipt can be printed before or after the bulk assign).
- `CHECK_IN`: every asset `ASSIGNED` to the **same single** user; that user is the employee on the receipt.
- The batch PDF is **not stored**; signed copies are still uploaded per asset via the per-asset upload endpoint.

**Errors**

| Code | Condition |
|------|-----------|
| 400 | Not a PDF / over size limit |
| 404 | Asset or document not found |

### 9.2 Personal (`JWTAdminAndUser`)

- **v1:** no endpoints (read-only preview is admin-only).

## 10. Email

None in v1.

## 11. Frontend

### 11.1 Admin asset detail (`/admin/assets/{assetId}`)

New section **Custody documents** (below **Custody / Handover**):

- **Actions:** *Print checkout receipt*, *Print return receipt* (opens print dialog or downloads PDF).
- **Upload:** file input (PDF only) + type selector + optional link to open handover + notes.
- **List:** table — type, document date, uploaded at, uploaded by, handover link, actions (Preview, Download, Delete).
- **Preview:** modal or side panel with `<iframe src=".../file">` or PDF.js; fallback "Open in new tab".

Print dialog (before generate): condition, accessories note, confirm assignee name.

### 11.2 Handover panel integration

- When open handover exists: shortcut *Print receipt* pre-fills type and `handoverId`.
- After handover consumed: prompt *Upload signed receipt?* (non-blocking toast).

### 11.3 i18n

Keys under `custodyDocument.*` in `translations.ts` (EN + ES).

## 12. Security

| Control | Detail |
|---------|--------|
| Access | Admin/API-key read/write via `JWTAdminOrApiKey` (matches other asset routes) |
| Path traversal | `path.basename` on stored filenames |
| MIME | Hapi route `allow: ['application/pdf']` + domain re-check of `%PDF-` magic bytes |
| Cache | `Cache-Control: private` on file GET |
| IDOR | Document routes scoped under asset `{id}` |

## 13. Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `CUSTODY_DOCUMENT_STORAGE_PATH` | `./uploads/custody-documents` | PDF storage |
| `CUSTODY_DOCUMENT_MAX_BYTES` | 10485760 | Upload limit |
| `CUSTODY_ORG_NAME` | app name | PDF header |
| `CUSTODY_ORG_LOGO_PATH` | optional | Header logo |

## 14. Acceptance criteria (E2E)

Folder: `e2e/tests/custody-documents/`.

### REQ-CUSTODY-DOC-001

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Admin generates CHECK_OUT PDF for STOCK asset + user → 200 with `Content-Type: application/pdf` and a valid `%PDF-` document (data embedding verified at the domain/service level). |
| AC-001.2 | Admin uploads PDF → listed on asset detail; `CUSTODY_DOCUMENT_UPLOADED` in history. |
| AC-001.3 | Admin opens preview → iframe/new tab shows PDF (200, `application/pdf`). |
| AC-001.4 | Admin deletes document → removed from list and disk; audit `CUSTODY_DOCUMENT_DELETED`. |
| AC-001.5 | Upload non-PDF → 400. |
| AC-001.6 | Generate CHECK_IN for STOCK asset → 400. |

## 15. Implementation phases

| Phase | Scope |
|-------|-------|
| P1 | Migration, storage service, upload/list/get/delete API, audit actions |
| P2 | PDF generation (server-side recommended: `pdfkit` or similar) |
| P3 | Asset detail UI: print, upload, list, preview |
| P4 | E2E REQ-CUSTODY-DOC-001; spec-index + e2e-testing.md |

## 16. Backend layering

- `custodyDocument.domain.ts` — validation, audit emission.
- `custodyDocument.repository.ts` + DB repo.
- `custodyDocumentPdf.service.ts` — template rendering.
- `uploadedDocument.service.ts` — generic PDF store (parallel to `uploadedImage.service.ts`).
- Routes: `infrastructure/routes/admin/assets/custodyDocuments/`.

## 17. Open decisions

| # | Question | Proposal |
|---|----------|----------|
| D1 | PDF generation: server vs client HTML print? | **Server PDF** for consistent layout; optional client print CSS later. |
| D2 | Require signed upload before complete handover? | **No** — optional archival only. |
| D3 | One document per handover max? | **No** — allow re-upload; UI shows all. |
| D4 | Show documents on personal `/assets`? | **No** in v1. |
| D5 | Org branding | Env vars v1; tenant settings later. |

## 18. Documentation updates

- `docs/spec-index.md` — registry entry.
- `spec-handover-magic-link.md` §3 — cross-link; clarify signature is physical via this spec.
- `spec-asset-management.md` §11 — custody documents section.
- `docs/e2e-testing.md` — coverage row (when E2E is added).

## 19. Reference: touchpoints

| Area | Note |
|------|------|
| Handover | `handover` table, admin asset handover panel |
| Asset detail | `admin.assets.$assetId.tsx` |
| Image upload pattern | `assetImage.domain.ts`, `uploadedImage.service.ts` |
| QR / print | `admin.assets.print-qr.tsx` (client print precedent) |
| Transactions | `transaction_action` enum migration pattern |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | Handover non-goals | SPEC-HANDOVER-001 §3 lists "signature" as v1 non-goal for **magic link**; this spec adds **offline** signature archive without changing handover API. |
| 2 | No existing PDF storage | Greenfield; do not reuse WebP image pipeline. |
| 3 | Open handover block | Unchanged; document upload does not PATCH asset. |

---

*End of specification.*
