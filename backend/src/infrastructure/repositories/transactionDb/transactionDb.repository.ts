import {
  ICreateTransaction,
  IListTransactionsParams,
  ITransaction,
} from '@domain/_interfaces/transaction.interface';
import { TransactionRepository } from '@domain/_repositories/transaction.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import { Knex } from 'knex';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import { adaptTransaction } from './transactionDb.adapter';
import transactionDbErrors from './transactionDb.errors';
import { ITransactionDB } from './transactionDb.interface';

const transactionDbRepository: TransactionRepository = {
  async createMany(events: ICreateTransaction[]): Promise<void> {
    if (events.length === 0) return;
    try {
      await sqlService.myDb('transaction').insert(
        events.map((e) => ({
          action: e.action,
          asset_id: e.assetId,
          asset_name: e.assetName,
          actor_user_id: e.actorUserId,
          actor_name: e.actorName,
          target_user_id: e.targetUserId,
          target_name: e.targetName,
          detail: e.detail ?? null,
        })),
      );
    } catch (error) {
      logger.error(__filename, 'createMany', 'error', error);
      throw Boom.badImplementation(transactionDbErrors.internalError.message, {
        code: transactionDbErrors.internalError.code,
      });
    }
  },

  async list({
    search,
    page,
    targetUserId,
    assetId,
  }: IListTransactionsParams): Promise<{ transactions: ITransaction[]; total: number }> {
    try {
      const applyFilters = (qb: Knex.QueryBuilder): Knex.QueryBuilder => {
        if (targetUserId) {
          qb.where('target_user_id', targetUserId);
        }
        if (assetId) {
          qb.where('asset_id', assetId);
        }
        if (search) {
          const like = `%${search}%`;
          qb.where((b) => {
            b.whereILike('asset_name', like)
              .orWhereILike('actor_name', like)
              .orWhereILike('target_name', like)
              .orWhereILike('detail', like)
              // action is a Postgres enum — cast to text so ILIKE applies.
              .orWhereRaw('action::text ILIKE ?', [like]);
          });
        }
        return qb;
      };

      const countRow = await applyFilters(sqlService.myDb('transaction')).count({ count: 'id' }).first();
      const total = Number((countRow as { count: string } | undefined)?.count ?? 0);

      const personalHistory = Boolean(targetUserId) && !assetId;
      const baseQuery = sqlService.myDb('transaction').leftJoin('asset', 'transaction.asset_id', 'asset.id');

      if (!personalHistory) {
        baseQuery
          .leftJoin({ actor_user: 'user' }, 'transaction.actor_user_id', 'actor_user.id')
          .leftJoin({ target_user: 'user' }, 'transaction.target_user_id', 'target_user.id');
      }

      const query = applyFilters(baseQuery)
        .select(
          personalHistory
            ? [
                'transaction.id',
                'transaction.date_created',
                'transaction.action',
                'transaction.asset_id',
                'transaction.asset_name',
                'transaction.detail',
                'asset.image_filename as asset_image_filename',
              ]
            : [
                'transaction.*',
                'asset.image_filename as asset_image_filename',
                'actor_user.avatar_filename as actor_avatar_filename',
                'target_user.avatar_filename as target_avatar_filename',
              ],
        )
        .orderBy('transaction.date_created', 'desc');

      if (page !== undefined) {
        const pageSize = config.pagination.pageSize;
        query.limit(pageSize).offset((page - 1) * pageSize);
      }

      const rows: ITransactionDB[] = await query;
      return { transactions: rows.map(adaptTransaction), total };
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      throw Boom.badImplementation(transactionDbErrors.internalError.message, {
        code: transactionDbErrors.internalError.code,
      });
    }
  },
};

export default transactionDbRepository;
