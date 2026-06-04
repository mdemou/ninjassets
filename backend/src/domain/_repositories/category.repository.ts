import {
  ICategory,
  ICategoryFieldPersist,
  ICategoryListItem,
  ICategoryWithFields,
} from '@domain/_interfaces/category.interface';

export interface CategoryRepository {
  list(params: { search?: string; page?: number }): Promise<{
    categories: ICategoryListItem[];
    total: number;
  }>;
  findById(id: string): Promise<ICategoryWithFields | null>;
  findByNameNormalized(name: string): Promise<ICategory | null>;
  create(data: { name: string; icon: string | null; description: string | null }): Promise<ICategory>;
  update(
    id: string,
    data: { name?: string; icon?: string | null; description?: string | null },
  ): Promise<void>;
  /** Replaces the full field schema for a category (delete-all then insert). */
  replaceFields(categoryId: string, fields: ICategoryFieldPersist[]): Promise<void>;
  countAssets(id: string): Promise<number>;
  delete(id: string): Promise<void>;
}
