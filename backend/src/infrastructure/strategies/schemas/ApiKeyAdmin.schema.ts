import apiKeysDomainFactory from '@domain/apiKeys/apiKeys.domain';
import Boom from '@hapi/boom';
import type { Request, ResponseToolkit, ServerAuthSchemeObject } from '@hapi/hapi';
import apiKeyDbRepository from '@infrastructure/repositories/apiKeyDb/apiKeyDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';

const apiKeysDomain = apiKeysDomainFactory({
  apiKeyRepository: apiKeyDbRepository,
  userRepository: userDbRepository,
});

/** Pull the raw bearer token from the Authorization header (no query-string keys). */
export function extractBearer(request: Request): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/**
 * Custom scheme validating `Authorization: Bearer nsk_*` API keys (SPEC-API-001 §6.2).
 * Looks up by indexed prefix, constant-time compares the hash, and resolves the same
 * credentials shape as JWTAdmin plus `apiKeyId` / `authMethod`.
 */
export function apiKeyAdminScheme(_server: unknown, _options: unknown): ServerAuthSchemeObject {
  return {
    async authenticate(request: Request, h: ResponseToolkit) {
      const token = extractBearer(request);
      if (!token) {
        throw Boom.unauthorized('Invalid credentials');
      }
      const credentials = await apiKeysDomain.validateSecret(token);
      if (!credentials) {
        throw Boom.unauthorized('Invalid credentials');
      }
      return h.authenticated({ credentials });
    },
  };
}
