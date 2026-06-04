/** Routes that do not require sign-in (no app sidebar). */
const PUBLIC_APP_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/handover/accept',
]);

export function isPublicAppPath(pathname: string): boolean {
  return PUBLIC_APP_PATHS.has(pathname) || pathname.startsWith('/docs');
}

/** App chrome hidden on marketing and unauthenticated flows (each uses PublicPageLayout). */
export function isNavbarHiddenPath(pathname: string): boolean {
  return isPublicAppPath(pathname);
}
