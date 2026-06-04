import { IStatsOverview } from '@domain/_interfaces/stats.interface';

export interface StatsRepository {
  getOverview(): Promise<IStatsOverview>;
}
