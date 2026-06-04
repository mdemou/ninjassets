import {
  IAsset,
  IAssetMapMarker,
  IAssetWithAssignee,
  ICreateAsset,
  IListAssetsParams,
  IUpdateAsset,
} from '@domain/_interfaces/asset.interface';

export interface AssetRepository {
  list(params: IListAssetsParams): Promise<{ assets: IAssetWithAssignee[]; total: number }>;
  /** Every asset that resolves to a coordinate (own or inherited from its site). */
  listMapMarkers(): Promise<IAssetMapMarker[]>;
  findById(id: string): Promise<IAssetWithAssignee | null>;
  countChildren(id: string): Promise<number>;
  findBySerialNumber(serialNumber: string): Promise<IAsset | null>;
  create(data: ICreateAsset): Promise<IAsset>;
  update(id: string, data: IUpdateAsset): Promise<void>;
  updateImageFilename(id: string, filename: string | null): Promise<void>;
  delete(id: string): Promise<void>;
}
