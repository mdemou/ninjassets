import config from '@config/config';
import type { Request, ResponseToolkit, Server } from '@hapi/hapi';
import apiAccessLogDbRepository from '@infrastructure/repositories/apiAccessLogDb/apiAccessLogDb.repository';
import idempotencyDbRepository from '@infrastructure/repositories/idempotencyDb/idempotencyDb.repository';
import rolesService from '@infrastructure/roles/roles.service';
import cryptoService from '@services/crypto.service';
import logger from '@services/logger.service';

interface ApiCredentials {
  id?: string;
  apiKeyId?: string;
}

interface IdempotencyStash {
  principalId: string;
  idempotencyKey: string;
  fingerprint: string;
}

function getCredentials(request: Request): ApiCredentials {
  return (request.auth?.credentials ?? {}) as ApiCredentials;
}

function statusCodeOf(request: Request): number {
  const res = request.response as { isBoom?: boolean; output?: { statusCode?: number }; statusCode?: number };
  if (res?.isBoom) return res.output?.statusCode ?? 500;
  return res?.statusCode ?? 200;
}

function clientIp(request: Request): string | null {
  const fwd = request.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return request.info.remoteAddress || null;
}

/**
 * Registers the API automation server extensions (SPEC-API-001):
 *  - onPostAuth: the permission seam (§7.5.3) — enforce a route's `app.capability`.
 *  - onPreHandler: idempotency replay/short-circuit for opt-in `Idempotency-Key` POSTs (§9.5).
 *  - onPreResponse: persist the idempotency result + append the access log (§8.2).
 */
export function registerApiHooks(server: Server): void {
  // Permission seam. No-op for full admin in MVP; precise 403 for an under-scoped key.
  server.ext('onPostAuth', (request: Request, h: ResponseToolkit) => {
    const app: { capability?: string } | undefined = request.route.settings.app;
    const capability = app?.capability;
    if (capability && request.auth.isAuthenticated) {
      rolesService.requireCapability(request, capability);
    }
    return h.continue;
  });

  // Idempotency: replay a stored response, 409 on body mismatch, else mark for storing.
  server.ext('onPreHandler', async (request: Request, h: ResponseToolkit) => {
    const idempotencyKey = request.headers['idempotency-key'];
    if (
      request.method !== 'post' ||
      typeof idempotencyKey !== 'string' ||
      !idempotencyKey ||
      !request.path.startsWith('/api/p/')
    ) {
      return h.continue;
    }

    const credentials = getCredentials(request);
    const principalId = credentials.apiKeyId ? `key:${credentials.apiKeyId}` : `user:${credentials.id}`;
    const fingerprint = cryptoService.sha256Hex(
      `${request.method} ${request.path} ${JSON.stringify(request.payload ?? {})}`,
    );

    const existing = await idempotencyDbRepository.find(principalId, idempotencyKey);
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        return h
          .response({
            statusCode: 409,
            code: 'API4090',
            message: 'Idempotency-Key reused with a different request body',
          })
          .code(409)
          .takeover();
      }
      return h
        .response(existing.responseBody as Record<string, unknown>)
        .code(existing.responseStatus)
        .takeover();
    }

    (request.app as { idempotency?: IdempotencyStash }).idempotency = {
      principalId,
      idempotencyKey,
      fingerprint,
    };
    return h.continue;
  });

  server.ext('onPreResponse', async (request: Request, h: ResponseToolkit) => {
    const status = statusCodeOf(request);

    // Persist a successful first response for idempotent replay.
    const stash = (request.app as { idempotency?: IdempotencyStash }).idempotency;
    if (stash && status >= 200 && status < 300) {
      const res = request.response as { source?: unknown };
      try {
        await idempotencyDbRepository.store({
          principalId: stash.principalId,
          idempotencyKey: stash.idempotencyKey,
          requestFingerprint: stash.fingerprint,
          responseStatus: status,
          responseBody: res?.source ?? null,
        });
      } catch (error) {
        logger.error(__filename, 'onPreResponse:idempotency', 'error', error);
      }
    }

    // Append the access log for key-authenticated /api/p/* calls.
    const credentials = getCredentials(request);
    if (credentials.apiKeyId && request.path.startsWith('/api/p/')) {
      await apiAccessLogDbRepository.record({
        apiKeyId: credentials.apiKeyId,
        userId: credentials.id ?? null,
        method: request.method.toUpperCase(),
        path: request.path,
        statusCode: status,
        durationMs: Date.now() - request.info.received,
        ip: clientIp(request),
      });
    }

    return h.continue;
  });
}

/** Periodic purge of access log + idempotency rows past their retention window. */
export async function purgeApiRetention(): Promise<void> {
  const logCutoff = new Date(Date.now() - config.apiAccessLog.retentionDays * 24 * 60 * 60 * 1000);
  const idemCutoff = new Date(Date.now() - config.apiIdempotency.ttlHours * 60 * 60 * 1000);
  await apiAccessLogDbRepository.deleteOlderThan(logCutoff);
  await idempotencyDbRepository.deleteOlderThan(idemCutoff);
}
