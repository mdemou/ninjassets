import { ISite, ISiteWithAssetCount } from '@domain/_interfaces/site.interface';
import { ISiteDB, ISiteWithAssetCountDB } from './siteDb.interface';

export function adaptSite(row: ISiteDB): ISite {
  return {
    id: row.id,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
    name: row.name,
    description: row.description,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  };
}

export function adaptSiteWithAssetCount(row: ISiteWithAssetCountDB): ISiteWithAssetCount {
  return {
    ...adaptSite(row),
    assetCount: Number(row.asset_count),
  };
}
