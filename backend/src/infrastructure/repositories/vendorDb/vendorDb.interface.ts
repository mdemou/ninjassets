export interface IVendorDB {
  id: string;
  date_created: string;
  date_updated: string;
  name: string;
  image_filename: string | null;
}

export interface IVendorWithAssetCountDB extends IVendorDB {
  asset_count: string;
}
