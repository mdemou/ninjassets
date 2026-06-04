import {
  ICreateManufacturer,
  IManufacturer,
  IManufacturerWithAssetCount,
  IUpdateManufacturer,
} from '@domain/_interfaces/manufacturer.interface';

export interface ManufacturerRepository {
  list(params: { search?: string; page?: number }): Promise<{
    manufacturers: IManufacturerWithAssetCount[];
    total: number;
  }>;
  findById(id: string): Promise<IManufacturerWithAssetCount | null>;
  findByNameNormalized(name: string): Promise<IManufacturer | null>;
  create(data: ICreateManufacturer): Promise<IManufacturer>;
  update(id: string, data: IUpdateManufacturer): Promise<void>;
  updateImageFilename(id: string, filename: string | null): Promise<void>;
  countAssets(id: string): Promise<number>;
  delete(id: string): Promise<void>;
}
