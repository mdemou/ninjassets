import { IHandover, IHandoverWithDetails, IPendingHandover } from '@domain/_interfaces/handover.interface';
import { IHandoverDB, IHandoverWithDetailsDB } from './handoverDb.interface';

export function adaptHandover(row: IHandoverDB): IHandover {
  return {
    id: row.id,
    dateCreated: row.date_created,
    assetId: row.asset_id,
    type: row.type,
    status: row.status,
    targetUserId: row.target_user_id,
    createdByUserId: row.created_by_user_id,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    consumedByUserId: row.consumed_by_user_id,
    cancelledAt: row.cancelled_at,
    cancelledByUserId: row.cancelled_by_user_id,
  };
}

export interface IPendingHandoverRowDB {
  id: string;
  type: IPendingHandover['type'];
  expires_at: string;
  asset_id: string;
  asset_name: string;
  asset_serial_number: string;
}

export function adaptPendingHandover(row: IPendingHandoverRowDB): IPendingHandover {
  return {
    id: row.id,
    type: row.type,
    expiresAt: row.expires_at,
    assetId: row.asset_id,
    assetName: row.asset_name,
    assetSerialNumber: row.asset_serial_number,
  };
}

export function adaptHandoverWithDetails(row: IHandoverWithDetailsDB): IHandoverWithDetails {
  return {
    ...adaptHandover(row),
    assetName: row.asset_name,
    assetSerialNumber: row.asset_serial_number,
    assetImageFilename: row.asset_image_filename,
    targetUserName: row.target_user_name,
    targetUserEmail: row.target_user_email,
    targetUserAvatarFilename: row.target_user_avatar_filename,
  };
}
