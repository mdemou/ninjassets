import {
  ICreateManufacturer,
  IManufacturer,
  IManufacturerWithAssetCount,
  IUpdateManufacturer,
} from '@domain/_interfaces/manufacturer.interface';
import { ManufacturerRepository } from '@domain/_repositories/manufacturer.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import { Knex } from 'knex';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import { adaptManufacturer, adaptManufacturerWithAssetCount } from './manufacturerDb.adapter';
import manufacturerDbErrors from './manufacturerDb.errors';
import { IManufacturerDB, IManufacturerWithAssetCountDB } from './manufacturerDb.interface';

const ASSET_COUNT_SUBQUERY =
  '(SELECT COUNT(*) FROM asset WHERE asset.manufacturer_id = manufacturer.id) as asset_count';

const manufacturerDbRepository: ManufacturerRepository = {
  async list({ search, page }): Promise<{ manufacturers: IManufacturerWithAssetCount[]; total: number }> {
    try {
      const applyFilters = (qb: Knex.QueryBuilder): Knex.QueryBuilder => {
        if (search) {
          const like = `%${search}%`;
          qb.whereILike('manufacturer.name', like);
        }
        return qb;
      };

      const countRow = await applyFilters(sqlService.myDb('manufacturer'))
        .count({ count: 'manufacturer.id' })
        .first();
      const total = Number((countRow as { count: string } | undefined)?.count ?? 0);

      const query = applyFilters(sqlService.myDb('manufacturer'))
        .select('manufacturer.*')
        .select(sqlService.myDb.raw(ASSET_COUNT_SUBQUERY))
        .orderBy('manufacturer.name', 'asc');

      if (page !== undefined) {
        const pageSize = config.pagination.pageSize;
        query.limit(pageSize).offset((page - 1) * pageSize);
      }

      const rows: IManufacturerWithAssetCountDB[] = await query;
      return { manufacturers: rows.map(adaptManufacturerWithAssetCount), total };
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      throw Boom.badImplementation(manufacturerDbErrors.internalError.message, {
        code: manufacturerDbErrors.internalError.code,
      });
    }
  },

  async findById(id: string): Promise<IManufacturerWithAssetCount | null> {
    try {
      const row: IManufacturerWithAssetCountDB | undefined = await sqlService
        .myDb('manufacturer')
        .select('manufacturer.*')
        .select(sqlService.myDb.raw(ASSET_COUNT_SUBQUERY))
        .where('manufacturer.id', id)
        .first();
      return row ? adaptManufacturerWithAssetCount(row) : null;
    } catch (error) {
      logger.error(__filename, 'findById', 'error', error);
      throw Boom.badImplementation(manufacturerDbErrors.internalError.message, {
        code: manufacturerDbErrors.internalError.code,
      });
    }
  },

  async findByNameNormalized(name: string): Promise<IManufacturer | null> {
    try {
      const row: IManufacturerDB | undefined = await sqlService
        .myDb('manufacturer')
        .whereRaw('LOWER(TRIM(name)) = ?', [name.trim().toLowerCase()])
        .first();
      return row ? adaptManufacturer(row) : null;
    } catch (error) {
      logger.error(__filename, 'findByNameNormalized', 'error', error);
      throw Boom.badImplementation(manufacturerDbErrors.internalError.message, {
        code: manufacturerDbErrors.internalError.code,
      });
    }
  },

  async create(data: ICreateManufacturer): Promise<IManufacturer> {
    try {
      const [row]: IManufacturerDB[] = await sqlService
        .myDb('manufacturer')
        .insert({ name: data.name.trim() })
        .returning('*');

      if (!row) {
        throw Boom.badImplementation(manufacturerDbErrors.internalError.message, {
          code: manufacturerDbErrors.internalError.code,
        });
      }
      return adaptManufacturer(row);
    } catch (error) {
      logger.error(__filename, 'create', 'error', error);
      throw Boom.badImplementation(manufacturerDbErrors.internalError.message, {
        code: manufacturerDbErrors.internalError.code,
      });
    }
  },

  async update(id: string, data: IUpdateManufacturer): Promise<void> {
    try {
      const updateData: Record<string, string> = {
        date_updated: new Date().toISOString(),
      };
      if (data.name !== undefined) updateData.name = data.name.trim();

      await sqlService.myDb('manufacturer').where({ id }).update(updateData);
    } catch (error) {
      logger.error(__filename, 'update', 'error', error);
      throw Boom.badImplementation(manufacturerDbErrors.internalError.message, {
        code: manufacturerDbErrors.internalError.code,
      });
    }
  },

  async updateImageFilename(id: string, filename: string | null): Promise<void> {
    try {
      await sqlService.myDb('manufacturer').where({ id }).update({
        image_filename: filename,
        date_updated: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(__filename, 'updateImageFilename', 'error', error);
      throw Boom.badImplementation(manufacturerDbErrors.internalError.message, {
        code: manufacturerDbErrors.internalError.code,
      });
    }
  },

  async countAssets(id: string): Promise<number> {
    try {
      const result = await sqlService
        .myDb('asset')
        .where({ manufacturer_id: id })
        .count('* as count')
        .first();
      return Number((result as { count: string } | undefined)?.count ?? 0);
    } catch (error) {
      logger.error(__filename, 'countAssets', 'error', error);
      throw Boom.badImplementation(manufacturerDbErrors.internalError.message, {
        code: manufacturerDbErrors.internalError.code,
      });
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await sqlService.myDb('manufacturer').where({ id }).del();
    } catch (error) {
      logger.error(__filename, 'delete', 'error', error);
      throw Boom.badImplementation(manufacturerDbErrors.internalError.message, {
        code: manufacturerDbErrors.internalError.code,
      });
    }
  },
};

export default manufacturerDbRepository;
