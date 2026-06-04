# ninjasset — Frontend (SPA)

React Router v7 frontend in single-page application mode, with Tailwind CSS v4 and a full authentication flow.

## Rendering Mode

This frontend uses **SPA (single-page application)** mode. The browser loads a static `index.html`, then React Router takes over all rendering and routing client-side. There is no server render step.

Key SPA files:

| File | Purpose |
|---|---|
| `index.html` | Static HTML shell — loads `app/entry.client.tsx` |
| `react-router.config.ts` | Sets `ssr: false` so dev and build stay in SPA mode (React Router defaults to SSR when this file is missing) |

Unlike the SSR variant, there is no `entry.server.tsx`. Production `npm start` uses `@react-router/serve` (same as the SSR template). `@react-router/node` is required at runtime for the dev server and the built server entry. The client assets under `build/client` can alternatively be hosted as a static site with SPA fallback routing to `index.html`.

## Folder Structure

```
app/
  root.tsx                            # Root layout — providers + navbar + outlet
  routes.ts                           # Route definitions
  global.css                          # CSS variables (light/dark) + Tailwind import
  types/
    index.ts                          # Shared TypeScript types
  utils/
    api.ts                            # Fetch wrapper with JWT auth headers
    translations.ts                   # i18n strings (English + Spanish)
  providers/
    AuthProvider.tsx                   # JWT auth state (login, logout)
    SessionProvider.tsx               # User profile data and account actions
    LanguageProvider.tsx              # English / Spanish with t() function
    ErrorProvider.tsx                  # Toast notification system
    PublicConfigProvider.tsx           # Lazy GET /api/session/public-config (login/register)
  components/
    Button.tsx                        # primary | secondary | tertiary | danger
    FormInput.tsx                     # text, email, password, number, date, time, select, checkbox, radio, textarea
    Modal.tsx                         # Dialog overlay with Escape / click-outside close
    Toast.tsx                         # Notification toast (success, error, warning, info)
    Panel.tsx                         # Card container with optional title
    Navbar.tsx                        # Top bar — logo, nav links, language toggle, auth actions
    NavItems.ts                       # Dynamic nav item config based on auth state
    Map.tsx                           # Leaflet/OpenStreetMap: LocationMap (read-only pins) + LocationPicker (click/drag)
    StatCard.tsx                      # Compact KPI tile for dashboards
    HistoryTable.tsx                  # Audit-log table (action badges, optional search, pagination)
  routes/
    login.tsx                         # Login form
    register.tsx                      # Registration form with client-side validation
    forgot-password.tsx               # Password reset request
    reset-password.tsx                # New password form (uses ?token= param)
    verify-email.tsx                  # Auto-verifies on load (uses ?token= param)
    home.tsx                          # Personal dashboard (/dashboard) — own asset count, map, own history (everyone; via /api/me/*)
    public-home.tsx                   # Public marketing landing at / (no auth CTAs, no public-config)
    docs.tsx                          # Documentation layout at /docs
    docs._index.tsx, docs.$section.$page.tsx  # In-app docs pages (content in data/docs-pages.ts)
    profile.tsx                       # Update profile, change password, delete account
    logout.tsx                        # Logs out and redirects
    assets.tsx                        # "My Assets" — read-only list + map of assets assigned to the user
    admin.overview.tsx                # Admin overview — KPIs + Recharts charts + sites map + transactions log
    admin.users.tsx                   # Admin user management
    admin.assets.tsx                  # Admin asset management (CRUD, search, pagination, assignment, site link)
    admin.sites.tsx                   # Admin site management (CRUD, overview map, map picker, delete-with-assets)
    dashboard-redirect.tsx            # Legacy unused redirect to `/` (not registered in routes.ts)
    $.tsx                             # 404 catch-all
index.html                            # Static HTML entry point
react-router.config.ts                # SPA mode (ssr: false)
tailwind.config.ts                    # Theme colors mapped to CSS variables
vite.config.ts                        # Dev server on :3000, proxies /api, /session, /user to backend
package.json
tsconfig.json
Dockerfile
```

## Provider Architecture

Providers are nested in `root.tsx` in dependency order — outermost providers have no dependencies on inner ones:

```
LanguageProvider
  ErrorProvider
    PublicConfigProvider   → signupEnabled; loadPublicConfig() on login/register only
      AuthProvider
        SessionProvider
```

Each provider exports a hook (`useLanguage`, `useError`, `usePublicConfig`, `useAuth`, `useSession`) that throws if used outside its provider tree.

### AuthProvider

- Stores JWT in `localStorage` under `auth_token`.
- `login(email, password)` calls `POST /api/session/login`, stores the token, and returns the `User` object.
- `logout()` calls `GET /api/session/logout` (ignores errors), then clears local state.
- `isLoading` is `true` until the initial localStorage check completes.

### SessionProvider

- Depends on `AuthProvider` — clears user when `isAuthenticated` goes `false`.
- `setUser(user)` is called by the login page after a successful login.
- `updateProfile(data)` calls `PATCH /api/user/profile` and updates local state.
- `changePassword(data)` calls `PATCH /api/session/change-password`.
- `deleteAccount(password)` calls `DELETE /api/user/account` then triggers `logout()`.

### ErrorProvider

- Manages an array of `Toast` objects (id, type, title, message, duration).
- `addToast(toast)` generates an ID via `crypto.randomUUID()` and auto-removes after `duration` ms (default 5000, set to 0 for manual-close-only).
- Renders the toast container (fixed, top-right corner).

### LanguageProvider

- Switches between `en` and `es`.
- `t(key)` looks up the translation in `utils/translations.ts`.
- Translation keys are type-checked — `TranslationKey` is a string literal union derived from the English translations object.
- Persists selection to `localStorage`.

## Styling

Uses **Tailwind CSS v4** with CSS custom properties for theming.

- **`global.css`** — Imports Tailwind and defines `:root` color variables.
- **`tailwind.config.ts`** — Maps semantic color names (`primary`, `secondary`, `danger`, `success`, `warning`, `info`, `surface`, `border`, `input`, `foreground`, `muted`) to the CSS variables so they work as Tailwind classes (e.g. `bg-primary`, `text-danger`).
- Components use Tailwind utility classes exclusively — no CSS modules or component-scoped CSS files.

### Adding Colors

1. Add the CSS variable to `:root` in `global.css`.
2. Map it in `tailwind.config.ts` under `theme.extend.colors`.
3. Use it as a Tailwind class: `bg-your-color`, `text-your-color`, etc.

## API Client

`utils/api.ts` provides `api.get()`, `api.post()`, `api.patch()`, `api.delete()` — all typed with `ApiResponse<T>`.

- Reads the JWT from `localStorage` and attaches an `Authorization: Bearer` header.
- Uses an empty base URL — the Vite dev server proxies `/api`, `/session`, and `/user` to the backend.
- On non-2xx responses, throws the parsed response body. Callers catch and access `error.message`, `error.code`, `error.statusCode`.

## Routes

| Path | Page | Auth Required |
|---|---|---|
| `/` | Public marketing landing (no API calls, no login/signup links) | No |
| `/docs`, `/docs/:section/:page` | In-app documentation | No |
| `/dashboard` | Personal dashboard — own assets + own history (everyone, incl. admins; reads `/api/me/*`) | Yes |
| `/login` | Login form; fetches `public-config` for register link | No (redirects to the role's dashboard if authenticated) |
| `/register` | Registration form; fetches `public-config`, redirects if signup disabled | No |
| `/forgot-password` | Request password reset | No |
| `/reset-password?token=` | Set new password | No |
| `/verify-email?token=` | Email verification | No |
| `/settings` | Profile, language, password, delete account | Yes |
| `/profile` | Redirects to `/settings` | Yes |
| `/logout` | Logs out and redirects | Yes |
| `/assets` | "My Assets" — read-only list + map of assets assigned to the user | Yes |
| `/admin/overview` | Admin overview — analytics, charts, sites map, transactions log | Yes (admin) |
| `/admin/users` | User management | Yes (admin) |
| `/admin/assets` | Asset management (CRUD, search, pagination, assignment, site link) | Yes (admin) |
| `/admin/sites` | Site management (CRUD, overview map, map picker) | Yes (admin) |
| `*` | 404 page | No |

### Auth Guard Pattern

Protected pages check `isAuthenticated` from `useAuth()` and redirect to `/login` via `useNavigate()` inside a `useEffect`. Auth pages (login, register) redirect to the dashboard if already authenticated.

## i18n

Two languages are supported out of the box: **English** (`en`) and **Spanish** (`es`).

- All UI text uses `t('translation.key')` from `useLanguage()`.
- Translation strings live in `utils/translations.ts`.
- The English object uses `as const` for key inference; the Spanish object is typed `Record<keyof typeof en, string>` so the compiler enforces that every key is translated.

### Adding a Language

1. Add the new locale code to the `Language` type in `types/index.ts`.
2. Add a complete translation object in `utils/translations.ts`.
3. Update the toggle button in `Navbar.tsx` to cycle through the available languages.
4. Update `getInitialLanguage()` in `LanguageProvider.tsx` to recognize the new code from localStorage.

## Component Reference

### Button

```tsx
<Button variant="primary" onClick={handleClick}>Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="tertiary">Learn More</Button>
<Button variant="danger">Delete</Button>
<Button disabled>Processing...</Button>
```

### FormInput

```tsx
<FormInput label="Email" name="email" type="email" value={email} onChange={handleChange} error={errors.email} required />
<FormInput label="Role" name="role" type="select" value={role} onChange={handleChange} options={[{ label: "Admin", value: "admin" }, { label: "User", value: "user" }]} />
<FormInput label="Bio" name="bio" type="textarea" value={bio} onChange={handleChange} />
<FormInput label="Accept terms" name="terms" type="checkbox" value={accepted} onChange={handleChange} />
```

### Modal

```tsx
<Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Confirm">
  <p>Are you sure?</p>
  <Button onClick={handleConfirm}>Yes</Button>
</Modal>
```

### Toast (via ErrorProvider)

```tsx
const { addToast } = useError();
addToast({ type: "success", title: "Saved", message: "Changes saved." });
addToast({ type: "error", title: "Error", message: "Something went wrong.", duration: 0 }); // manual close only
```

### Panel

```tsx
<Panel title="Settings">
  <p>Content here</p>
</Panel>
```

### Map (Leaflet / OpenStreetMap)

Built on `leaflet` + `react-leaflet` with OpenStreetMap tiles (no API key). The default marker-icon URLs are re-wired at module load so they resolve under Vite. Two exports:

```tsx
// Read-only: renders a pin per marker and auto-fits the viewport to them.
<LocationMap markers={[{ id, lat, lng, label }]} />

// Interactive: click the map or drag the pin to set a coordinate.
<LocationPicker value={{ lat, lng } | null} onChange={({ lat, lng }) => ...} />
```

`MapContainer` requires an explicit height; both components default to a Tailwind height (override via `className`). The map is client-only — safe here because the app runs in SPA mode (`ssr: false`).

### Charts (Recharts)

The admin dashboard uses **Recharts** (`recharts`, v3) for the assets-by-status donut and assets-by-site bar chart. Charts are wrapped in `<ResponsiveContainer>` inside a fixed-height div, and series colors reference the theme CSS variables (e.g. `fill="var(--color-primary)"`) so they follow light/dark mode. Tooltips/axes are themed via `contentStyle` / `tick` props.

### NavItems

To add links to the center of the navbar, edit `NavItems.ts`:

```typescript
const navConfig: NavConfig[] = [
  { labelKey: "nav.dashboard", to: "/dashboard", authenticated: true },
  { labelKey: "nav.settings", to: "/settings", authenticated: true },
  { labelKey: "nav.docs", to: "/docs", authenticated: null }, // always shown
];
```

- `authenticated: true` — shown only when logged in
- `authenticated: false` — shown only when logged out
- `authenticated: null` — always shown
- `adminOnly: true` — shown only to admins, grouped under the Admin section (e.g. `/admin/users`, `/admin/assets`)
- `hideForAdmin: true` — hidden from admins; for personal views that don't apply to admins (e.g. "My Assets")

## Scripts

```bash
npm run dev         # Start Vite dev server (port 3000)
npm run build       # Build static files for production
npm start           # Serve production build
```

## Backend Proxy (Development)

The Vite dev server proxies path prefixes to the backend. Use full paths that match the backend (for example `POST /api/session/login`); the `/api` prefix is forwarded unchanged.

| Prefix | Target |
|---|---|
| `/api/*` | `http://localhost:3001` |
| `/session/*` | `http://localhost:3001` |
| `/user/*` | `http://localhost:3001` |

Set `API_URL` environment variable to override the target.

## Deployment

The SPA build produces static files in the `build/` directory. These can be served by any static file server (Nginx, Caddy, S3 + CloudFront, etc.). Make sure to configure the server to return `index.html` for all routes so that client-side routing works.
