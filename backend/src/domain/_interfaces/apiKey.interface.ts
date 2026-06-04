/** Wildcard capability — full admin (SPEC-API-001 §7.5). */
export const CAPABILITY_WILDCARD = '*';

/** Stored API key row (never includes the raw secret). */
export interface IApiKey {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  capabilities: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

/** List/detail shape enriched with owner display data (deployment-wide list). */
export interface IApiKeyWithOwner extends IApiKey {
  ownerEmail: string | null;
  ownerName: string | null;
  ownerAvatarFilename: string | null;
}

export interface ICreateApiKeyRow {
  userId: string;
  name: string;
  prefix: string;
  secretHash: string;
  capabilities: string[];
  expiresAt: Date | null;
}

/** Row used by the auth strategy: includes the secret hash for comparison. */
export interface IApiKeyAuthRow {
  id: string;
  userId: string;
  secretHash: string;
  capabilities: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

/** Returned to the client only once, at create/regenerate. */
export interface IApiKeySecretResult {
  id: string;
  name: string;
  prefix: string;
  secret: string;
  capabilities: string[];
  expiresAt: string | null;
}

export interface IApiAccessLogEntry {
  apiKeyId: string | null;
  userId: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number | null;
  ip: string | null;
}

export interface IApiAccessLogRow {
  id: string;
  apiKeyId: string | null;
  userId: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number | null;
  ip: string | null;
  createdAt: string;
  keyName: string | null;
  userEmail: string | null;
}

export interface IListApiAccessLogResult {
  logs: IApiAccessLogRow[];
  total: number;
}
