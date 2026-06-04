export interface IAssetDB {
  id: string;
  date_created: string;
  date_updated: string;
  name: string;
  model: string;
  serial_number: string;
  status: string;
  assigned_user_id: string | null;
  site_id: string | null;
  latitude: string | null;
  longitude: string | null;
  image_filename: string | null;
  note: string | null;
  manufacturer_id: string | null;
  vendor_id: string | null;
  parent_asset_id: string | null;
  category_id: string | null;
  custom_fields: Record<string, unknown> | null;
  purchase_date: string | Date | null;
  purchase_cost: string | null;
  salvage_value: string | null;
  useful_life_months: number | null;
  depreciation_method: string | null;
  warranty_end_date: string | Date | null;
  expected_return_date: string | Date | null;
}

/** Slim list row for GET /api/me/assets. */
export interface IAssigneeListAssetDB {
  id: string;
  name: string;
  model: string;
  serial_number: string;
  status: string;
  manufacturer_id: string | null;
  site_id: string | null;
  latitude: string | null;
  longitude: string | null;
  site_name: string | null;
  manufacturer_name: string | null;
  manufacturer_image_filename: string | null;
  effective_latitude: string | null;
  effective_longitude: string | null;
  assigned_at: string | null;
}

export interface IAssetWithAssigneeDB extends IAssetDB {
  assigned_user_name: string | null;
  assigned_user_email: string | null;
  assigned_user_avatar_filename: string | null;
  site_name: string | null;
  effective_latitude: string | null;
  effective_longitude: string | null;
  manufacturer_name: string | null;
  manufacturer_image_filename: string | null;
  vendor_name: string | null;
  parent_asset_name: string | null;
  category_name: string | null;
  child_count: string;
  assigned_at: string | null;
}
