import {
  ICreateVendor,
  IUpdateVendor,
  IVendor,
  IVendorWithAssetCount,
} from '@domain/_interfaces/vendor.interface';
import { VendorRepository } from '@domain/_repositories/vendor.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import { Knex } from 'knex';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import { adaptVendor, adaptVendorWithAssetCount } from './vendorDb.adapter';
import vendorDbErrors from './vendorDb.errors';
import { IVendorDB, IVendorWithAssetCountDB } from './vendorDb.interface';

const ASSET_COUNT_SUBQUERY =
  '(SELECT COUNT(*) FROM asset WHERE asset.vendor_id = vendor.id) as asset_count';

const vendorDbRepository: VendorRepository = {
  async list({ search, page }): Promise<{ vendors: IVendorWithAssetCount[]; total: number }> {
    try {
      const applyFilters = (qb: Knex.QueryBuilder): Knex.QueryBuilder => {
        if (search) {
          const like = `%${search}%`;
          qb.whereILike('vendor.name', like);
        }
        return qb;
      };

      const countRow = await applyFilters(sqlService.myDb('vendor')).count({ count: 'vendor.id' }).first();
      const total = Number((countRow as { count: string } | undefined)?.count ?? 0);

      const query = applyFilters(sqlService.myDb('vendor'))
        .select('vendor.*')
        .select(sqlService.myDb.raw(ASSET_COUNT_SUBQUERY))
        .orderBy('vendor.name', 'asc');

      if (page !== undefined) {
        const pageSize = config.pagination.pageSize;
        query.limit(pageSize).offset((page - 1) * pageSize);
      }

      const rows: IVendorWithAssetCountDB[] = await query;
      return { vendors: rows.map(adaptVendorWithAssetCount), total };
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      throw Boom.badImplementation(vendorDbErrors.internalError.message, {
        code: vendorDbErrors.internalError.code,
      });
    }
  },

  async findById(id: string): Promise<IVendorWithAssetCount | null> {
    try {
      const row: IVendorWithAssetCountDB | undefined = await sqlService
        .myDb('vendor')
        .select('vendor.*')
        .select(sqlService.myDb.raw(ASSET_COUNT_SUBQUERY))
        .where('vendor.id', id)
        .first();
      return row ? adaptVendorWithAssetCount(row) : null;
    } catch (error) {
      logger.error(__filename, 'findById', 'error', error);
      throw Boom.badImplementation(vendorDbErrors.internalError.message, {
        code: vendorDbErrors.internalError.code,
      });
    }
  },

  async findByNameNormalized(name: string): Promise<IVendor | null> {
    try {
      const row: IVendorDB | undefined = await sqlService
        .myDb('vendor')
        .whereRaw('LOWER(TRIM(name)) = ?', [name.trim().toLowerCase()])
        .first();
      return row ? adaptVendor(row) : null;
    } catch (error) {
      logger.error(__filename, 'findByNameNormalized', 'error', error);
      throw Boom.badImplementation(vendorDbErrors.internalError.message, {
        code: vendorDbErrors.internalError.code,
      });
    }
  },

  async create(data: ICreateVendor): Promise<IVendor> {
    try {
      const [row]: IVendorDB[] = await sqlService
        .myDb('vendor')
        .insert({ name: data.name.trim() })
        .returning('*');

      if (!row) {
        throw Boom.badImplementation(vendorDbErrors.internalError.message, {
          code: vendorDbErrors.internalError.code,
        });
      }
      return adaptVendor(row);
    } catch (error) {
      logger.error(__filename, 'create', 'error', error);
      throw Boom.badImplementation(vendorDbErrors.internalError.message, {
        code: vendorDbErrors.internalError.code,
      });
    }
  },

  async update(id: string, data: IUpdateVendor): Promise<void> {
    try {
      const updateData: Record<string, string> = {
        date_updated: new Date().toISOString(),
      };
      if (data.name !== undefined) updateData.name = data.name.trim();

      await sqlService.myDb('vendor').where({ id }).update(updateData);
    } catch (error) {
      logger.error(__filename, 'update', 'error', error);
      throw Boom.badImplementation(vendorDbErrors.internalError.message, {
        code: vendorDbErrors.internalError.code,
      });
    }
  },

  async updateImageFilename(id: string, filename: string | null): Promise<void> {
    try {
      await sqlService.myDb('vendor').where({ id }).update({
        image_filename: filename,
        date_updated: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(__filename, 'updateImageFilename', 'error', error);
      throw Boom.badImplementation(vendorDbErrors.internalError.message, {
        code: vendorDbErrors.internalError.code,
      });
    }
  },

  async countAssets(id: string): Promise<number> {
    try {
      const result = await sqlService
        .myDb('asset')
        .where({ vendor_id: id })
        .count('* as count')
        .first();
      return Number((result as { count: string } | undefined)?.count ?? 0);
    } catch (error) {
      logger.error(__filename, 'countAssets', 'error', error);
      throw Boom.badImplementation(vendorDbErrors.internalError.message, {
        code: vendorDbErrors.internalError.code,
      });
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await sqlService.myDb('vendor').where({ id }).del();
    } catch (error) {
      logger.error(__filename, 'delete', 'error', error);
      throw Boom.badImplementation(vendorDbErrors.internalError.message, {
        code: vendorDbErrors.internalError.code,
      });
    }
  },
};

export default vendorDbRepository;
