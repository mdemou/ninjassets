import {
  ICategory,
  ICategoryFieldPersist,
  ICategoryListItem,
  ICategoryWithFields,
} from '@domain/_interfaces/category.interface';
import { CategoryRepository } from '@domain/_repositories/category.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import { Knex } from 'knex';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import {
  adaptCategory,
  adaptCategoryListItem,
  adaptCategoryWithFields,
} from './categoryDb.adapter';
import categoryDbErrors from './categoryDb.errors';
import { ICategoryDB, ICategoryFieldDB, ICategoryListItemDB } from './categoryDb.interface';

const ASSET_COUNT_SUBQUERY =
  '(SELECT COUNT(*) FROM asset WHERE asset.category_id = category.id) as asset_count';
const FIELD_COUNT_SUBQUERY =
  '(SELECT COUNT(*) FROM category_field WHERE category_field.category_id = category.id) as field_count';

function internalError(): never {
  throw Boom.badImplementation(categoryDbErrors.internalError.message, {
    code: categoryDbErrors.internalError.code,
  });
}

const categoryDbRepository: CategoryRepository = {
  async list({ search, page }): Promise<{ categories: ICategoryListItem[]; total: number }> {
    try {
      const applyFilters = (qb: Knex.QueryBuilder): Knex.QueryBuilder => {
        if (search) {
          qb.whereILike('category.name', `%${search}%`);
        }
        return qb;
      };

      const countRow = await applyFilters(sqlService.myDb('category'))
        .count({ count: 'category.id' })
        .first();
      const total = Number((countRow as { count: string } | undefined)?.count ?? 0);

      const query = applyFilters(sqlService.myDb('category'))
        .select('category.*')
        .select(sqlService.myDb.raw(ASSET_COUNT_SUBQUERY))
        .select(sqlService.myDb.raw(FIELD_COUNT_SUBQUERY))
        .orderBy('category.name', 'asc');

      if (page !== undefined) {
        const pageSize = config.pagination.pageSize;
        query.limit(pageSize).offset((page - 1) * pageSize);
      }

      const rows: ICategoryListItemDB[] = await query;
      return { categories: rows.map(adaptCategoryListItem), total };
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      internalError();
    }
  },

  async findById(id: string): Promise<ICategoryWithFields | null> {
    try {
      const row: ICategoryDB | undefined = await sqlService
        .myDb('category')
        .where('id', id)
        .first();
      if (!row) return null;

      const fields: ICategoryFieldDB[] = await sqlService
        .myDb('category_field')
        .where('category_id', id)
        .orderBy('sort_order', 'asc');

      return adaptCategoryWithFields(row, fields);
    } catch (error) {
      logger.error(__filename, 'findById', 'error', error);
      internalError();
    }
  },

  async findByNameNormalized(name: string): Promise<ICategory | null> {
    try {
      const row: ICategoryDB | undefined = await sqlService
        .myDb('category')
        .whereRaw('LOWER(TRIM(name)) = ?', [name.trim().toLowerCase()])
        .first();
      return row ? adaptCategory(row) : null;
    } catch (error) {
      logger.error(__filename, 'findByNameNormalized', 'error', error);
      internalError();
    }
  },

  async create(data): Promise<ICategory> {
    try {
      const [row]: ICategoryDB[] = await sqlService
        .myDb('category')
        .insert({ name: data.name, icon: data.icon, description: data.description })
        .returning('*');
      if (!row) internalError();
      return adaptCategory(row);
    } catch (error) {
      logger.error(__filename, 'create', 'error', error);
      internalError();
    }
  },

  async update(id, data): Promise<void> {
    try {
      const updateData: Record<string, string | null> = {
        date_updated: new Date().toISOString(),
      };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.icon !== undefined) updateData.icon = data.icon;
      if (data.description !== undefined) updateData.description = data.description;
      await sqlService.myDb('category').where({ id }).update(updateData);
    } catch (error) {
      logger.error(__filename, 'update', 'error', error);
      internalError();
    }
  },

  async replaceFields(categoryId: string, fields: ICategoryFieldPersist[]): Promise<void> {
    try {
      await sqlService.myDb.transaction(async (trx) => {
        await trx('category_field').where('category_id', categoryId).del();
        if (fields.length > 0) {
          await trx('category_field').insert(
            fields.map((f) => ({
              category_id: categoryId,
              field_key: f.fieldKey,
              label: f.label,
              data_type: f.dataType,
              required: f.required,
              options: f.options ? JSON.stringify(f.options) : null,
              help_text: f.helpText,
              placeholder: f.placeholder,
              unit: f.unit,
              sort_order: f.sortOrder,
            })),
          );
        }
        await trx('category').where('id', categoryId).update({ date_updated: new Date().toISOString() });
      });
    } catch (error) {
      logger.error(__filename, 'replaceFields', 'error', error);
      internalError();
    }
  },

  async countAssets(id: string): Promise<number> {
    try {
      const result = await sqlService
        .myDb('asset')
        .where({ category_id: id })
        .count('* as count')
        .first();
      return Number((result as { count: string } | undefined)?.count ?? 0);
    } catch (error) {
      logger.error(__filename, 'countAssets', 'error', error);
      internalError();
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await sqlService.myDb('category').where({ id }).del();
    } catch (error) {
      logger.error(__filename, 'delete', 'error', error);
      internalError();
    }
  },
};

export default categoryDbRepository;
