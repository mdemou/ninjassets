export interface IIdempotencyRecord {
  requestFingerprint: string;
  responseStatus: number;
  responseBody: unknown;
}

export interface IdempotencyRepository {
  find(principalId: string, idempotencyKey: string): Promise<IIdempotencyRecord | null>;
  /**
   * Store the first response for a (principal, key). Concurrent inserts race on the
   * unique index — a duplicate insert is swallowed and treated as "already stored".
   */
  store(params: {
    principalId: string;
    idempotencyKey: string;
    requestFingerprint: string;
    responseStatus: number;
    responseBody: unknown;
  }): Promise<void>;
  deleteOlderThan(date: Date): Promise<number>;
}
