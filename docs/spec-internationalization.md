# Feature specification: Internationalization (UI)

- **Document ID:** SPEC-I18N-001
- **Status:** Implemented
- **Last updated:** 2026-05-31
- **Related requirements (E2E):** REQ-PROFILE-001 (AC-PROFILE-001.3)
- **Depends on:** —

---

## 1. Summary

The SPA supports **English and Spanish** for all user-visible strings via a central translation map and React context. Language preference is stored in **`localStorage`** (`language` key) and can be changed from Settings.

- **Not in scope:** Server-rendered email localization (see spec-email-notifications.md).
- **Not in scope:** Per-user locale in the database.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Provide EN + ES for the full authenticated and public UI. |
| G2 | Persist language choice across sessions on the same browser. |
| G3 | Switch language without full page reload. |
| G4 | Type-safe translation keys (`TranslationKey`). |

## 3. Non-goals (v1)

- Additional locales beyond `en` | `es`.
- Backend `Accept-Language` negotiation.
- RTL layouts.
- User profile field for locale (DB).

## 4. Glossary

| Term | Definition |
|------|------------|
| `t(key)` | Lookup function from `useLanguage()` |
| `TranslationKey` | Union of all keys in `translations.ts` |

## 5. Personas and user stories

| ID | Story | Priority |
|----|-------|----------|
| US-I1 | As a user, I can switch UI language in Settings. | Must |
| US-I2 | As a visitor, I see the public home in my last selected language. | Should |

## 6. Architecture

```
LanguageProvider
  ├─ state: language ('en' | 'es')
  ├─ init: localStorage 'language' or 'en'
  └─ t(key) → translations[language][key] ?? key
```

All routes and components import `useLanguage()` instead of hard-coded strings.

## 7. State and business rules

| Rule | Detail |
|------|--------|
| Default language | `en` when no valid `localStorage` value |
| Valid values | `'en'`, `'es'` only |
| Missing key | Falls back to key string (dev signal) |
| Settings save | Updates context + `localStorage` immediately |

## 8. Data model

No database tables. Client-only:

| Key | Value |
|-----|-------|
| `localStorage.language` | `en` \| `es` |

## 9. API specification

No i18n-specific API. Profile update does **not** persist language server-side.

## 10. Email

Emails use **fixed server template language** (see spec-email-notifications.md §10.2). Handover spec D8: match verification email language.

## 11. Frontend

| File | Role |
|------|------|
| `frontend/app/utils/translations.ts` | `translations.en`, `translations.es` maps |
| `frontend/app/providers/LanguageProvider.tsx` | Context + `t()` |
| `frontend/app/routes/settings.tsx` | Language selector (AC-PROFILE-001.3) |
| `frontend/app/root.tsx` | Wraps app with `LanguageProvider` |

### 11.1 Adding strings

1. Add key to both `en` and `es` objects in `translations.ts`.
2. Use `t('your.key')` in components.
3. Extend `TranslationKey` type (derived from keys).

## 12. Security

No security surface (display-only).

## 13. Configuration

None.

## 14. Acceptance criteria (E2E)

From `e2e/tests/profile/req-profile-001.spec.ts`:

### AC-PROFILE-001.3 — Switching language updates the UI

| AC | Given / When / Then |
|----|---------------------|
| AC-001.3.1 | User opens Settings, selects Spanish → UI strings update (e.g. settings labels in Spanish). |
| AC-001.3.2 | Reload page → Spanish persists via `localStorage`. |

## 15. Implementation phases

| Phase | Status |
|-------|--------|
| P1 | translations.ts EN/ES parity | Done |
| P2 | LanguageProvider + Settings | Done |
| P3 | E2E language AC | Done |

## 16. Backend layering

Not applicable.

## 17. Open decisions (resolved)

| # | Decision |
|---|----------|
| D1 | DB locale field | **No** in v1 |
| D2 | Email locale | **Fixed** server copy |

## 18. Documentation updates

- New feature specs must add keys to **both** locales in `translations.ts`
- spec-profile-settings.md references language AC

## 19. Reference: touchpoints

| Path | Note |
|------|------|
| `frontend/app/utils/translations.ts` | ~900 lines, all UI copy |
| `frontend/app/providers/LanguageProvider.tsx` | |
| `frontend/app/types/index.ts` | `Language` type |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | Key parity | New keys must exist in EN and ES or `t()` shows raw key |
| 2 | Email split | UI i18n does not affect `backend/.../templates/*` |
| 3 | Admin forms | Some E2E tests match English button labels |

---

*End of specification.*
