# Feature specification: Profile and account settings

- **Document ID:** SPEC-PROFILE-001
- **Status:** Implemented
- **Last updated:** 2026-05-31
- **Related requirements (E2E):** REQ-PROFILE-001
- **Depends on:** spec-platform-access-model.md, spec-internationalization.md

---

## 1. Summary

Signed-in users manage **display name**, **password**, **UI language**, **avatar**, and **account deletion** from `/settings`. All users (ADMIN and USER) use the same self-service APIs under `/api/users/*` and `/api/user/avatar`.

- **Deletion:** Soft-delete — sets `status = INACTIVE` and ends session; row retained.
- **Avatar:** Uploaded PNG/JPEG processed to WebP on disk.

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Let users update profile without admin intervention. |
| G2 | Require current password for password change and account deletion. |
| G3 | Persist language client-side (see i18n spec). |
| G4 | Store avatars on filesystem with configurable path. |

## 3. Non-goals (v1)

- Change email address.
- Server-side locale preference.
- Admin cannot use this page to change role (use admin user management).

## 4. Glossary

| Term | Definition |
|------|------------|
| Soft delete | `user.status → INACTIVE`; login blocked |

## 5. Personas and user stories

| ID | Story | Priority |
|----|-------|----------|
| US-PR1 | As a user, I update my display name. | Must |
| US-PR2 | As a user, I change my password. | Must |
| US-PR3 | As a user, I switch UI language. | Must |
| US-PR4 | As a user, I upload an avatar. | Must |
| US-PR5 | As a user, I delete my account with password confirmation. | Must |

## 7. State and business rules

| Rule | Detail |
|------|--------|
| Password change | Requires `currentPassword` + `newPassword` |
| Delete account | Requires password; sets INACTIVE |
| Avatar | POST body raw image bytes; stored as webp filename on user row |
| Language | `localStorage` only (spec-internationalization.md) |

## 8. Data model

| Column | Table | Notes |
|--------|-------|-------|
| `display_name` | `user` | |
| `avatar_filename` | `user` | Migration `add_avatar_to_users` |
| `hashed`, `salt` | `user` | Updated on password change |
| `status` | `user` | INACTIVE after delete |

## 9. API specification

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| PATCH | `/api/users/profile` | JWTAdminAndUser | Update display name |
| POST | `/api/users/change-password` | JWTAdminAndUser | Rotate password |
| DELETE | `/api/users/account` | JWTAdminAndUser | Soft-delete |
| POST | `/api/user/avatar` | JWTAdminAndUser | Upload own avatar |
| DELETE | `/api/user/avatar` | JWTAdminAndUser | Remove own avatar |
| GET | `/api/users/{id}/avatar` | JWTAdminAndUser | Serve avatar image |

Admin may upload/delete another user's avatar via `/api/p/users/{id}/avatar` (admin user management).

## 10. Email

Not applicable.

## 11. Frontend

| Route | Component areas |
|-------|-----------------|
| `/settings` | Panels: Update Profile, Password, Language, Avatar, Delete Account |

Modal confirmation for account deletion with password field.

## 12. Security

| Control | Detail |
|---------|--------|
| Password required | Delete + change password |
| Image pipeline | Sharp resize/convert; content-type checked |
| Auth | JWTAdminAndUser only |

## 13. Configuration

| Variable | Purpose |
|----------|---------|
| `AVATAR_STORAGE_PATH` | Disk directory for avatars |

## 14. Acceptance criteria (E2E)

From `e2e/tests/profile/req-profile-001.spec.ts`:

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Change display name → persisted; survives reload. |
| AC-001.2 | Change password → logout → login with new password works. |
| AC-001.3 | Select Spanish → heading `Ajustes` visible. |
| AC-001.4 | POST `/api/user/avatar` → `avatar_filename` set in DB. |
| AC-001.5 | Delete account with password → redirect login; status INACTIVE; cannot login. |

## 15. Implementation phases

| Phase | Status |
|-------|--------|
| P1 | Profile + password API | Done |
| P2 | Avatar upload | Done |
| P3 | Language + delete + E2E | Done |

## 16. Backend layering

- `domain/users/users.domain.ts`
- `infrastructure/routes/users/users.route.ts`
- `infrastructure/routes/avatar/avatar.route.ts`

## 17. Open decisions (resolved)

| # | Decision |
|---|----------|
| D1 | Hard delete user | **No** — INACTIVE |
| D2 | Language on server | **No** |

## 18. Documentation updates

- README profile bullet
- spec-internationalization.md §14 references AC-001.3

## 19. Reference: touchpoints

| Path | Role |
|------|------|
| `frontend/app/routes/settings.tsx` | Settings UI |
| `avatar.route.ts` | `/api/user/avatar` |
| `uploadedImage.service.ts` | Sharp pipeline |

## 20. Codebase validation

| # | Item | Detail |
|---|------|--------|
| 1 | Avatar path | `/api/user/avatar` (singular `user`) |
| 2 | Delete is soft | E2E asserts INACTIVE not missing row |

---

*End of specification.*
