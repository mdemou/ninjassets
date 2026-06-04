import type { UserRole } from '~/types';
import type { TranslationKey } from '~/utils/translations';

export const USER_ROLE_ORDER: UserRole[] = ['ADMIN', 'USER'];

export const USER_ROLE_LABEL_KEYS: Record<UserRole, TranslationKey> = {
  ADMIN: 'adminUsers.roleAdmin',
  USER: 'adminUsers.roleUser',
};

export const USER_ROLE_OPTIONS: { value: UserRole; labelKey: TranslationKey }[] = USER_ROLE_ORDER.map(
  (value) => ({ value, labelKey: USER_ROLE_LABEL_KEYS[value] }),
);

export const USER_ROLE_BADGE_CLASS: Record<UserRole, string> = {
  ADMIN: 'bg-[var(--color-user-role-admin-light)] text-[var(--color-user-role-admin-dark)]',
  USER: 'bg-[var(--color-user-role-user-light)] text-[var(--color-user-role-user-dark)]',
};

export function isUserRole(value: string): value is UserRole {
  return value === 'ADMIN' || value === 'USER';
}

export function userRoleBadgeClass(role: string): string {
  return isUserRole(role) ? USER_ROLE_BADGE_CLASS[role] : 'bg-muted/15 text-muted';
}
