export interface IStatsTotals {
  assets: number;
  sites: number;
  users: number;
  assignedAssets: number;
  manufacturers: number;
  vendors: number;
}

export interface IManufacturerAssetCount {
  manufacturerId: string | null;
  manufacturerName: string | null;
  count: number;
}

export interface IVendorAssetCount {
  vendorId: string | null;
  vendorName: string | null;
  count: number;
}

export interface IStatusCount {
  status: string;
  count: number;
}

export interface ISiteAssetCount {
  siteId: string | null;
  siteName: string | null;
  count: number;
}

export interface IAttentionCounts {
  inactiveUserAssignedCount: number;
  assignedWithoutUserCount: number;
  warrantyExpiredCount: number;
  warrantyExpiring30DaysCount: number;
  returnOverdueCount: number;
  returnDueSoon7DaysCount: number;
}

export interface IStatsOverview {
  totals: IStatsTotals;
  assetsByStatus: IStatusCount[];
  assetsBySite: ISiteAssetCount[];
  assetsByManufacturer: IManufacturerAssetCount[];
  assetsByVendor: IVendorAssetCount[];
  attention: IAttentionCounts;
}
