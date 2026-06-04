import config from '@config/config';
import adminSessionDomainFactory from '@domain/session/admin/session.domain';
import userSessionDomainFactory from '@domain/session/user/session.domain';
import type { Server } from '@hapi/hapi';
import sessionDbRepository from '@infrastructure/repositories/sessionDb/sessionDb.repository';
import { apiKeyAdminScheme } from './schemas/ApiKeyAdmin.schema';
import { jwtAdminAndUserScheme } from './schemas/JWTAdminAndUser.schema';
import { jwtAdminOrApiKeyScheme } from './schemas/JWTAdminOrApiKey.schema';

const adminSessionDomain = adminSessionDomainFactory({
  sessionRepository: sessionDbRepository,
});

const userSessionDomain = userSessionDomainFactory({
  sessionRepository: sessionDbRepository,
});

export function registerStrategies(server: Server) {
  server.auth.strategy('JWTAdmin', 'jwt', {
    key: config.jwt.admin.secretKey,
    validate: adminSessionDomain.validateJWT,
    verifyOptions: { algorithms: ['HS256'] },
    // Only accept JWT from Authorization header — handover preview uses ?token= for the magic link.
    urlKey: false,
  });

  server.auth.strategy('JWTUser', 'jwt', {
    key: config.jwt.user.secretKey,
    validate: userSessionDomain.validateJWT,
    verifyOptions: { algorithms: ['HS256'] },
    urlKey: false,
  });

  server.auth.scheme('JWTAdminAndUserScheme', jwtAdminAndUserScheme);
  server.auth.strategy('JWTAdminAndUser', 'JWTAdminAndUserScheme');

  // Machine access (SPEC-API-001): API key admin auth + the prefix-routed composite.
  server.auth.scheme('ApiKeyAdminScheme', apiKeyAdminScheme);
  server.auth.strategy('ApiKeyAdmin', 'ApiKeyAdminScheme');

  server.auth.scheme('JWTAdminOrApiKeyScheme', jwtAdminOrApiKeyScheme);
  server.auth.strategy('JWTAdminOrApiKey', 'JWTAdminOrApiKeyScheme');
}
