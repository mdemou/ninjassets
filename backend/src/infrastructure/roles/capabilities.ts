/**
 * Single permission catalog for both human roles and API keys (SPEC-API-001 §7.5).
 * Capabilities are `area:action` strings; `*` is the wildcard granting everything.
 *
 * The `requireCapability` seam (roles.service) is a no-op for full admin in MVP and starts
 * filtering once scoped keys (P2) carry a subset.
 */
export const CAPABILITY_WILDCARD = '*';

export enum CapabilityEnum {
  ASSETS_READ = 'assets:read',
  ASSETS_WRITE = 'assets:write',
  SITES_READ = 'sites:read',
  SITES_WRITE = 'sites:write',
  CATALOG_READ = 'catalog:read',
  CATALOG_WRITE = 'catalog:write',
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  HANDOVERS_READ = 'handovers:read',
  HANDOVERS_WRITE = 'handovers:write',
  TRANSACTIONS_READ = 'transactions:read',
  STATS_READ = 'stats:read',
  ALERTS_READ = 'alerts:read',
  REPORTS_READ = 'reports:read',
  IMPORT_EXPORT_RUN = 'import_export:run',
  // Managed via JWT only — never grantable to a key (§9 header).
  API_KEYS_MANAGE = 'api_keys:manage',
  WEBHOOKS_MANAGE = 'webhooks:manage',
}

/** Does an effective-permission set satisfy a required capability? `*` absorbs all. */
export function hasCapability(effective: string[], required: string): boolean {
  return effective.includes(CAPABILITY_WILDCARD) || effective.includes(required);
}

/**
 * Effective permissions = principal ∩ key grant, with `*` absorbing everything.
 * A key can never widen beyond what its owner holds.
 */
export function resolveEffectivePermissions(principal: string[], keyGrant: string[]): string[] {
  // Empty key grant means "inherit owner" — full admin in MVP.
  const grant = keyGrant.length === 0 ? [CAPABILITY_WILDCARD] : keyGrant;

  const principalAll = principal.includes(CAPABILITY_WILDCARD);
  const grantAll = grant.includes(CAPABILITY_WILDCARD);

  if (principalAll && grantAll) return [CAPABILITY_WILDCARD];
  if (principalAll) return [...grant];
  if (grantAll) return [...principal];
  return principal.filter((p) => grant.includes(p));
}
