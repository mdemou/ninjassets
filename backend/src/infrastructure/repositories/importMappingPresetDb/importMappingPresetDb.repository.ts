import {
  ICreateImportMappingPreset,
  IImportEntityType,
  IImportMapping,
  IImportMappingPreset,
} from '@domain/_interfaces/importExport.interface';
import { ImportMappingPresetRepository } from '@domain/_repositories/importMappingPreset.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';

interface IImportMappingPresetDB {
  id: string;
  name: string;
  entity_type: string;
  mapping_json: IImportMapping;
  created_by_user_id: string | null;
  created_at: string;
}

function adapt(row: IImportMappingPresetDB): IImportMappingPreset {
  return {
    id: row.id,
    name: row.name,
    entityType: row.entity_type as IImportEntityType,
    mapping: row.mapping_json,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

function fail(error: unknown, method: string): never {
  logger.error(__filename, method, 'error', error);
  throw Boom.badImplementation('Mapping preset repository error', { code: 'IEX5003' });
}

const importMappingPresetDbRepository: ImportMappingPresetRepository = {
  async create(data: ICreateImportMappingPreset): Promise<IImportMappingPreset> {
    try {
      const [row]: IImportMappingPresetDB[] = await sqlService
        .myDb('import_mapping_preset')
        .insert({
          name: data.name,
          entity_type: data.entityType,
          mapping_json: JSON.stringify(data.mapping),
          created_by_user_id: data.createdByUserId,
        })
        .returning('*');
      return adapt(row);
    } catch (error) {
      fail(error, 'create');
    }
  },

  async findById(id: string): Promise<IImportMappingPreset | null> {
    try {
      const row: IImportMappingPresetDB | undefined = await sqlService
        .myDb('import_mapping_preset')
        .where({ id })
        .first();
      return row ? adapt(row) : null;
    } catch (error) {
      fail(error, 'findById');
    }
  },

  async listByEntityType(entityType: IImportEntityType): Promise<IImportMappingPreset[]> {
    try {
      const rows: IImportMappingPresetDB[] = await sqlService
        .myDb('import_mapping_preset')
        .where({ entity_type: entityType })
        .orderBy('created_at', 'desc');
      return rows.map(adapt);
    } catch (error) {
      fail(error, 'listByEntityType');
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await sqlService.myDb('import_mapping_preset').where({ id }).del();
    } catch (error) {
      fail(error, 'delete');
    }
  },
};

export default importMappingPresetDbRepository;
