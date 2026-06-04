import config from '@config/config';
import {
  IApiKeySecretResult,
  IApiKeyWithOwner,
} from '@domain/_interfaces/apiKey.interface';
import { IUserRole, IUserStatus } from '@domain/_interfaces/users.interface';
import { ApiKeyRepository } from '@domain/_repositories/apiKey.repository';
import { UserRepository } from '@domain/_repositories/user.repository';
import Boom from '@hapi/boom';
import { CAPABILITY_WILDCARD, resolveEffectivePermissions } from '@infrastructure/roles/capabilities';
import cryptoService from '@services/crypto.service';
import logger from '@services/logger.service';
import apiKeyErrors from './apiKeys.errors';

interface ApiKeyRepositories {
  apiKeyRepository: ApiKeyRepository;
  userRepository: UserRepository;
}

interface CreateApiKeyInput {
  name: string;
  expiresAt?: string | null;
  capabilities?: string[];
}

/** Credentials produced by a successful API-key validation (SPEC-API-001 §8.3). */
export interface ApiKeyCredentials {
  id: string;
  email: string;
  role: string;
  capabilities: string[];
  apiKeyId: string;
  authMethod: 'api_key';
}

/** `nsk_live_` (9) + 8 hex chars — the public, indexed lookup id (§4 glossary). */
const PREFIX_DISPLAY_LEN = config.apiKey.prefix.length + 8;

function apiKeysDomainFactory(repositories: ApiKeyRepositories) {
  const { apiKeyRepository, userRepository } = repositories;

  /** Build a fresh `nsk_*` secret + its public prefix + storage hash. */
  function mintSecret(): { secret: string; prefix: string; secretHash: string } {
    const random = cryptoService.generateToken(); // 32 random bytes, hex
    const secret = `${config.apiKey.prefix}${random}`;
    const prefix = secret.slice(0, PREFIX_DISPLAY_LEN);
    const secretHash = cryptoService.sha256Hex(secret);
    return { secret, prefix, secretHash };
  }

  function resolveExpiry(expiresAt?: string | null): Date | null {
    if (expiresAt) {
      const date = new Date(expiresAt);
      if (Number.isNaN(date.getTime()) || date <= new Date()) {
        throw Boom.badRequest(apiKeyErrors.invalidExpiry.message, {
          code: apiKeyErrors.invalidExpiry.code,
        });
      }
      return date;
    }
    if (config.apiKey.defaultTtlDays > 0) {
      return new Date(Date.now() + config.apiKey.defaultTtlDays * 24 * 60 * 60 * 1000);
    }
    return null;
  }

  function throttledTouch(id: string, lastUsedAt: string | null): void {
    const throttleMs = config.apiKey.lastUsedThrottleSec * 1000;
    if (lastUsedAt && Date.now() - new Date(lastUsedAt).getTime() < throttleMs) return;
    // Fire-and-forget; never block auth on the usage stamp.
    void apiKeyRepository.touchLastUsed(id);
  }

  return {
    /** Admin: create a key. Returns the secret exactly once. */
    async create(actorUserId: string, input: CreateApiKeyInput): Promise<IApiKeySecretResult> {
      const name = (input.name ?? '').trim();
      if (!name) {
        throw Boom.badRequest(apiKeyErrors.invalidName.message, { code: apiKeyErrors.invalidName.code });
      }
      const expiresAt = resolveExpiry(input.expiresAt);
      // MVP: keys are full-admin. Scoped keys are P2 — empty/[*] both mean full admin.
      const capabilities =
        input.capabilities && input.capabilities.length > 0 ? input.capabilities : [CAPABILITY_WILDCARD];

      const { secret, prefix, secretHash } = mintSecret();
      const created = await apiKeyRepository.create({
        userId: actorUserId,
        name,
        prefix,
        secretHash,
        capabilities,
        expiresAt,
      });

      return {
        id: created.id,
        name: created.name,
        prefix: created.prefix,
        secret,
        capabilities: created.capabilities,
        expiresAt: created.expiresAt,
      };
    },

    /** Admin: list all deployment keys (no secrets), owner included. */
    async list(): Promise<IApiKeyWithOwner[]> {
      return apiKeyRepository.listAll();
    },

    /** Admin: detail of any key (no secret). */
    async getDetail(id: string): Promise<IApiKeyWithOwner> {
      const key = await apiKeyRepository.findById(id);
      if (!key) {
        throw Boom.notFound(apiKeyErrors.keyNotFound.message, { code: apiKeyErrors.keyNotFound.code });
      }
      return key;
    },

    /** Admin: revoke any key immediately. */
    async revoke(id: string): Promise<void> {
      const key = await apiKeyRepository.findById(id);
      if (!key) {
        throw Boom.notFound(apiKeyErrors.keyNotFound.message, { code: apiKeyErrors.keyNotFound.code });
      }
      if (key.revokedAt) {
        throw Boom.badRequest(apiKeyErrors.alreadyRevoked.message, {
          code: apiKeyErrors.alreadyRevoked.code,
        });
      }
      await apiKeyRepository.revoke(id);
    },

    /** Admin: rotate the secret of an existing key (§7.4a). Returns the new secret once. */
    async regenerate(id: string): Promise<IApiKeySecretResult> {
      const key = await apiKeyRepository.findById(id);
      if (!key) {
        throw Boom.notFound(apiKeyErrors.keyNotFound.message, { code: apiKeyErrors.keyNotFound.code });
      }
      if (key.revokedAt) {
        throw Boom.badRequest(apiKeyErrors.alreadyRevoked.message, {
          code: apiKeyErrors.alreadyRevoked.code,
        });
      }
      const { secret, prefix, secretHash } = mintSecret();
      await apiKeyRepository.rotateSecret(id, prefix, secretHash);
      return {
        id: key.id,
        name: key.name,
        prefix,
        secret,
        capabilities: key.capabilities,
        expiresAt: key.expiresAt,
      };
    },

    /**
     * Auth strategy entry point: validate a bearer secret and resolve credentials.
     * Returns null on any failure (caller maps to a generic 401).
     */
    async validateSecret(token: string): Promise<ApiKeyCredentials | null> {
      try {
        if (!token || token.length <= PREFIX_DISPLAY_LEN) return null;
        const prefix = token.slice(0, PREFIX_DISPLAY_LEN);
        const row = await apiKeyRepository.findAuthRowByPrefix(prefix);
        if (!row) return null;

        const candidateHash = cryptoService.sha256Hex(token);
        if (!cryptoService.timingSafeEqual(candidateHash, row.secretHash)) return null;
        if (row.revokedAt) return null;
        if (row.expiresAt && new Date(row.expiresAt) <= new Date()) return null;

        const owner = await userRepository.findById(row.userId);
        if (!owner || owner.status !== IUserStatus.ACTIVE || owner.roleName !== (IUserRole.ADMIN as string)) {
          return null;
        }

        // ADMIN principal holds every capability; effective = principal ∩ key grant.
        const effective = resolveEffectivePermissions([CAPABILITY_WILDCARD], row.capabilities);

        throttledTouch(row.id, row.lastUsedAt);

        return {
          id: owner.id,
          email: owner.email,
          role: owner.roleName,
          capabilities: effective,
          apiKeyId: row.id,
          authMethod: 'api_key',
        };
      } catch (error) {
        logger.error(__filename, 'validateSecret', 'error', error);
        return null;
      }
    },
  };
}

export default apiKeysDomainFactory;
