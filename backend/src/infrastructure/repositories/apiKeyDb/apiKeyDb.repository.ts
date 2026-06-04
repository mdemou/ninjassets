import {
  IApiKey,
  IApiKeyAuthRow,
  IApiKeyWithOwner,
  ICreateApiKeyRow,
} from '@domain/_interfaces/apiKey.interface';
import { ApiKeyRepository } from '@domain/_repositories/apiKey.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import apiKeyDbErrors from './apiKeyDb.errors';

interface IApiKeyDB {
  id: string;
  user_id: string;
  name: string;
  prefix: string;
  secret_hash: string;
  capabilities: string[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface IApiKeyWithOwnerDB extends IApiKeyDB {
  owner_email: string | null;
  owner_name: string | null;
  owner_avatar_filename: string | null;
}

function adaptApiKey(row: IApiKeyDB): IApiKey {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    prefix: row.prefix,
    capabilities: row.capabilities ?? [],
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

function adaptApiKeyWithOwner(row: IApiKeyWithOwnerDB): IApiKeyWithOwner {
  return {
    ...adaptApiKey(row),
    ownerEmail: row.owner_email,
    ownerName: row.owner_name,
    ownerAvatarFilename: row.owner_avatar_filename,
  };
}

function ownerQuery() {
  return sqlService
    .myDb('api_key')
    .leftJoin('user', 'api_key.user_id', 'user.id')
    .select(
      'api_key.*',
      'user.email as owner_email',
      'user.display_name as owner_name',
      'user.avatar_filename as owner_avatar_filename',
    );
}

function internal(): never {
  throw Boom.badImplementation(apiKeyDbErrors.internalError.message, {
    code: apiKeyDbErrors.internalError.code,
  });
}

const apiKeyDbRepository: ApiKeyRepository = {
  async create(data: ICreateApiKeyRow): Promise<IApiKey> {
    try {
      const [row]: IApiKeyDB[] = await sqlService
        .myDb('api_key')
        .insert({
          user_id: data.userId,
          name: data.name,
          prefix: data.prefix,
          secret_hash: data.secretHash,
          capabilities: JSON.stringify(data.capabilities),
          expires_at: data.expiresAt,
        })
        .returning('*');
      if (!row) return internal();
      return adaptApiKey(row);
    } catch (error) {
      logger.error(__filename, 'create', 'error', error);
      return internal();
    }
  },

  async listAll(): Promise<IApiKeyWithOwner[]> {
    try {
      const rows: IApiKeyWithOwnerDB[] = await ownerQuery().orderByRaw(
        'api_key.revoked_at IS NOT NULL, api_key.created_at DESC',
      );
      return rows.map(adaptApiKeyWithOwner);
    } catch (error) {
      logger.error(__filename, 'listAll', 'error', error);
      return internal();
    }
  },

  async findById(id: string): Promise<IApiKeyWithOwner | null> {
    try {
      const row: IApiKeyWithOwnerDB | undefined = await ownerQuery().where('api_key.id', id).first();
      return row ? adaptApiKeyWithOwner(row) : null;
    } catch (error) {
      logger.error(__filename, 'findById', 'error', error);
      return internal();
    }
  },

  async findAuthRowByPrefix(prefix: string): Promise<IApiKeyAuthRow | null> {
    try {
      const row: IApiKeyDB | undefined = await sqlService
        .myDb('api_key')
        .where({ prefix })
        .first();
      if (!row) return null;
      return {
        id: row.id,
        userId: row.user_id,
        secretHash: row.secret_hash,
        capabilities: row.capabilities ?? [],
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        lastUsedAt: row.last_used_at,
      };
    } catch (error) {
      logger.error(__filename, 'findAuthRowByPrefix', 'error', error);
      return internal();
    }
  },

  async revoke(id: string): Promise<boolean> {
    try {
      const count = await sqlService
        .myDb('api_key')
        .where({ id })
        .whereNull('revoked_at')
        .update({ revoked_at: new Date().toISOString() });
      return count > 0;
    } catch (error) {
      logger.error(__filename, 'revoke', 'error', error);
      return internal();
    }
  },

  async rotateSecret(id: string, prefix: string, secretHash: string): Promise<boolean> {
    try {
      const count = await sqlService
        .myDb('api_key')
        .where({ id })
        .whereNull('revoked_at')
        .update({ prefix, secret_hash: secretHash, last_used_at: null });
      return count > 0;
    } catch (error) {
      logger.error(__filename, 'rotateSecret', 'error', error);
      return internal();
    }
  },

  async touchLastUsed(id: string): Promise<void> {
    try {
      await sqlService.myDb('api_key').where({ id }).update({ last_used_at: new Date().toISOString() });
    } catch (error) {
      // Best-effort: never fail auth because the usage stamp could not be written.
      logger.error(__filename, 'touchLastUsed', 'error', error);
    }
  },
};

export default apiKeyDbRepository;
