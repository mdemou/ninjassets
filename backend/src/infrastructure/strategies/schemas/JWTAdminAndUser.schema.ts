import Boom from '@hapi/boom';
import type { Request, ResponseToolkit, ServerAuthSchemeObject } from '@hapi/hapi';

export function jwtAdminAndUserScheme(
  _server: unknown,
  _options: unknown,
): ServerAuthSchemeObject {
  return {
    async authenticate(request: Request, h: ResponseToolkit) {
      const server = request.server;

      // Try JWTAdmin first
      try {
        const adminResult = await server.auth.test('JWTAdmin', request);
        return h.authenticated({ credentials: adminResult.credentials });
      } catch (_adminError) {
        // Admin failed, try User
      }

      // Try JWTUser
      try {
        const userResult = await server.auth.test('JWTUser', request);
        return h.authenticated({ credentials: userResult.credentials });
      } catch (_userError) {
        // Both failed
      }

      throw Boom.unauthorized('Invalid token');
    },
  };
}
