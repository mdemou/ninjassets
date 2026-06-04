import {
  IAsset,
  IAssetChildSummary,
  IAssetMapMarker,
  IAssetStatus,
  IAssetWithAssignee,
  ICreateAsset,
  IListAssetsParams,
  IUpdateAsset,
} from '@domain/_interfaces/asset.interface';
import { AssetRepository } from '@domain/_repositories/asset.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import { Knex } from 'knex';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import { adaptAsset, adaptAssigneeListAsset, adaptAssetWithAssignee } from './assetDb.adapter';
import assetDbErrors from './assetDb.errors';
import { IAssetDB, IAssigneeListAssetDB, IAssetWithAssigneeDB } from './assetDb.interface';

function isSerialNumberUniqueViolation(error: unknown): boolean {
  const pg = error as { code?: string; constraint?: string };
  return pg.code === '23505' && (pg.constraint?.includes('serial_number') ?? false);
}

function rethrowAssetDbError(error: unknown, method: string): never {
  if (isSerialNumberUniqueViolation(error)) {
    const { message, code } = assetDbErrors.serialAlreadyExists;
    throw Boom.conflict(message, { code });
  }
  logger.error(__filename, method, 'error', error);
  const { message, code } = assetDbErrors.internalError;
  throw Boom.badImplementation(message, { code });
}

const CHILD_COUNT_SUBQUERY =
  '(SELECT COUNT(*)::int FROM asset AS child WHERE child.parent_asset_id = asset.id) as child_count';

const ASSIGNED_AT_SUBQUERY = sqlService.myDb.raw(`(
    SELECT MAX(t.date_created)
    FROM transaction AS t
    WHERE t.asset_id = asset.id
      AND t.action = 'ASSIGNED'
      AND t.target_user_id = asset.assigned_user_id
  ) as assigned_at`);

const ASSIGNEE_LIST_COLUMNS = [
  'asset.id',
  'asset.name',
  'asset.model',
  'asset.serial_number',
  'asset.status',
  'asset.manufacturer_id',
  'asset.site_id',
  'asset.latitude',
  'asset.longitude',
  'site.name as site_name',
  'manufacturer.name as manufacturer_name',
  'manufacturer.image_filename as manufacturer_image_filename',
  sqlService.myDb.raw('COALESCE(asset.latitude, site.latitude) as effective_latitude'),
  sqlService.myDb.raw('COALESCE(asset.longitude, site.longitude) as effective_longitude'),
  ASSIGNED_AT_SUBQUERY,
];

const ASSIGNEE_COLUMNS = [
  'asset.id',
  'asset.date_created',
  'asset.date_updated',
  'asset.name',
  'asset.model',
  'asset.serial_number',
  'asset.status',
  'asset.assigned_user_id',
  'asset.site_id',
  'asset.latitude',
  'asset.longitude',
  'asset.image_filename',
  'asset.note',
  'asset.manufacturer_id',
  'asset.vendor_id',
  'asset.parent_asset_id',
  'asset.category_id',
  'asset.custom_fields',
  'asset.purchase_date',
  'asset.purchase_cost',
  'asset.salvage_value',
  'asset.useful_life_months',
  'asset.depreciation_method',
  'asset.warranty_end_date',
  'asset.expected_return_date',
  'user.display_name as assigned_user_name',
  'user.email as assigned_user_email',
  'user.avatar_filename as assigned_user_avatar_filename',
  'site.name as site_name',
  'manufacturer.name as manufacturer_name',
  'manufacturer.image_filename as manufacturer_image_filename',
  'vendor.name as vendor_name',
  'parent_asset.name as parent_asset_name',
  'category.name as category_name',
  sqlService.myDb.raw('COALESCE(asset.latitude, site.latitude) as effective_latitude'),
  sqlService.myDb.raw('COALESCE(asset.longitude, site.longitude) as effective_longitude'),
  sqlService.myDb.raw(CHILD_COUNT_SUBQUERY),
  ASSIGNED_AT_SUBQUERY,
];

function withJoins(qb: Knex.QueryBuilder, assigneeList: boolean): Knex.QueryBuilder {
  qb.leftJoin('site', 'asset.site_id', 'site.id').leftJoin(
    'manufacturer',
    'asset.manufacturer_id',
    'manufacturer.id',
  );
  if (assigneeList) return qb;
  return qb
    .leftJoin('user', 'asset.assigned_user_id', 'user.id')
    .leftJoin('vendor', 'asset.vendor_id', 'vendor.id')
    .leftJoin('category', 'asset.category_id', 'category.id')
    .leftJoin('asset as parent_asset', 'asset.parent_asset_id', 'parent_asset.id');
}

type AssetChildRow = {
  id: string;
  name: string;
  model: string;
  serial_number: string;
  status: string;
};

async function listChildren(parentId: string): Promise<IAssetChildSummary[]> {
  const rows: AssetChildRow[] = await sqlService
    .myDb('asset')
    .select('id', 'name', 'model', 'serial_number', 'status')
    .where('parent_asset_id', parentId)
    .orderBy('name', 'asc');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    model: row.model,
    serialNumber: row.serial_number,
    status: row.status as IAssetStatus,
  }));
}

const assetDbRepository: AssetRepository = {
  async list(params: IListAssetsParams): Promise<{ assets: IAssetWithAssignee[]; total: number }> {
    try {
      const assigneeList = params.assigneeList === true;
      const applyFilters = (qb: Knex.QueryBuilder): Knex.QueryBuilder => {
        withJoins(qb, assigneeList);
        if (params.assignedUserId) {
          qb.where('asset.assigned_user_id', params.assignedUserId);
        }
        if (params.siteId) {
          qb.where('asset.site_id', params.siteId);
        }
        if (params.status) {
          qb.where('asset.status', params.status);
        }
        if (params.manufacturerId) {
          qb.where('asset.manufacturer_id', params.manufacturerId);
        }
        if (params.vendorId) {
          qb.where('asset.vendor_id', params.vendorId);
        }
        if (params.categoryId) {
          qb.where('asset.category_id', params.categoryId);
        }
        if (params.eligibleParent || params.eligibleChild) {
          qb.whereNull('asset.parent_asset_id');
        }
        if (params.excludeId) {
          qb.whereNot('asset.id', params.excludeId);
        }
        if (params.search) {
          const like = `%${params.search}%`;
          qb.where((b) => {
            b.whereILike('asset.name', like)
              .orWhereILike('asset.model', like)
              .orWhereILike('asset.serial_number', like)
              .orWhereILike('asset.note', like)
              .orWhereILike('manufacturer.name', like);
            if (!assigneeList) {
              b.orWhereILike('user.display_name', like).orWhereILike('vendor.name', like);
            }
          });
        }
        return qb;
      };

      const countRow = await applyFilters(sqlService.myDb('asset'))
        .countDistinct({ count: 'asset.id' })
        .first();
      const total = Number((countRow as { count: string } | undefined)?.count ?? 0);

      const pageSize = config.pagination.pageSize;
      const listQuery = applyFilters(sqlService.myDb('asset'))
        .select(assigneeList ? ASSIGNEE_LIST_COLUMNS : ASSIGNEE_COLUMNS)
        .orderBy('asset.date_created', 'desc')
        .limit(pageSize)
        .offset((params.page - 1) * pageSize);

      if (assigneeList) {
        const rows: IAssigneeListAssetDB[] = await listQuery;
        return { assets: rows.map((r) => adaptAssigneeListAsset(r)), total };
      }

      const rows: IAssetWithAssigneeDB[] = await listQuery;
      return { assets: rows.map((r) => adaptAssetWithAssignee(r)), total };
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      throw Boom.badImplementation(assetDbErrors.internalError.message, {
        code: assetDbErrors.internalError.code,
      });
    }
  },

  async listMapMarkers(): Promise<IAssetMapMarker[]> {
    try {
      const rows: Array<{
        id: string;
        name: string;
        site_name: string | null;
        effective_latitude: number | string;
        effective_longitude: number | string;
      }> = await sqlService
        .myDb('asset')
        .leftJoin('site', 'asset.site_id', 'site.id')
        .select(
          'asset.id',
          'asset.name',
          'site.name as site_name',
          sqlService.myDb.raw('COALESCE(asset.latitude, site.latitude) as effective_latitude'),
          sqlService.myDb.raw('COALESCE(asset.longitude, site.longitude) as effective_longitude'),
        )
        .whereRaw('COALESCE(asset.latitude, site.latitude) IS NOT NULL')
        .whereRaw('COALESCE(asset.longitude, site.longitude) IS NOT NULL');

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        siteName: row.site_name,
        effectiveLatitude: Number(row.effective_latitude),
        effectiveLongitude: Number(row.effective_longitude),
      }));
    } catch (error) {
      logger.error(__filename, 'listMapMarkers', 'error', error);
      throw Boom.badImplementation(assetDbErrors.internalError.message, {
        code: assetDbErrors.internalError.code,
      });
    }
  },

  async findById(id: string): Promise<IAssetWithAssignee | null> {
    try {
      const row: IAssetWithAssigneeDB | undefined = await withJoins(sqlService.myDb('asset'), false)
        .select(ASSIGNEE_COLUMNS)
        .where('asset.id', id)
        .first();

      if (!row) return null;

      const children = Number(row.child_count ?? 0) > 0 ? await listChildren(id) : undefined;
      return adaptAssetWithAssignee(row, children);
    } catch (error) {
      logger.error(__filename, 'findById', 'error', error);
      throw Boom.badImplementation(assetDbErrors.internalError.message, {
        code: assetDbErrors.internalError.code,
      });
    }
  },

  async countChildren(id: string): Promise<number> {
    try {
      const result = await sqlService
        .myDb('asset')
        .where({ parent_asset_id: id })
        .count('* as count')
        .first();
      return Number((result as { count: string } | undefined)?.count ?? 0);
    } catch (error) {
      logger.error(__filename, 'countChildren', 'error', error);
      throw Boom.badImplementation(assetDbErrors.internalError.message, {
        code: assetDbErrors.internalError.code,
      });
    }
  },

  async findBySerialNumber(serialNumber: string): Promise<IAsset | null> {
    try {
      const row: IAssetDB | undefined = await sqlService
        .myDb('asset')
        .where('serial_number', serialNumber)
        .first();

      return row ? adaptAsset(row) : null;
    } catch (error) {
      logger.error(__filename, 'findBySerialNumber', 'error', error);
      throw Boom.badImplementation(assetDbErrors.internalError.message, {
        code: assetDbErrors.internalError.code,
      });
    }
  },

  async create(data: ICreateAsset): Promise<IAsset> {
    try {
      const [row]: IAssetDB[] = await sqlService
        .myDb('asset')
        .insert({
          name: data.name,
          model: data.model ?? '',
          serial_number: data.serialNumber,
          status: data.status,
          assigned_user_id: data.assignedUserId ?? null,
          site_id: data.siteId ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          note: data.note ?? null,
          manufacturer_id: data.manufacturerId ?? null,
          vendor_id: data.vendorId ?? null,
          parent_asset_id: data.parentAssetId ?? null,
          category_id: data.categoryId ?? null,
          custom_fields: JSON.stringify(data.customFields ?? {}),
          purchase_date: data.purchaseDate ?? null,
          purchase_cost: data.purchaseCost ?? null,
          salvage_value: data.salvageValue ?? null,
          useful_life_months: data.usefulLifeMonths ?? null,
          depreciation_method: data.depreciationMethod ?? null,
          warranty_end_date: data.warrantyEndDate ?? null,
          expected_return_date: data.expectedReturnDate ?? null,
        })
        .returning('*');

      if (!row) {
        throw Boom.badImplementation(assetDbErrors.internalError.message, {
          code: assetDbErrors.internalError.code,
        });
      }

      return adaptAsset(row);
    } catch (error) {
      rethrowAssetDbError(error, 'create');
    }
  },

  async update(id: string, data: IUpdateAsset): Promise<void> {
    try {
      const updateData: Record<string, string | number | null> = {
        date_updated: new Date().toISOString(),
      };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.model !== undefined) updateData.model = data.model;
      if (data.serialNumber !== undefined) updateData.serial_number = data.serialNumber;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.assignedUserId !== undefined) updateData.assigned_user_id = data.assignedUserId;
      if (data.siteId !== undefined) updateData.site_id = data.siteId;
      if (data.latitude !== undefined) updateData.latitude = data.latitude;
      if (data.longitude !== undefined) updateData.longitude = data.longitude;
      if (data.note !== undefined) updateData.note = data.note;
      if (data.manufacturerId !== undefined) updateData.manufacturer_id = data.manufacturerId;
      if (data.vendorId !== undefined) updateData.vendor_id = data.vendorId;
      if (data.parentAssetId !== undefined) updateData.parent_asset_id = data.parentAssetId;
      if (data.categoryId !== undefined) updateData.category_id = data.categoryId;
      if (data.customFields !== undefined) updateData.custom_fields = JSON.stringify(data.customFields);
      if (data.purchaseDate !== undefined) updateData.purchase_date = data.purchaseDate;
      if (data.purchaseCost !== undefined) updateData.purchase_cost = data.purchaseCost;
      if (data.salvageValue !== undefined) updateData.salvage_value = data.salvageValue;
      if (data.usefulLifeMonths !== undefined) updateData.useful_life_months = data.usefulLifeMonths;
      if (data.depreciationMethod !== undefined) {
        updateData.depreciation_method = data.depreciationMethod;
      }
      if (data.warrantyEndDate !== undefined) updateData.warranty_end_date = data.warrantyEndDate;
      if (data.expectedReturnDate !== undefined) {
        updateData.expected_return_date = data.expectedReturnDate;
      }

      await sqlService.myDb('asset').where({ id }).update(updateData);
    } catch (error) {
      rethrowAssetDbError(error, 'update');
    }
  },

  async updateImageFilename(id: string, filename: string | null): Promise<void> {
    try {
      await sqlService.myDb('asset').where({ id }).update({
        image_filename: filename,
        date_updated: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(__filename, 'updateImageFilename', 'error', error);
      throw Boom.badImplementation(assetDbErrors.internalError.message, {
        code: assetDbErrors.internalError.code,
      });
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await sqlService.myDb('asset').where({ id }).del();
    } catch (error) {
      logger.error(__filename, 'delete', 'error', error);
      throw Boom.badImplementation(assetDbErrors.internalError.message, {
        code: assetDbErrors.internalError.code,
      });
    }
  },
};

export default assetDbRepository;
