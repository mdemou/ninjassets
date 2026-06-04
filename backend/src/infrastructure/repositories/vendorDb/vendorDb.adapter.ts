import { IVendor, IVendorWithAssetCount } from '@domain/_interfaces/vendor.interface';
import { IVendorDB, IVendorWithAssetCountDB } from './vendorDb.interface';

export function adaptVendor(row: IVendorDB): IVendor {
  return {
    id: row.id,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
    name: row.name,
    imageFilename: row.image_filename,
  };
}

export function adaptVendorWithAssetCount(row: IVendorWithAssetCountDB): IVendorWithAssetCount {
  return {
    ...adaptVendor(row),
    assetCount: Number(row.asset_count),
  };
}
