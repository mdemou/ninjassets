export interface ISite {
  id: string;
  dateCreated: string;
  dateUpdated: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
}

/** Site enriched with the number of assets currently linked to it. */
export interface ISiteWithAssetCount extends ISite {
  assetCount: number;
}

export interface ICreateSite {
  name: string;
  description?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
}

export interface IUpdateSite {
  name?: string;
  description?: string | null;
  address?: string | null;
  latitude?: number;
  longitude?: number;
}
