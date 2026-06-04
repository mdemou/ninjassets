import { ICreateSite, ISite, ISiteWithAssetCount, IUpdateSite } from '@domain/_interfaces/site.interface';
import { SiteRepository } from '@domain/_repositories/site.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import { Knex } from 'knex';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import { adaptSite, adaptSiteWithAssetCount } from './siteDb.adapter';
import siteDbErrors from './siteDb.errors';
import { ISiteDB, ISiteWithAssetCountDB } from './siteDb.interface';

const ASSET_COUNT_SUBQUERY = '(SELECT COUNT(*) FROM asset WHERE asset.site_id = site.id) as asset_count';

const siteDbRepository: SiteRepository = {
  async list({
    search,
    page,
  }: {
    search?: string;
    page?: number;
  }): Promise<{ sites: ISiteWithAssetCount[]; total: number }> {
    try {
      const applyFilters = (qb: Knex.QueryBuilder): Knex.QueryBuilder => {
        if (search) {
          const like = `%${search}%`;
          qb.where((b) => {
            b.whereILike('site.name', like)
              .orWhereILike('site.description', like)
              .orWhereILike('site.address', like);
          });
        }
        return qb;
      };

      const countRow = await applyFilters(sqlService.myDb('site')).count({ count: 'site.id' }).first();
      const total = Number((countRow as { count: string } | undefined)?.count ?? 0);

      const query = applyFilters(sqlService.myDb('site'))
        .select('site.*')
        .select(sqlService.myDb.raw(ASSET_COUNT_SUBQUERY))
        .orderBy('site.name', 'asc');

      // Paginate only when a page is requested; otherwise return every site
      // (used by the overview map and the asset-form site dropdown). Page size
      // is server-owned.
      if (page !== undefined) {
        const pageSize = config.pagination.pageSize;
        query.limit(pageSize).offset((page - 1) * pageSize);
      }

      const rows: ISiteWithAssetCountDB[] = await query;
      return { sites: rows.map(adaptSiteWithAssetCount), total };
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      throw Boom.badImplementation(siteDbErrors.internalError.message, {
        code: siteDbErrors.internalError.code,
      });
    }
  },

  async findById(id: string): Promise<ISiteWithAssetCount | null> {
    try {
      const row: ISiteWithAssetCountDB | undefined = await sqlService
        .myDb('site')
        .select('site.*')
        .select(sqlService.myDb.raw(ASSET_COUNT_SUBQUERY))
        .where('site.id', id)
        .first();
      return row ? adaptSiteWithAssetCount(row) : null;
    } catch (error) {
      logger.error(__filename, 'findById', 'error', error);
      throw Boom.badImplementation(siteDbErrors.internalError.message, {
        code: siteDbErrors.internalError.code,
      });
    }
  },

  async create(data: ICreateSite): Promise<ISite> {
    try {
      const [row]: ISiteDB[] = await sqlService
        .myDb('site')
        .insert({
          name: data.name,
          description: data.description ?? null,
          address: data.address ?? null,
          latitude: data.latitude,
          longitude: data.longitude,
        })
        .returning('*');

      if (!row) {
        throw Boom.badImplementation(siteDbErrors.internalError.message, {
          code: siteDbErrors.internalError.code,
        });
      }
      return adaptSite(row);
    } catch (error) {
      logger.error(__filename, 'create', 'error', error);
      throw Boom.badImplementation(siteDbErrors.internalError.message, {
        code: siteDbErrors.internalError.code,
      });
    }
  },

  async update(id: string, data: IUpdateSite): Promise<void> {
    try {
      const updateData: Record<string, string | number | null> = {
        date_updated: new Date().toISOString(),
      };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.latitude !== undefined) updateData.latitude = data.latitude;
      if (data.longitude !== undefined) updateData.longitude = data.longitude;

      await sqlService.myDb('site').where({ id }).update(updateData);
    } catch (error) {
      logger.error(__filename, 'update', 'error', error);
      throw Boom.badImplementation(siteDbErrors.internalError.message, {
        code: siteDbErrors.internalError.code,
      });
    }
  },

  async countAssets(id: string): Promise<number> {
    try {
      const result = await sqlService.myDb('asset').where({ site_id: id }).count('* as count').first();
      return Number((result as { count: string } | undefined)?.count ?? 0);
    } catch (error) {
      logger.error(__filename, 'countAssets', 'error', error);
      throw Boom.badImplementation(siteDbErrors.internalError.message, {
        code: siteDbErrors.internalError.code,
      });
    }
  },

  async deleteLinkedAssets(id: string): Promise<void> {
    try {
      await sqlService.myDb('asset').where({ site_id: id }).del();
    } catch (error) {
      logger.error(__filename, 'deleteLinkedAssets', 'error', error);
      throw Boom.badImplementation(siteDbErrors.internalError.message, {
        code: siteDbErrors.internalError.code,
      });
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await sqlService.myDb('site').where({ id }).del();
    } catch (error) {
      logger.error(__filename, 'delete', 'error', error);
      throw Boom.badImplementation(siteDbErrors.internalError.message, {
        code: siteDbErrors.internalError.code,
      });
    }
  },
};

export default siteDbRepository;
