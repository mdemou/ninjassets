import { IApiAccessLogEntry, IListApiAccessLogResult } from '@domain/_interfaces/apiKey.interface';
import { ApiAccessLogRepository } from '@domain/_repositories/apiAccessLog.repository';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';

interface IApiAccessLogRowDB {
  id: string;
  api_key_id: string | null;
  user_id: string | null;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number | null;
  ip: string | null;
  created_at: string;
  key_name: string | null;
  user_email: string | null;
}

const apiAccessLogDbRepository: ApiAccessLogRepository = {
  async record(entry: IApiAccessLogEntry): Promise<void> {
    try {
      await sqlService.myDb('api_access_log').insert({
        api_key_id: entry.apiKeyId,
        user_id: entry.userId,
        method: entry.method,
        path: entry.path,
        status_code: entry.statusCode,
        duration_ms: entry.durationMs,
        ip: entry.ip,
      });
    } catch (error) {
      // Logging the call must never break the call itself.
      logger.error(__filename, 'record', 'error', error);
    }
  },

  async list(params: {
    apiKeyId?: string;
    page?: number;
    pageSize: number;
  }): Promise<IListApiAccessLogResult> {
    try {
      const page = params.page && params.page > 0 ? params.page : 1;
      const offset = (page - 1) * params.pageSize;

      const base = sqlService.myDb('api_access_log');
      if (params.apiKeyId) base.where('api_access_log.api_key_id', params.apiKeyId);

      const countResult = await base.clone().count<{ count: string }[]>('* as count');
      const total = Number(countResult[0]?.count ?? 0);

      const rows: IApiAccessLogRowDB[] = await base
        .leftJoin('api_key', 'api_access_log.api_key_id', 'api_key.id')
        .leftJoin('user', 'api_access_log.user_id', 'user.id')
        .select(
          'api_access_log.*',
          'api_key.name as key_name',
          'user.email as user_email',
        )
        .orderBy('api_access_log.created_at', 'desc')
        .limit(params.pageSize)
        .offset(offset);

      return {
        total,
        logs: rows.map((row) => ({
          id: row.id,
          apiKeyId: row.api_key_id,
          userId: row.user_id,
          method: row.method,
          path: row.path,
          statusCode: row.status_code,
          durationMs: row.duration_ms,
          ip: row.ip,
          createdAt: row.created_at,
          keyName: row.key_name,
          userEmail: row.user_email,
        })),
      };
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      return { logs: [], total: 0 };
    }
  },

  async deleteOlderThan(date: Date): Promise<number> {
    try {
      return await sqlService.myDb('api_access_log').where('created_at', '<', date.toISOString()).del();
    } catch (error) {
      logger.error(__filename, 'deleteOlderThan', 'error', error);
      return 0;
    }
  },
};

export default apiAccessLogDbRepository;
