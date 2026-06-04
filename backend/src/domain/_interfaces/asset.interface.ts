export enum IAssetStatus {
  STOCK = 'STOCK',
  ASSIGNED = 'ASSIGNED',
  MAINTENANCE = 'MAINTENANCE',
  ARCHIVED = 'ARCHIVED',
}

export enum IDepreciationMethod {
  STRAIGHT_LINE = 'STRAIGHT_LINE',
}

export interface IAssetChildSummary {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  status: IAssetStatus;
}

export interface IAsset {
  id: string;
  dateCreated: string;
  dateUpdated: string;
  name: string;
  model: string;
  serialNumber: string;
  status: IAssetStatus;
  assignedUserId: string | null;
  siteId: string | null;
  latitude: number | null;
  longitude: number | null;
  imageFilename: string | null;
  note: string | null;
  manufacturerId: string | null;
  vendorId: string | null;
  parentAssetId: string | null;
  categoryId: string | null;
  customFields: Record<string, unknown>;
  purchaseDate: string | null;
  purchaseCost: number | null;
  salvageValue: number | null;
  usefulLifeMonths: number | null;
  depreciationMethod: IDepreciationMethod | null;
  warrantyEndDate: string | null;
  expectedReturnDate: string | null;
}

/** Asset enriched with joined display/location/financial data. */
export interface IAssetWithAssignee extends IAsset {
  categoryName: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  assignedUserAvatarFilename: string | null;
  siteName: string | null;
  effectiveLatitude: number | null;
  effectiveLongitude: number | null;
  manufacturerName: string | null;
  manufacturerImageFilename: string | null;
  /** When the asset was last assigned to the current assignee (from transaction history). */
  assignedAt: string | null;
  vendorName: string | null;
  parentAssetName: string | null;
  childCount: number;
  children?: IAssetChildSummary[];
  monthlyDepreciation: number | null;
  accumulatedDepreciation: number | null;
  bookValue: number | null;
}

export interface ICreateAsset {
  name: string;
  model?: string;
  serialNumber: string;
  status?: IAssetStatus;
  assignedUserId?: string | null;
  siteId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  note?: string | null;
  manufacturerId?: string | null;
  vendorId?: string | null;
  parentAssetId?: string | null;
  categoryId?: string | null;
  customFields?: Record<string, unknown>;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  salvageValue?: number | null;
  usefulLifeMonths?: number | null;
  depreciationMethod?: IDepreciationMethod | null;
  warrantyEndDate?: string | null;
  expectedReturnDate?: string | null;
}

export interface IUpdateAsset {
  name?: string;
  model?: string;
  serialNumber?: string;
  status?: IAssetStatus;
  assignedUserId?: string | null;
  siteId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  note?: string | null;
  manufacturerId?: string | null;
  vendorId?: string | null;
  parentAssetId?: string | null;
  categoryId?: string | null;
  customFields?: Record<string, unknown>;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  salvageValue?: number | null;
  usefulLifeMonths?: number | null;
  depreciationMethod?: IDepreciationMethod | null;
  warrantyEndDate?: string | null;
  expectedReturnDate?: string | null;
}

export interface IListAssetsParams {
  search?: string;
  page: number;
  assignedUserId?: string;
  /** Slim column set for the assignee's own asset list (/api/me/assets). */
  assigneeList?: boolean;
  siteId?: string;
  status?: IAssetStatus;
  manufacturerId?: string;
  vendorId?: string;
  categoryId?: string;
  /** Top-level assets only (no parent), for parent picker. */
  eligibleParent?: boolean;
  /** Assets with no parent, for linking as child. */
  eligibleChild?: boolean;
  excludeId?: string;
}

export interface IListAssetsResult {
  assets: IAssetWithAssignee[];
  total: number;
  page: number;
  pageSize: number;
}

/** Slim asset shape for the dashboard map: only what a marker needs. */
export interface IAssetMapMarker {
  id: string;
  name: string;
  siteName: string | null;
  effectiveLatitude: number;
  effectiveLongitude: number;
}
