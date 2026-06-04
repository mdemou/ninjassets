import { IdempotencyRepository, IIdempotencyRecord } from '@domain/_repositories/idempotency.repository';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';

interface IIdempotencyRowDB {
  request_fingerprint: string;
  response_status: number;
  response_body: unknown;
}

const idempotencyDbRepository: IdempotencyRepository = {
  async find(principalId: string, idempotencyKey: string): Promise<IIdempotencyRecord | null> {
    try {
      const row: IIdempotencyRowDB | undefined = await sqlService
        .myDb('idempotency_record')
        .where({ principal_id: principalId, idempotency_key: idempotencyKey })
        .first();
      if (!row) return null;
      return {
        requestFingerprint: row.request_fingerprint,
        responseStatus: row.response_status,
        responseBody: row.response_body,
      };
    } catch (error) {
      logger.error(__filename, 'find', 'error', error);
      return null;
    }
  },

  async store(params: {
    principalId: string;
    idempotencyKey: string;
    requestFingerprint: string;
    responseStatus: number;
    responseBody: unknown;
  }): Promise<void> {
    try {
      await sqlService
        .myDb('idempotency_record')
        .insert({
          principal_id: params.principalId,
          idempotency_key: params.idempotencyKey,
          request_fingerprint: params.requestFingerprint,
          response_status: params.responseStatus,
          response_body: JSON.stringify(params.responseBody),
        })
        .onConflict(['principal_id', 'idempotency_key'])
        .ignore();
    } catch (error) {
      logger.error(__filename, 'store', 'error', error);
    }
  },

  async deleteOlderThan(date: Date): Promise<number> {
    try {
      return await sqlService
        .myDb('idempotency_record')
        .where('created_at', '<', date.toISOString())
        .del();
    } catch (error) {
      logger.error(__filename, 'deleteOlderThan', 'error', error);
      return 0;
    }
  },
};

export default idempotencyDbRepository;
