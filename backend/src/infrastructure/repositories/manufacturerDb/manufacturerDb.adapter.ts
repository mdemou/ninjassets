import {
  IManufacturer,
  IManufacturerWithAssetCount,
} from '@domain/_interfaces/manufacturer.interface';
import { IManufacturerDB, IManufacturerWithAssetCountDB } from './manufacturerDb.interface';

export function adaptManufacturer(row: IManufacturerDB): IManufacturer {
  return {
    id: row.id,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
    name: row.name,
    imageFilename: row.image_filename,
  };
}

export function adaptManufacturerWithAssetCount(
  row: IManufacturerWithAssetCountDB,
): IManufacturerWithAssetCount {
  return {
    ...adaptManufacturer(row),
    assetCount: Number(row.asset_count),
  };
}
