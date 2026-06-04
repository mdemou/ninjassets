import config from '@config/config';
import Boom from '@hapi/boom';
import type { Request, ResponseToolkit, ServerAuthSchemeObject } from '@hapi/hapi';
import { extractBearer } from './ApiKeyAdmin.schema';

/**
 * Composite admin auth (SPEC-API-001 §6.2). Routes by bearer prefix rather than blind
 * try/fallback: `nsk_*` runs ApiKeyAdmin only, anything else runs JWTAdmin only. This
 * avoids a guaranteed-to-fail JWT verification (+ DB session lookup) on every key call
 * and yields a precise 401 from the relevant path. Both converge on the same credentials.
 */
export function jwtAdminOrApiKeyScheme(_server: unknown, _options: unknown): ServerAuthSchemeObject {
  return {
    async authenticate(request: Request, h: ResponseToolkit) {
      const server = request.server;
      const token = extractBearer(request);
      const looksLikeApiKey = token?.startsWith(config.apiKey.prefix.slice(0, 4)); // "nsk_"

      const strategy = looksLikeApiKey ? 'ApiKeyAdmin' : 'JWTAdmin';
      try {
        const result = await server.auth.test(strategy, request);
        return h.authenticated({ credentials: result.credentials });
      } catch (_error) {
        throw Boom.unauthorized('Invalid credentials');
      }
    },
  };
}
