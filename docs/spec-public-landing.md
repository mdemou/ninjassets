# Feature specification: Public landing

- **Document ID:** SPEC-PUBLIC-001
- **Status:** Implemented
- **Last updated:** 2026-06-04
- **Related requirements (E2E):** smoke.spec.ts (home 200)
- **Depends on:** spec-internationalization.md

---

## 1. Summary

Unauthenticated visitors land on **`/`** with a minimalist, product-oriented
marketing page that introduces ninjasset. The page is informational only: it does
**not** link to login or registration and does **not** call
`GET /api/session/public-config`. Sign-in and signup entry live on **`/login`**
and **`/register`** (see [spec-authentication.md](spec-authentication.md)).

The page is a single scrollable column composed of a sticky header, hero,
feature grid, "how it works" steps, a closing call-to-action band (copy only),
and a footer. All copy is translated via `useLanguage()` (EN/ES).

On `/`, the global `Navbar` is hidden (`NAVBAR_HIDDEN_PATHS`) and the `Sidebar`
returns `null` (unauthenticated), so the landing owns the full viewport and
renders its own header.

In-app documentation at **`/docs`** uses a separate layout (`docs.tsx`).

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Communicate product value without requiring authentication or runtime config. |
| G2 | Work without authentication; **no** API calls on `/`. |
| G3 | Localized content (EN/ES), with an in-page language toggle. |
| G4 | Communicate ITAM lifecycle, sites, QR, handovers, alerts, and API themes without a CMS. |
| G5 | Route interested readers to docs (`/docs`) from the header and footer. |

## 3. Non-goals (v1)

- Login, register, or signup-gated CTAs on the landing page.
- Marketing CMS, blog, pricing, or interactive product tour.
- Authenticated redirect from `/` (users bookmark `/login` or their role home).
- Imagery/screenshots or external analytics.

## 11. Frontend

| Route | File | Content |
|-------|------|---------|
| `/` | `public-home.tsx` | Sticky header (wordmark, EN/ES toggle, docs nav), hero, 6-card feature grid, 3-step "how it works", closing CTA band (title + subtitle only), footer |
| `/docs/*` | `docs.tsx` + `docs-pages.ts` | Documentation chrome |

`index` route in `routes.ts` maps `/` → `public-home.tsx`.

### Sections (`public-home.tsx`)

| Section | Notes |
|---------|-------|
| Header | Wordmark, in-page nav (Features, How it works, Docs), `LanguageToggle`. Sticky, `backdrop-blur`. No auth links. |
| Hero | Badge pill, two-line headline (accent gradient on second line), subtitle, supporting note. No CTA buttons. |
| Highlights | Short feature labels in a band below the hero. |
| Feature showcases | `FeatureShowcases` component + 6-card feature grid. |
| How it works | 3 numbered steps. |
| Final CTA | Secondary-colored band with title and subtitle only (no buttons). |
| Footer | Wordmark, tagline, Docs + API doc links, dynamic `© <year>` copyright. |

### Signup gating (auth routes, not landing)

`signupEnabled` from `GET /api/session/public-config` is loaded lazily via
`PublicConfigProvider.loadPublicConfig()` on **`/login`** and **`/register`**
only. When signup is disabled, the login page hides the register link and
`/register` redirects to `/login`.

## 14. Acceptance criteria (E2E)

From `e2e/tests/smoke.spec.ts`:

| AC | Given / When / Then |
|----|---------------------|
| Smoke | `GET /` → HTTP 200. |

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `frontend/app/routes/public-home.tsx` | Landing UI |
| `frontend/app/routes/docs.tsx` | Docs layout |
| `frontend/app/data/docs-pages.ts` | In-app documentation content |
| `frontend/app/routes.ts` | `index("routes/public-home.tsx")`, docs layout |
| `frontend/app/utils/translations.ts` | `landing.*` EN/ES copy |
| `frontend/app/providers/PublicConfigProvider.tsx` | Lazy `public-config` fetch for login/register |
| `frontend/app/components/Navbar.tsx` | `NAVBAR_HIDDEN_PATHS` hides nav on `/` |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | Personal dashboard route | `/dashboard` is `home.tsx` (authenticated); unrelated legacy `dashboard-redirect.tsx` is not registered in `routes.ts`. |
| 2 | Color tokens | Only a subset of brand colors are mapped as Tailwind utilities; extended scale tones (e.g. `--color-primary-2x-light`, `--color-primary-pale`, `--color-secondary`) are used via arbitrary `var(--color-*)` classes. |
| 3 | Chrome suppression | Landing renders full-width because `Navbar` is in `NAVBAR_HIDDEN_PATHS` and `Sidebar` returns `null` when unauthenticated. |
| 4 | No public-config on `/` | `public-home.tsx` does not import `usePublicConfig`. |

---

*End of specification.*
