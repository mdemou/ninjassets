import {
  IApiKey,
  IApiKeyAuthRow,
  IApiKeyWithOwner,
  ICreateApiKeyRow,
} from '@domain/_interfaces/apiKey.interface';

export interface ApiKeyRepository {
  create(data: ICreateApiKeyRow): Promise<IApiKey>;
  /** All deployment keys, active first then newest (D-API-7). No secrets. */
  listAll(): Promise<IApiKeyWithOwner[]>;
  findById(id: string): Promise<IApiKeyWithOwner | null>;
  /** Auth lookup by the public prefix embedded in the bearer secret. */
  findAuthRowByPrefix(prefix: string): Promise<IApiKeyAuthRow | null>;
  /** Sets revoked_at = now() if not already revoked. Returns true if a row changed. */
  revoke(id: string): Promise<boolean>;
  /** Replaces secret_hash + prefix for an existing key (rotation §7.4a). */
  rotateSecret(id: string, prefix: string, secretHash: string): Promise<boolean>;
  /** Best-effort last_used_at bump (throttled by the caller). */
  touchLastUsed(id: string): Promise<void>;
}
