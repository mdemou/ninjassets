import { IDataQualityIssue, IAlertsResult } from '@domain/_interfaces/dataQuality.interface';

const MAX_ALERT_LIMIT = 50;
const DEFAULT_ALERT_LIMIT = 20;

interface AlertsPorts {
  listAlerts: (params: {
    limit: number;
    issue?: IDataQualityIssue;
    excludeDismissed?: boolean;
  }) => Promise<IAlertsResult>;
}

function alertsDomainFactory(ports: AlertsPorts) {
  return {
    async listAlerts(params: {
      limit?: number;
      issue?: IDataQualityIssue;
      excludeDismissed?: boolean;
    }): Promise<IAlertsResult> {
      const limit = Math.min(
        MAX_ALERT_LIMIT,
        Math.max(1, params.limit ?? DEFAULT_ALERT_LIMIT),
      );
      return ports.listAlerts({
        limit,
        issue: params.issue,
        excludeDismissed: params.excludeDismissed,
      });
    },
  };
}

export default alertsDomainFactory;
