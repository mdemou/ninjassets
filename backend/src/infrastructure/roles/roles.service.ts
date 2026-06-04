import Boom from '@hapi/boom';
import type { Request } from '@hapi/hapi';
import { CAPABILITY_WILDCARD, hasCapability } from './capabilities';

/** Credentials shared by JWT and API-key auth (SPEC-API-001 §8.3). */
interface AuthCredentials {
  role?: string;
  capabilities?: string[];
  authMethod?: 'jwt' | 'api_key';
}

/**
 * Effective permissions for the current request (SPEC-API-001 §7.5.3).
 * - API key: the strategy already computed effective = owner ∩ key grant into `capabilities`.
 * - JWT: an ADMIN role holds every capability (`*`).
 */
export function effectivePermissions(request: Request): string[] {
  const credentials = (request.auth.credentials ?? {}) as AuthCredentials;
  if (credentials.authMethod === 'api_key') {
    return credentials.capabilities ?? [];
  }
  if (credentials.role === 'ADMIN') {
    return [CAPABILITY_WILDCARD];
  }
  return [];
}

const rolesService = {
  /**
   * Permission seam. Throws 403 unless the request's effective permissions satisfy
   * `capability`. No-op for full admin (JWT admin or full-admin key) in MVP.
   */
  requireCapability(request: Request, capability: string): void {
    if (!hasCapability(effectivePermissions(request), capability)) {
      throw Boom.forbidden('Insufficient permissions');
    }
  },
};

export default rolesService;
