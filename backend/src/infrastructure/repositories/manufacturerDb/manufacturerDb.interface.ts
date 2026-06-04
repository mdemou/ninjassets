export interface IManufacturerDB {
  id: string;
  date_created: string;
  date_updated: string;
  name: string;
  image_filename: string | null;
}

export interface IManufacturerWithAssetCountDB extends IManufacturerDB {
  asset_count: string;
}
