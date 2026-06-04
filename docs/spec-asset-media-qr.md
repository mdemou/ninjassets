# Feature specification: Asset media and QR labels

- **Document ID:** SPEC-ASSET-002
- **Status:** Implemented
- **Last updated:** 2026-05-31
- **Related requirements (E2E):** REQ-ASSET-002, admin-qr-print.spec.ts
- **Depends on:** spec-asset-management.md

---

## 1. Summary

Admins attach **photos** to assets, generate **QR codes** linking to the admin asset detail page, and print **label sheets** for selected assets. Images are stored on disk as **WebP** after server-side processing.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Visual identification on asset detail and lists. |
| G2 | QR encodes URL to `/admin/assets/{id}` for floor scanning. |
| G2b | QR PNG includes a centered company logo (`ninjasset.png` until tenant branding). |
| G3 | Batch print layout driven by client selection state. |
| G4 | Serve images via authenticated admin GET. |

## 3. Non-goals (v1)

- Public QR landing (QR targets admin detail; admin login required).
- Rotating / signed QR payloads.

## 5. Personas and user stories

| ID | Story | Priority |
|----|-------|----------|
| US-M1 | Upload/delete asset image. | Must |
| US-M2 | Download QR PNG for an asset. | Must |
| US-M3 | Print labels for selected assets. | Must |
| US-M4 | View asset detail with history. | Must |

## 9. API specification

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/p/assets/{id}/image` | JWTAdmin | Upload (raw bytes, Content-Type image/*) |
| GET | `/api/p/assets/{id}/image` | JWTAdmin | Serve WebP |
| DELETE | `/api/p/assets/{id}/image` | JWTAdmin | Remove image |
| GET | `/api/p/assets/{id}/qr` | JWTAdmin | QR PNG (encodes admin detail URL) |

## 11. Frontend

| Route | Purpose |
|-------|---------|
| `/admin/assets/{assetId}` | Detail, image, QR download, transaction history |
| `/admin/assets/print-qr` | Print layout; reads `localStorage['ninjasset:qr-print']` |

Selection for print: admin assets list stores selected rows in localStorage before navigating to print page.

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `ASSET_IMAGE_STORAGE_PATH` | Disk storage |
| `FRONTEND_URL` | QR link base |
| `BACKEND_URL` | Optional API base in QR (if used) |

## 14. Acceptance criteria (E2E)

### REQ-ASSET-002

| AC | Given / When / Then |
|----|---------------------|
| AC-002.1 | Upload image → `image_filename` set; GET returns webp. |
| AC-002.2 | Generate QR → downloadable PNG; encodes asset detail URL. |
| AC-002.3 | Asset detail page shows name, serial, history section. |

### admin-qr-print.spec.ts

| AC | Given / When / Then |
|----|---------------------|
| (implicit) | Admin opens print page with items in `ninjasset:qr-print` → print layout shows asset names/serials. |

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `assetImage.route.ts` | Image CRUD |
| `assetQr.route.ts` | QR generation |
| `backend/assets/ninjasset.png` | Center logo (replace with tenant logo later) |
| `admin.assets.print-qr.tsx` | Print UI |
| `uploadedImage.service.ts` | Sharp pipeline |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | QR targets admin URL | Non-admin scanners need admin login |
| 2 | Print state | Client-only localStorage, not server session |

---

*End of specification.*
