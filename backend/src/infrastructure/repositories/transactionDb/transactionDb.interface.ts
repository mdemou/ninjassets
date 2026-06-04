export interface ITransactionDB {
  id: string;
  date_created: string;
  action: string;
  asset_id: string | null;
  asset_name: string;
  asset_image_filename: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_avatar_filename: string | null;
  target_user_id: string | null;
  target_name: string | null;
  target_avatar_filename: string | null;
  detail: string | null;
}
