# Bulk asset assignment + multi-asset custody PDF

- **Document ID:** SPEC-BULK-ASSIGN-001
- **Status:** Implemented
- **Last updated:** 2026-06-03
- **Related E2E requirements:** REQ-BULK-ASSIGN-001 (`e2e/tests/assets/req-bulk-assign-001.spec.ts`)
- **Depends on:** [spec-asset-management.md](spec-asset-management.md), [spec-handover-magic-link.md](spec-handover-magic-link.md), [spec-custody-receipt.md](spec-custody-receipt.md)

## 1. Summary

Admins can check out (assign) or return (unassign) **many assets for one user in a single action**, launched from the existing cross-page selection on the assets list. The wizard reports per-asset success/failure and can download **one custody receipt PDF** covering the whole batch (see [spec-custody-receipt.md](spec-custody-receipt.md) §7.2).

## 2. Scope / non-goals

**In scope:** bulk checkout/return endpoint with direct and verified modes; a 3-step wizard (review → pick user → mode & confirm); batch custody PDF generation.

**Non-goals:** a single handover/email covering multiple assets (handover stays 1:1 per asset — one email per asset in verify mode); bulk upload of a signed PDF to many assets (signed copies are still uploaded per asset); a secondary entry point from the user detail page (planned fast-follow).

## 4. Glossary

- **Checkout** — assign assets to a user (`CHECK_OUT`); result status `ASSIGNED`.
- **Return** — unassign assets from their current owner (`CHECK_IN`); result status `STOCK`.
- **Direct** — apply the change immediately (reuses the admin PATCH path).
- **Verify** — create a magic-link handover per asset; the asset is only assigned once the user accepts (checkout only).

## 6. Decisions

- **D1 — Reuse, don't duplicate.** Direct mode reuses `assets.domain.updateAsset` (keeping Policy A open-handover blocking, `resolveAssignment`, and audit events); verify mode reuses `handovers.domain.createHandover`. The bulk domain only orchestrates and aggregates.
- **D2 — Per-asset, not one transaction.** Each asset is processed independently so a partial failure (e.g. one asset has an open handover) does not roll back the rest. The response lists `succeeded` and `failed` with reasons.
- **D3 — Verify is checkout-only.** `CHECK_IN` + `verify` is rejected (400) because a verified handover models a `CHECK_OUT` of a `STOCK` asset.

## 7. State and business rules

| Flow | Mode | Allowed source status | Result | Blockers |
|------|------|----------------------|--------|----------|
| Checkout | direct | `STOCK`, `MAINTENANCE` | `ASSIGNED` + assignee | open handover; `ARCHIVED`; already `ASSIGNED` |
| Checkout | verify | `STOCK` only | unchanged until accept; one `OPEN` handover per asset | open handover; non-`STOCK` |
| Return | direct | `ASSIGNED` to the chosen user | `STOCK` + clear assignee | open handover; assigned to a different user |

The wizard mirrors these rules client-side in step 1, splitting the selection into eligible / not-eligible (with a short reason) so the admin sees the outcome before submitting. Only eligible ids are sent.

## 9. API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/p/asset-assignments/bulk` | `{ type: 'CHECK_OUT'｜'CHECK_IN', mode: 'direct'｜'verify', targetUserId, assetIds[] }` → `{ succeeded: [{assetId}], failed: [{assetId, code, message}] }`. Capability `assets:write`. |
| POST | `/api/p/custody-documents/generate-batch` | Multi-asset custody PDF — see [spec-custody-receipt.md](spec-custody-receipt.md) §9. |

The bulk endpoint always returns 200 with the aggregated report (individual failures are not HTTP errors); only request-level problems (bad body, `verify`+`CHECK_IN`) return 4xx.

## 12. UI

Assets list (`admin.assets.tsx`): the sticky selection bar (shared with QR print) gains an **"Assign to user…"** action that opens `BulkAssignWizard`:

1. **Review** — toggle Checkout/Return; eligible vs not-eligible table; remove rows.
2. **Pick user** — async `SearchSelect` (same user fetch as the single-asset form).
3. **Mode & confirm** — Direct/Verify radio (checkout only) with an "N confirmation emails will be sent" warning for verify; optional condition/accessories for the PDF; **Assign** and **Assign & download PDF**.

For "Assign & download PDF" the PDF is generated **before** the bulk change is applied, so a return receipt still sees the assets as `ASSIGNED`.

The cross-page selection is held by `useAssetTableSelection`, which keeps each row's `{ id, name, serialNumber, status, assignedUserId, assignedUserName, siteName }` so eligibility can be decided without re-fetching.

## 14. Acceptance criteria

Mirrors `e2e/tests/assets/req-bulk-assign-001.spec.ts`:

- **AC-001.1** — Bulk **direct** checkout of two `STOCK` assets assigns both to the user (status `ASSIGNED`, assignee set) and emits `ASSIGNED` audit events; `succeeded` lists both, `failed` empty.
- **AC-001.2** — A mixed batch (`STOCK` + `ARCHIVED`) succeeds for the eligible asset and reports the `ARCHIVED` one in `failed`; the archived asset is unchanged.
- **AC-001.3** — Bulk **verify** checkout opens one `OPEN` handover per asset and leaves the assets in `STOCK` (no assignment until accept).
- **AC-001.4** — `generate-batch` returns a single `application/pdf` (`%PDF-` signature, non-trivial size) covering the selected assets.

## 20. Codebase corrections

(none)
