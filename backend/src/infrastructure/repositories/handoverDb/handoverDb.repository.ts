import {
  ICreateHandover,
  IHandover,
  IHandoverStatus,
  IHandoverWithDetails,
  IPendingHandover,
} from '@domain/_interfaces/handover.interface';
import { HandoverRepository } from '@domain/_repositories/handover.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import {
  adaptHandover,
  adaptHandoverWithDetails,
  adaptPendingHandover,
  IPendingHandoverRowDB,
} from './handoverDb.adapter';
import handoverDbErrors from './handoverDb.errors';
import { IHandoverDB, IHandoverWithDetailsDB } from './handoverDb.interface';

/** Columns + joins for the enriched read shape (asset + target user display data). */
function detailsQuery() {
  return sqlService
    .myDb('handover')
    .leftJoin('asset', 'handover.asset_id', 'asset.id')
    .leftJoin({ target_user: 'user' }, 'handover.target_user_id', 'target_user.id')
    .select(
      'handover.*',
      'asset.name as asset_name',
      'asset.serial_number as asset_serial_number',
      'asset.image_filename as asset_image_filename',
      'target_user.display_name as target_user_name',
      'target_user.email as target_user_email',
      'target_user.avatar_filename as target_user_avatar_filename',
    );
}

function internal(): never {
  throw Boom.badImplementation(handoverDbErrors.internalError.message, {
    code: handoverDbErrors.internalError.code,
  });
}

const handoverDbRepository: HandoverRepository = {
  async create(data: ICreateHandover): Promise<IHandover> {
    try {
      const [row]: IHandoverDB[] = await sqlService
        .myDb('handover')
        .insert({
          asset_id: data.assetId,
          type: data.type,
          status: IHandoverStatus.OPEN,
          target_user_id: data.targetUserId,
          created_by_user_id: data.createdByUserId,
          token_hash: data.tokenHash,
          expires_at: data.expiresAt,
        })
        .returning('*');
      if (!row) return internal();
      return adaptHandover(row);
    } catch (error) {
      logger.error(__filename, 'create', 'error', error);
      return internal();
    }
  },

  async findById(id: string): Promise<IHandoverWithDetails | null> {
    try {
      const row: IHandoverWithDetailsDB | undefined = await detailsQuery()
        .where('handover.id', id)
        .first();
      return row ? adaptHandoverWithDetails(row) : null;
    } catch (error) {
      logger.error(__filename, 'findById', 'error', error);
      return internal();
    }
  },

  async findByTokenHash(tokenHash: string): Promise<IHandoverWithDetails | null> {
    try {
      const row: IHandoverWithDetailsDB | undefined = await detailsQuery()
        .where('handover.token_hash', tokenHash)
        .first();
      return row ? adaptHandoverWithDetails(row) : null;
    } catch (error) {
      logger.error(__filename, 'findByTokenHash', 'error', error);
      return internal();
    }
  },

  async findOpenByAssetId(assetId: string): Promise<IHandover | null> {
    try {
      const row: IHandoverDB | undefined = await sqlService
        .myDb('handover')
        .where({ asset_id: assetId, status: IHandoverStatus.OPEN })
        .first();
      return row ? adaptHandover(row) : null;
    } catch (error) {
      logger.error(__filename, 'findOpenByAssetId', 'error', error);
      return internal();
    }
  },

  async listByAssetId(assetId: string, limit: number): Promise<IHandoverWithDetails[]> {
    try {
      const rows: IHandoverWithDetailsDB[] = await detailsQuery()
        .where('handover.asset_id', assetId)
        .orderBy('handover.date_created', 'desc')
        .limit(limit);
      return rows.map(adaptHandoverWithDetails);
    } catch (error) {
      logger.error(__filename, 'listByAssetId', 'error', error);
      return internal();
    }
  },

  async listAllOpen(limit: number): Promise<IHandoverWithDetails[]> {
    try {
      const rows: IHandoverWithDetailsDB[] = await detailsQuery()
        .where('handover.status', IHandoverStatus.OPEN)
        .where('handover.expires_at', '>', new Date().toISOString())
        .orderBy('handover.date_created', 'desc')
        .limit(limit);
      return rows.map(adaptHandoverWithDetails);
    } catch (error) {
      logger.error(__filename, 'listAllOpen', 'error', error);
      return internal();
    }
  },

  async listOpenByTargetUserId(targetUserId: string, limit: number): Promise<IPendingHandover[]> {
    try {
      const rows = (await sqlService
        .myDb('handover')
        .leftJoin('asset', 'handover.asset_id', 'asset.id')
        .select(
          'handover.id',
          'handover.type',
          'handover.expires_at',
          'handover.asset_id',
          'asset.name as asset_name',
          'asset.serial_number as asset_serial_number',
        )
        .where('handover.status', IHandoverStatus.OPEN)
        .where('handover.target_user_id', targetUserId)
        .where('handover.expires_at', '>', new Date().toISOString())
        .orderBy('handover.date_created', 'desc')
        .limit(limit)) as IPendingHandoverRowDB[];
      return rows.map(adaptPendingHandover);
    } catch (error) {
      logger.error(__filename, 'listOpenByTargetUserId', 'error', error);
      return internal();
    }
  },

  async consume(id: string, consumedByUserId: string): Promise<IHandover | null> {
    try {
      // Compare-and-set: only an OPEN row transitions, so two concurrent accepts
      // cannot both win.
      const [row]: IHandoverDB[] = await sqlService
        .myDb('handover')
        .where({ id, status: IHandoverStatus.OPEN })
        .update({
          status: IHandoverStatus.CONSUMED,
          consumed_at: new Date().toISOString(),
          consumed_by_user_id: consumedByUserId,
        })
        .returning('*');
      return row ? adaptHandover(row) : null;
    } catch (error) {
      logger.error(__filename, 'consume', 'error', error);
      return internal();
    }
  },

  async cancel(id: string, cancelledByUserId: string): Promise<boolean> {
    try {
      const count = await sqlService
        .myDb('handover')
        .where({ id, status: IHandoverStatus.OPEN })
        .update({
          status: IHandoverStatus.CANCELLED,
          cancelled_at: new Date().toISOString(),
          cancelled_by_user_id: cancelledByUserId,
        });
      return count > 0;
    } catch (error) {
      logger.error(__filename, 'cancel', 'error', error);
      return internal();
    }
  },

  async expire(id: string): Promise<boolean> {
    try {
      const count = await sqlService
        .myDb('handover')
        .where({ id, status: IHandoverStatus.OPEN })
        .update({ status: IHandoverStatus.EXPIRED });
      return count > 0;
    } catch (error) {
      logger.error(__filename, 'expire', 'error', error);
      return internal();
    }
  },
};

export default handoverDbRepository;
