import { IApiAccessLogEntry, IListApiAccessLogResult } from '@domain/_interfaces/apiKey.interface';

export interface ApiAccessLogRepository {
  record(entry: IApiAccessLogEntry): Promise<void>;
  list(params: { apiKeyId?: string; page?: number; pageSize: number }): Promise<IListApiAccessLogResult>;
  /** Purge rows older than the retention window. Returns deleted count. */
  deleteOlderThan(date: Date): Promise<number>;
}
