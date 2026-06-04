import config from '@config/config';
import {
  ICategoryListItem,
  ICategoryWithFields,
  ICreateCategory,
  IUpdateCategory,
} from '@domain/_interfaces/category.interface';
import { CategoryRepository } from '@domain/_repositories/category.repository';
import Boom from '@hapi/boom';
import categoryErrors from './categories.errors';
import { normalizeFieldInputs } from './categoryFields.util';

interface CategoryRepositories {
  categoryRepository: CategoryRepository;
}

function categoryDomainFactory(repositories: CategoryRepositories) {
  const { categoryRepository } = repositories;

  async function requireCategory(id: string): Promise<ICategoryWithFields> {
    const row = await categoryRepository.findById(id);
    if (!row) {
      throw Boom.notFound(categoryErrors.notFound.message, { code: categoryErrors.notFound.code });
    }
    return row;
  }

  async function assertNameAvailable(name: string, ignoreId?: string): Promise<void> {
    const existing = await categoryRepository.findByNameNormalized(name);
    if (existing && existing.id !== ignoreId) {
      throw Boom.conflict(categoryErrors.nameAlreadyExists.message, {
        code: categoryErrors.nameAlreadyExists.code,
      });
    }
  }

  return {
    async listCategories(params: { search?: string; page?: number }): Promise<{
      categories: ICategoryListItem[];
      total: number;
      page: number;
      pageSize: number | null;
    }> {
      const paginate = params.page !== undefined;
      const page = Math.max(1, params.page ?? 1);
      const { categories, total } = await categoryRepository.list({
        search: params.search?.trim() || undefined,
        page: paginate ? page : undefined,
      });
      return { categories, total, page, pageSize: paginate ? config.pagination.pageSize : null };
    },

    async getCategoryDetails(id: string): Promise<ICategoryWithFields> {
      return requireCategory(id);
    },

    async createCategory(payload: ICreateCategory): Promise<ICategoryWithFields> {
      const name = payload.name.trim();
      if (!name) {
        throw Boom.badRequest(categoryErrors.badRequest('name is required').message, {
          code: categoryErrors.badRequest('').code,
        });
      }
      await assertNameAvailable(name);
      const fields = normalizeFieldInputs(payload.fields ?? []);

      const created = await categoryRepository.create({
        name,
        icon: payload.icon?.trim() || null,
        description: payload.description?.trim() || null,
      });
      await categoryRepository.replaceFields(created.id, fields);

      return requireCategory(created.id);
    },

    async updateCategory(id: string, payload: IUpdateCategory): Promise<ICategoryWithFields> {
      await requireCategory(id);

      const data: { name?: string; icon?: string | null; description?: string | null } = {};
      if (payload.name !== undefined) {
        const name = payload.name.trim();
        if (!name) {
          throw Boom.badRequest(categoryErrors.badRequest('name is required').message, {
            code: categoryErrors.badRequest('').code,
          });
        }
        await assertNameAvailable(name, id);
        data.name = name;
      }
      if (payload.icon !== undefined) data.icon = payload.icon?.trim() || null;
      if (payload.description !== undefined) data.description = payload.description?.trim() || null;

      if (Object.keys(data).length > 0) {
        await categoryRepository.update(id, data);
      }
      if (payload.fields !== undefined) {
        await categoryRepository.replaceFields(id, normalizeFieldInputs(payload.fields));
      }

      return requireCategory(id);
    },

    async deleteCategory(id: string): Promise<void> {
      await requireCategory(id);
      const count = await categoryRepository.countAssets(id);
      if (count > 0) {
        const err = categoryErrors.inUse(count);
        throw Boom.conflict(err.message, { code: err.code });
      }
      await categoryRepository.delete(id);
    },
  };
}

export default categoryDomainFactory;
