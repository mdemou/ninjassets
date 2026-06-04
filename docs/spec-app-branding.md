# Feature specification: App logo and branding

- **Document ID:** SPEC-BRANDING-001
- **Status:** Draft
- **Last updated:** 2026-06-04
- **Related requirements (E2E):** REQ-BRANDING-001 (TBD)
- **Depends on:** spec-platform-access-model.md, spec-public-landing.md, spec-email-notifications.md, spec-custody-receipt.md

---

> **Note on this revision.** This is a **design** spec — customizable branding is not yet implemented. It
> describes the target behaviour so a single admin can white-label the deployment (logo, name, tagline,
> core colors) across the UI, emails, custody PDFs, and asset QR codes. Sections §14 (acceptance criteria)
> and `[CODEBASE FIX]` notes will be filled in during implementation.

## 1. Summary

ninjasset ships with hard-coded **Ninjasset** branding today: static assets under `frontend/public/`,
CSS tokens in `global.css`, `config.appName` in the backend, and duplicated color constants in email
templates. Operators who self-host for their organization need to replace the logo and adjust the
product name without forking the frontend.

This spec introduces a **singleton branding configuration** (one row per deployment) editable by
**ADMIN** users from a new settings page. Branding is served to all clients — including unauthenticated
login and public landing — via an extended `GET /api/session/public-config` response and a public logo
image endpoint.

- **v1 scope:** app display name, optional tagline, square logo mark, primary + secondary brand colors.
- **Unified consumption:** navbar, wordmark, page titles, emails, custody PDF header, asset QR center
  mark, and browser theme color all read from the same branding source.
- **Fallback chain:** database row → environment bootstrap defaults → built-in ninjasset assets.
- **Out of scope for v1:** custom fonts, per-status color overrides, multi-tenant branding, marketing
  CMS, or hiding the public landing page.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Let an admin upload a logo and set the app display name without redeploying the frontend. |
| G2 | Apply branding consistently across authenticated UI, login/register, public landing, docs chrome, emails, custody PDFs, and asset QR codes. |
| G3 | Expose branding to unauthenticated pages via `public-config` (no JWT required). |
| G4 | Preserve sensible defaults so a fresh install looks like today's ninjasset until configured. |
| G5 | Allow operators to seed branding via environment variables for Docker / IaC-first deployments. |
| G6 | Unify `CUSTODY_ORG_NAME` / `CUSTODY_ORG_LOGO_PATH` with the branding model (custody reads branding service). |

## 3. Non-goals (v1)

- **Multi-tenant** or per-site branding (single deployment = single brand).
- Custom **web fonts** or typography scale changes.
- Full **theme editor** (status colors, dark mode palette, semantic tokens remain as today).
- Localized app name / tagline (EN/ES UI strings stay in `translations.ts`; only the brand name is configurable).
- Marketing **CMS**, custom landing layout, or option to disable the public landing page.
- Separate **email-only** or **PDF-only** logo uploads (one logo mark for all surfaces).
- **Favicon pack** upload UI (v1 may derive a favicon from the logo or keep static defaults — see §17 D3).
- Version history / rollback of branding changes (last-write-wins).

## 4. Glossary

| Term | Definition |
|------|------------|
| Branding | The singleton deployment identity: display name, tagline, logo, and primary/secondary colors. |
| Logo mark | Square image used in navbar, wordmark, emails, QR center, and PDF header. |
| Wordmark | Logo mark + display name (gradient text styling may remain; name string is configurable). |
| `public-config` | Unauthenticated `GET /api/session/public-config`; today returns `signupEnabled` only. |
| Fallback chain | Resolution order: DB branding → env bootstrap → built-in ninjasset defaults. |
| Bootstrap defaults | Environment variables applied on first boot or when the DB row is empty. |

## 5. Personas and user stories

### 5.1 Admin (operator)

| ID | Story | Priority |
|----|-------|----------|
| US-B1 | As an admin, I upload our company logo and set our product name from an admin settings page. | Must |
| US-B2 | As an admin, I set primary and secondary brand colors and see the app chrome update. | Must |
| US-B3 | As an admin, I set an optional tagline shown in emails and the public landing footer. | Should |
| US-B4 | As an admin, I can reset branding to the built-in ninjasset defaults. | Should |
| US-B5 | As an admin, I preview how branding looks on login, navbar, and email header before saving. | Could (P2) |

### 5.2 End user (unauthenticated / authenticated)

| ID | Story | Priority |
|----|-------|----------|
| US-B6 | As a visitor on `/login`, I see my organization's logo and name, not the default ninjasset wordmark. | Must |
| US-B7 | As a user, browser tab titles use the configured app name (`Acme ITAM \| Dashboard`). | Must |
| US-B8 | As an assignee, handover emails show my organization's logo and name in the header. | Must |

### 5.3 Operator (DevOps)

| ID | Story | Priority |
|----|-------|----------|
| US-B9 | As an operator, I can seed branding via `.env` on first deploy without using the admin UI. | Should |
| US-B10 | As an operator, branding assets persist on disk across container restarts (volume-mounted upload path). | Must |

## 6. Branding surfaces

Today, identity is scattered across the codebase. v1 centralizes all of the following:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Admin UI  /admin/branding  →  PATCH branding + POST logo                │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ app_branding (DB) + branding logo on disk                               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 GET /api/session/         GET /api/branding/      Backend services
 public-config             logo (image)            (email, PDF, QR)
        │
        ▼
 Frontend: inject CSS vars, Wordmark, Navbar, pageTitle, theme-color meta
```

| Surface | Current touchpoint | v1 behaviour |
|---------|-------------------|--------------|
| Navbar | `Navbar.tsx` — `/ninjasset.png`, hard-coded "Ninjassets" | Logo URL + `appName` from branding context |
| Public wordmark | `Wordmark.tsx` — static PNG + "Ninjasset" | Same shared `BrandWordmark` component |
| Page title | `pageTitle.ts` — `PAGE_TITLE_BRAND = 'Ninjasset'` | `formatPageTitle` uses configured name |
| CSS theme | `global.css` `:root` primary/secondary tokens | Override `--color-primary` and `--color-secondary` (and derived primary scale — see §7.3) via injected `<style>` or `document.documentElement` |
| Login / register | Uses global chrome + `public-config` | Fetch branding with signup flag |
| Public landing `/` | `public-home.tsx` wordmark + footer | Configurable name, logo, tagline |
| Docs `/docs` | `docs.tsx` wordmark | Same as landing |
| Emails | `email/templates/layout.ts` — hard-coded colors + `/ninjasset.png` | Read branding service; inline colors in HTML |
| Custody PDF | `config.custody.orgName` / `orgLogoPath` env | Read branding service (deprecate separate env in docs) |
| Asset QR | `assetQr.service.ts` — `assets/ninjasset.png` | Center mark from uploaded branding logo |
| PWA / favicon | `root.tsx` static `/favicon*.png`, `site.webmanifest` | v1: keep static favicons or derive from logo (§17 D3) |
| Backend logs | `config.appName` | Resolved display name from branding service |

## 7. State and business rules

### 7.1 Singleton configuration

- Exactly **one** branding record per deployment (`app_branding` table, fixed id or single-row constraint).
- First admin save creates the row; until then, fallback chain applies.
- **Reset to defaults** clears the DB row and deletes the uploaded logo file; env/bootstrap defaults apply again.

### 7.2 Who can change branding

| Action | Role |
|--------|------|
| View admin branding page | ADMIN |
| PATCH branding fields | ADMIN |
| Upload / delete logo | ADMIN |
| Read public branding | Unauthenticated (public-config + logo GET) |

Regular **USER** role cannot change deployment branding (distinct from profile avatar in [spec-profile-settings.md](spec-profile-settings.md)).

### 7.3 Color rules

| Field | Validation | Application |
|-------|------------|-------------|
| `primaryColor` | `#RRGGBB` hex | Sets `--color-primary`; v1 also regenerates the primary scale (dark/hover/light/pale) algorithmically from the base, matching today's green ramp proportions |
| `secondaryColor` | `#RRGGBB` hex | Sets `--color-secondary` and secondary scale |
| Status / semantic colors | Not configurable in v1 | Unchanged (`--color-status-*`, danger, etc.) |

Email templates cannot rely on external CSS; when branding colors change, the email layout service reads the same resolved hex values as the web UI.

### 7.4 Logo upload rules

| Rule | Detail |
|------|--------|
| Formats | PNG or JPEG input |
| Processing | Sharp pipeline — **contain** fit inside 512×512, preserve transparency where possible, store as **WebP** on disk (same family as avatars) |
| Max size | 1 MB (reuse `config.uploads.imageMaxBytes`) |
| Min dimensions | Reject if either edge &lt; 64 px after decode |
| Delete | Removing logo reverts to built-in `/ninjasset.png` default in the fallback chain |
| QR compositing | Same stored file; QR service reads from branding storage path, not `assets/ninjasset.png` |

### 7.5 Display name and tagline

| Field | Max length | Required |
|-------|------------|----------|
| `appName` | 64 chars | Yes (default `Ninjasset`) |
| `tagline` | 120 chars | No (default `IT asset management, simplified` — matches email layout today) |

HTML escaping applies anywhere user-provided strings are rendered (emails, PDF text).

### 7.6 Caching

| Layer | Policy |
|-------|--------|
| `public-config` response | `Cache-Control: public, max-age=60` (short TTL; branding changes infrequently) |
| Logo GET | `Cache-Control: public, max-age=3600, immutable` with filename/version in URL or ETag from `updated_at` |
| Frontend context | Load once per full page load; refetch after admin save on the branding page |

## 8. Data model

### 8.1 Table: `app_branding`

Single-row table (enforce via application logic or `CHECK (id = 'default')`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Fixed `'default'` |
| `app_name` | varchar(64) | Display name |
| `tagline` | varchar(120) nullable | Email header / landing footer |
| `logo_filename` | varchar nullable | WebP filename on disk; null = use fallback |
| `primary_color` | char(7) nullable | `#RRGGBB` |
| `secondary_color` | char(7) nullable | `#RRGGBB` |
| `date_updated` | timestamp | |
| `updated_by_user_id` | uuid FK → user nullable | Audit |

No migration of historical values — fresh installs start empty and use fallback chain.

### 8.2 Filesystem

| Path | Purpose |
|------|---------|
| `BRANDING_STORAGE_PATH` (env) | Directory for processed logo WebP files |
| `frontend/public/ninjasset.png` | Built-in fallback (unchanged in repo) |
| `backend/assets/ninjasset.png` | Built-in QR fallback until branding logo exists |

## 9. API specification

### 9.1 Public (no auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/session/public-config` | **Extend** response with branding payload (see §9.3) |
| GET | `/api/branding/logo` | Serve current logo image (fallback PNG when no upload) |

### 9.2 Admin

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/p/branding` | JWTAdmin | Read current branding (including whether values are defaulted) |
| PATCH | `/api/p/branding` | JWTAdmin | Update `appName`, `tagline`, `primaryColor`, `secondaryColor` |
| POST | `/api/p/branding/logo` | JWTAdmin | Upload logo (raw image body, same pattern as avatar routes) |
| DELETE | `/api/p/branding/logo` | JWTAdmin | Remove custom logo |
| POST | `/api/p/branding/reset` | JWTAdmin | Clear DB row + delete logo file (return to fallback chain) |

### 9.3 `public-config` response shape (extended)

```json
{
  "signupEnabled": true,
  "branding": {
    "appName": "Acme ITAM",
    "tagline": "Internal asset tracking",
    "logoUrl": "/api/branding/logo",
    "primaryColor": "#109461",
    "secondaryColor": "#152418"
  }
}
```

When branding is unset, fields reflect **resolved defaults** (env bootstrap or built-in ninjasset values) so clients never branch on null.

### 9.4 Error codes (illustrative)

| Code | HTTP | When |
|------|------|------|
| `BRD4001` | 400 | Invalid hex color |
| `BRD4002` | 400 | Invalid / oversize image |
| `BRD4003` | 400 | `appName` empty or too long |

## 10. Email

Extend [spec-email-notifications.md](spec-email-notifications.md) layout:

- **Header logo:** `GET {FRONTEND_URL}/api/branding/logo` (or backend-proxied URL if emails are rendered server-side with absolute URL helper).
- **App name:** resolved `appName` instead of hard-coded `config.appName`.
- **Tagline:** resolved `tagline` instead of `TAGLINE` constant in `layout.ts`.
- **Colors:** resolved primary/secondary hex values replace `COLORS` constant defaults (structure unchanged).

Plain-text emails use the same resolved name and tagline.

## 11. Frontend

### 11.1 Branding provider

| Element | Behaviour |
|---------|-----------|
| `BrandingProvider` | Wraps app near `PublicConfigProvider`; loads branding from extended `public-config` on mount (all routes, including `/`). |
| CSS injection | On branding load, set `--color-primary`, `--color-secondary`, and generated scale variables on `document.documentElement`. |
| `useBranding()` | Hook: `{ appName, tagline, logoUrl, primaryColor, secondaryColor, isLoading }`. |

**[CODEBASE FIX]** Today `public-home.tsx` intentionally does **not** call `public-config` (see [spec-public-landing.md](spec-public-landing.md)). Branding requires a **minimal** public-config fetch on `/` (branding fields only; no auth side effects) or a dedicated `GET /api/branding` JSON endpoint. Prefer extending `public-config` for one round trip.

### 11.2 Shared components

| Component | Change |
|-----------|--------|
| `Wordmark.tsx` | Rename/generalize to `BrandWordmark` — `logoUrl` + `appName` from context |
| `Navbar.tsx` | Use `BrandWordmark` or shared logo+name fragment |
| `pageTitle.ts` | `formatPageTitle` reads `appName` from branding context (fallback constant for SSR first paint) |

### 11.3 Admin UI

| Route | Access | Content |
|-------|--------|---------|
| `/admin/branding` | ADMIN | Form: app name, tagline, color pickers, logo upload with preview, reset defaults |

Add nav item under admin settings group in `NavItems` / `Sidebar`.

Sections on the page:

1. **Identity** — app name, tagline
2. **Logo** — upload, preview (navbar + email thumbnail mock), remove
3. **Colors** — primary / secondary pickers with live preview swatch
4. **Actions** — Save, Reset to defaults

### 11.4 Meta / PWA

| Item | v1 |
|------|-----|
| `<title>` | Dynamic via branding-aware `pageTitleMeta` |
| `theme-color` meta | Set from `primaryColor` or `secondaryColor` (TBD in §17 D4) |
| `site.webmanifest` | Static file unchanged in v1 unless D3 chooses dynamic manifest |

## 12. Security

| Control | Detail |
|---------|--------|
| Admin-only writes | All `/api/p/branding/*` routes use `JWTAdmin` |
| Image pipeline | Reuse Sharp validation; reject non-image payloads |
| SVG uploads | **Rejected** in v1 (XSS / email client issues) |
| Path traversal | Logo filenames stored as UUID only; `path.basename` on read |
| Public logo endpoint | No auth; serves only the processed logo (no directory listing) |
| HTML injection | Escape `appName` / `tagline` in emails and PDF text |
| Rate limit | Optional: apply upload rate limit consistent with avatar routes |

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `BRANDING_STORAGE_PATH` | Disk directory for logo WebP files (default `./uploads/branding`) |
| `APP_NAME` | Bootstrap display name when DB row empty (default `Ninjasset`) |
| `APP_TAGLINE` | Bootstrap tagline (default `IT asset management, simplified`) |
| `APP_PRIMARY_COLOR` | Bootstrap primary hex (default `#109461`) |
| `APP_SECONDARY_COLOR` | Bootstrap secondary hex (default `#152418`) |
| `BRANDING_LOGO_PATH` | Optional bootstrap logo file copied into storage on first boot (P2; env-only seed) |

**Deprecation:** `CUSTODY_ORG_NAME` and `CUSTODY_ORG_LOGO_PATH` remain supported as **fallbacks** behind the branding service during transition; document removal in a later phase once branding is stable.

Existing `config.appName` in `config.ts` becomes a **code default**; runtime resolution prefers branding service.

## 14. Acceptance criteria (E2E)

**TBD** — Draft spec; E2E lives under `e2e/tests/branding/` once implemented. Planned `REQ-BRANDING-001`:

### REQ-BRANDING-001

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Admin uploads logo + sets app name → navbar and login show new name and logo after reload. |
| AC-001.2 | Admin sets primary color → login button / primary accents reflect new color. |
| AC-001.3 | Unauthenticated `GET /api/session/public-config` → includes `branding.appName` matching admin settings. |
| AC-001.4 | Handover email (MOCK_EMAIL) → HTML contains configured app name and logo URL. |
| AC-001.5 | Custody PDF for an asset → header shows configured org name. |
| AC-001.6 | Asset QR PNG → center mark matches uploaded logo (visual or hash comparison against source). |
| AC-001.7 | Admin reset branding → UI reverts to default ninjasset name and logo. |
| AC-001.8 | Non-admin user → `/admin/branding` not reachable (403 or redirect). |
| AC-001.9 | Invalid hex color on PATCH → 400, no partial update. |
| AC-001.10 | Browser tab title on `/dashboard` → `{appName} \| …` using configured name. |

## 15. Implementation phases

| Phase | Scope | Status |
|-------|-------|--------|
| P1 | Migration `app_branding`; branding domain + repository; resolve service with fallback chain; extend `public-config`; public logo GET | Draft |
| P2 | Admin API (GET/PATCH/logo/reset); Sharp upload scope `branding`; wire email + custody PDF + QR to branding service | Draft |
| P3 | Frontend `BrandingProvider`, `BrandWordmark`, CSS var injection, admin `/admin/branding` page | Draft |
| P4 | Deprecate direct `CUSTODY_ORG_*` usage in ops docs; E2E `REQ-BRANDING-001`; update spec-index + README | Draft |

## 16. Backend layering (proposed)

- `domain/branding/branding.domain.ts` — resolve, update, reset, upload orchestration
- `domain/branding/branding.interface.ts` — `IBranding`, `IResolvedBranding`
- `infrastructure/repositories/brandingDb/brandingDb.repository.ts` — singleton CRUD
- `infrastructure/routes/branding/branding.route.ts` — public logo GET
- `infrastructure/routes/admin/branding/branding.route.ts` — admin CRUD + upload
- `services/branding/brandingResolve.service.ts` — fallback chain (DB → env → built-in)
- `services/branding/colorScale.service.ts` — derive primary/secondary ramps from base hex
- `services/uploadedImage.service.ts` — extend `UploadedImageScope` with `'branding'` (contain fit variant)
- `services/email/templates/layout.ts` — consume `brandingResolve.service`
- `services/custodyDocumentPdf.service.ts` — consume branding for org header
- `services/assetQr.service.ts` — load center logo from branding storage
- `backend/src/config/config.ts` — parse §13 bootstrap variables

## 17. Open decisions

| # | Question | Proposed decision |
|---|----------|-------------------|
| D1 | DB + admin UI vs env-only? | **DB + admin UI**, with env bootstrap for first deploy. |
| D2 | How many colors? | **Primary + secondary** only in v1; status colors fixed. |
| D3 | Favicon / PWA icons? | **P2** — keep static favicons in v1; optionally generate from logo later. |
| D4 | `theme-color` meta source? | **Primary color** (or secondary if primary is too light — compute contrast in P2). |
| D5 | Public landing fetch? | **Extend `public-config`** on all routes including `/` (branding-only; acceptable small API call). |
| D6 | Custody env vars? | **Branding service is canonical**; env vars remain as fallback until P4 docs cleanup. |
| D7 | Logo aspect ratio? | **Square canvas, contain fit** — wide logos letterbox; admin UI shows preview. |
| D8 | Audit trail? | Store `updated_by_user_id` + `date_updated` only; no version history in v1. |

## 18. Documentation updates

- [spec-index.md](spec-index.md) — register SPEC-BRANDING-001.
- [spec-public-landing.md](spec-public-landing.md) — note branding-aware wordmark; revise "no API calls on `/`" if D5 accepted.
- [spec-email-notifications.md](spec-email-notifications.md) — branding-driven header.
- [spec-custody-receipt.md](spec-custody-receipt.md) — org header reads branding service.
- `README.md` — branding / white-label section.
- `.env.example` — add §13 variables; mark `CUSTODY_ORG_*` as legacy fallback.

## 19. Reference: touchpoints (current)

| Path | Role |
|------|------|
| `frontend/app/components/Navbar.tsx` | Hard-coded logo + "Ninjassets" |
| `frontend/app/components/public-landing/Wordmark.tsx` | Hard-coded `/ninjasset.png` + "Ninjasset" |
| `frontend/app/utils/pageTitle.ts` | `PAGE_TITLE_BRAND = 'Ninjasset'` |
| `frontend/app/global.css` | `:root` brand color tokens |
| `frontend/app/root.tsx` | Static favicon links, `theme-color` |
| `frontend/public/site.webmanifest` | Static name / icons |
| `backend/src/config/config.ts` | `appName: 'ninjasset'`; `custody.orgName` / `orgLogoPath` |
| `backend/src/services/email/templates/layout.ts` | Hard-coded `COLORS`, `TAGLINE`, `/ninjasset.png` |
| `backend/src/services/custodyDocumentPdf.service.ts` | `config.custody.orgName` |
| `backend/src/services/assetQr.service.ts` | `assets/ninjasset.png` center mark |
| `backend/src/infrastructure/routes/session/session.controller.ts` | `publicConfig` handler |
| `frontend/app/providers/PublicConfigProvider.tsx` | Client public-config consumer |

## 20. Codebase validation

To be completed during implementation (record `[CODEBASE FIX]` items here):

| # | Item | Detail |
|---|------|--------|
| 1 | Navbar typo | `Navbar.tsx` shows "Ninjassets" (with **s**); wordmark uses "Ninjasset" — branding should use a **single** configured `appName` everywhere. |
| 2 | `config.appName` | Not env-driven today; hard-coded `'ninjasset'` in `config.ts`. |
| 3 | Email colors duplicated | `layout.ts` COLORS must stay in sync with `global.css` manually today — branding service removes duplication. |
| 4 | Public landing no API | [spec-public-landing.md](spec-public-landing.md) §20 item 4 — branding overrides that constraint. |
| 5 | QR comment | `assetQr.service.ts` already notes "until per-tenant company logos are wired in". |

---

*End of specification.*
