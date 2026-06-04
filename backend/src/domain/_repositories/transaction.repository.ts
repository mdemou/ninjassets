import {
  ICreateTransaction,
  ITransaction,
  IListTransactionsParams,
} from '@domain/_interfaces/transaction.interface';

export interface TransactionRepository {
  /** Bulk-insert audit-log rows. Never throws to the caller's main flow. */
  createMany(events: ICreateTransaction[]): Promise<void>;
  list(params: IListTransactionsParams): Promise<{ transactions: ITransaction[]; total: number }>;
}
