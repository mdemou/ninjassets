import {
  ICreateVendor,
  IUpdateVendor,
  IVendor,
  IVendorWithAssetCount,
} from '@domain/_interfaces/vendor.interface';

export interface VendorRepository {
  list(params: { search?: string; page?: number }): Promise<{
    vendors: IVendorWithAssetCount[];
    total: number;
  }>;
  findById(id: string): Promise<IVendorWithAssetCount | null>;
  findByNameNormalized(name: string): Promise<IVendor | null>;
  create(data: ICreateVendor): Promise<IVendor>;
  update(id: string, data: IUpdateVendor): Promise<void>;
  updateImageFilename(id: string, filename: string | null): Promise<void>;
  countAssets(id: string): Promise<number>;
  delete(id: string): Promise<void>;
}
