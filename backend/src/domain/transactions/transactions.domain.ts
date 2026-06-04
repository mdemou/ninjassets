import { IListTransactionsResult } from '@domain/_interfaces/transaction.interface';
import { TransactionRepository } from '@domain/_repositories/transaction.repository';
import config from '@config/config';

interface TransactionRepositories {
  transactionRepository: TransactionRepository;
}

interface ListInput {
  search?: string;
  page?: number;
}

function transactionDomainFactory(repositories: TransactionRepositories) {
  const { transactionRepository } = repositories;

  return {
    /** Admin view: the whole audit log. */
    async listTransactions(input: ListInput): Promise<IListTransactionsResult> {
      const page = Math.max(1, input.page ?? 1);
      const { transactions, total } = await transactionRepository.list({
        search: input.search?.trim() || undefined,
        page,
      });
      return { transactions, total, page, pageSize: config.pagination.pageSize };
    },

    /** Personal view: only events concerning the given user's assignments. */
    async listMyTransactions(userId: string, input: ListInput): Promise<IListTransactionsResult> {
      const page = Math.max(1, input.page ?? 1);
      const { transactions, total } = await transactionRepository.list({
        search: input.search?.trim() || undefined,
        page,
        targetUserId: userId,
      });
      return { transactions, total, page, pageSize: config.pagination.pageSize };
    },

    /** Admin view: audit log for a single asset. */
    async listAssetTransactions(assetId: string, input: ListInput): Promise<IListTransactionsResult> {
      const page = Math.max(1, input.page ?? 1);
      const { transactions, total } = await transactionRepository.list({
        search: input.search?.trim() || undefined,
        page,
        assetId,
      });
      return { transactions, total, page, pageSize: config.pagination.pageSize };
    },
  };
}

export default transactionDomainFactory;
