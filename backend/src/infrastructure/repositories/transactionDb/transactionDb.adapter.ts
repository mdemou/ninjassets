import { ITransaction, ITransactionAction } from '@domain/_interfaces/transaction.interface';
import { ITransactionDB } from './transactionDb.interface';

export function adaptTransaction(row: ITransactionDB): ITransaction {
  return {
    id: row.id,
    dateCreated: row.date_created,
    action: row.action as ITransactionAction,
    assetId: row.asset_id,
    assetName: row.asset_name,
    assetImageFilename: row.asset_image_filename,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorAvatarFilename: row.actor_avatar_filename,
    targetUserId: row.target_user_id,
    targetName: row.target_name,
    targetAvatarFilename: row.target_avatar_filename,
    detail: row.detail,
  };
}
