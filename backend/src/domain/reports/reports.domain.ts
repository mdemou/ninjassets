import { IDataQualityIssue, IListDataQualityResult } from '@domain/_interfaces/dataQuality.interface';
import config from '@config/config';
import Boom from '@hapi/boom';

interface ReportsPorts {
  listDataQuality: (params: {
    search?: string;
    page?: number;
    pageSize?: number;
    issue?: IDataQualityIssue;
  }) => Promise<{ rows: IListDataQualityResult['rows']; total: number }>;
  getCurrentSignature: (assetId: string, issue: IDataQualityIssue) => Promise<string | null>;
  dismiss: (params: {
    assetId: string;
    issue: IDataQualityIssue;
    signature: string;
    dismissedByUserId: string | null;
  }) => Promise<void>;
  restore: (assetId: string, issue: IDataQualityIssue) => Promise<void>;
}

function reportsDomainFactory(ports: ReportsPorts) {
  return {
    async listDataQuality(params: {
      search?: string;
      page?: number;
      issue?: IDataQualityIssue;
    }): Promise<IListDataQualityResult> {
      const paginate = params.page !== undefined;
      const page = Math.max(1, params.page ?? 1);
      const pageSize = paginate ? config.pagination.pageSize : null;
      const { rows, total } = await ports.listDataQuality({
        search: params.search?.trim() || undefined,
        page,
        pageSize: pageSize ?? undefined,
        issue: params.issue,
      });
      return { rows, total, page, pageSize };
    },

    // Hide a computed data-quality row from the overview/bell lists. The signature is read
    // from live state (not the client) so the dismissal is anchored to the issue instance
    // as it exists now; a later change to that state resurfaces the alert.
    async dismissDataQuality(params: {
      assetId: string;
      issue: IDataQualityIssue;
      dismissedByUserId: string | null;
    }): Promise<void> {
      const signature = await ports.getCurrentSignature(params.assetId, params.issue);
      if (signature === null) {
        throw Boom.conflict('This issue is no longer present for the asset.');
      }
      await ports.dismiss({
        assetId: params.assetId,
        issue: params.issue,
        signature,
        dismissedByUserId: params.dismissedByUserId,
      });
    },

    // Undo a dismissal (idempotent — restoring a non-dismissed row is a no-op).
    async restoreDataQuality(params: {
      assetId: string;
      issue: IDataQualityIssue;
    }): Promise<void> {
      await ports.restore(params.assetId, params.issue);
    },
  };
}

export default reportsDomainFactory;
