export interface ISiteDB {
  id: string;
  date_created: string;
  date_updated: string;
  name: string;
  description: string | null;
  address: string | null;
  // Postgres numeric/decimal columns are returned as strings by node-postgres.
  latitude: string;
  longitude: string;
}

export interface ISiteWithAssetCountDB extends ISiteDB {
  asset_count: string;
}
