import { IHandoverStatus, IHandoverType } from '@domain/_interfaces/handover.interface';

export interface IHandoverDB {
  id: string;
  date_created: string;
  asset_id: string;
  type: IHandoverType;
  status: IHandoverStatus;
  target_user_id: string;
  created_by_user_id: string | null;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_by_user_id: string | null;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
}

export interface IHandoverWithDetailsDB extends IHandoverDB {
  asset_name: string;
  asset_serial_number: string;
  asset_image_filename: string | null;
  target_user_name: string | null;
  target_user_email: string | null;
  target_user_avatar_filename: string | null;
}
