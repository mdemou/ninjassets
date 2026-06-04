import type { User } from '~/types';

export function homePathForRole(roleName?: User['roleName']): string {
  return roleName === 'ADMIN' ? '/admin/overview' : '/dashboard';
}

/** Path to open after login when the user was sent here from a protected page. */
export function pathAfterLogin(
  fromPathname: string | undefined,
  roleName?: User['roleName'],
): string {
  if (
    fromPathname &&
    fromPathname !== '/login' &&
    fromPathname !== '/register' &&
    fromPathname !== '/logout'
  ) {
    return fromPathname;
  }
  return homePathForRole(roleName);
}
