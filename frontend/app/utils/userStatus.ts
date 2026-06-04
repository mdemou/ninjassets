import type { UserStatus } from '~/types';
import type { TranslationKey } from '~/utils/translations';

export const USER_STATUS_ORDER: UserStatus[] = ['ACTIVE', 'INACTIVE'];

export const USER_STATUS_LABEL_KEYS: Record<UserStatus, TranslationKey> = {
  ACTIVE: 'adminUsers.statusActive',
  INACTIVE: 'adminUsers.statusInactive',
};

export const USER_STATUS_OPTIONS: { value: UserStatus; labelKey: TranslationKey }[] =
  USER_STATUS_ORDER.map((value) => ({ value, labelKey: USER_STATUS_LABEL_KEYS[value] }));

export const USER_STATUS_BADGE_CLASS: Record<UserStatus, string> = {
  ACTIVE: 'bg-[var(--color-user-status-active-light)] text-[var(--color-user-status-active-dark)]',
  INACTIVE: 'bg-[var(--color-user-status-inactive-light)] text-[var(--color-user-status-inactive-dark)]',
};

export function isUserStatus(value: string): value is UserStatus {
  return value === 'ACTIVE' || value === 'INACTIVE';
}

export function userStatusBadgeClass(status: string): string {
  return isUserStatus(status) ? USER_STATUS_BADGE_CLASS[status] : 'bg-muted/15 text-muted';
}
