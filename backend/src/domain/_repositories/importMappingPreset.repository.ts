import {
  ICreateImportMappingPreset,
  IImportEntityType,
  IImportMappingPreset,
} from '@domain/_interfaces/importExport.interface';

export interface ImportMappingPresetRepository {
  create(data: ICreateImportMappingPreset): Promise<IImportMappingPreset>;
  findById(id: string): Promise<IImportMappingPreset | null>;
  listByEntityType(entityType: IImportEntityType): Promise<IImportMappingPreset[]>;
  delete(id: string): Promise<void>;
}
