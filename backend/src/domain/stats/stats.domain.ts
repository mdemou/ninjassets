import { IStatsOverview } from '@domain/_interfaces/stats.interface';
import { StatsRepository } from '@domain/_repositories/stats.repository';

interface StatsRepositories {
  statsRepository: StatsRepository;
}

function statsDomainFactory(repositories: StatsRepositories) {
  const { statsRepository } = repositories;

  return {
    async getOverview(): Promise<IStatsOverview> {
      return statsRepository.getOverview();
    },
  };
}

export default statsDomainFactory;
