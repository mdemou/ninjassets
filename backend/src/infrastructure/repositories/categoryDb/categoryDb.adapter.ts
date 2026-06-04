import {
  ICategory,
  ICategoryField,
  ICategoryFieldType,
  ICategoryListItem,
  ICategoryWithFields,
} from '@domain/_interfaces/category.interface';
import { ICategoryDB, ICategoryFieldDB, ICategoryListItemDB } from './categoryDb.interface';

export function adaptCategory(row: ICategoryDB): ICategory {
  return {
    id: row.id,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
    name: row.name,
    icon: row.icon,
    description: row.description,
  };
}

export function adaptCategoryField(row: ICategoryFieldDB): ICategoryField {
  return {
    id: row.id,
    categoryId: row.category_id,
    fieldKey: row.field_key,
    label: row.label,
    dataType: row.data_type as ICategoryFieldType,
    required: row.required,
    options: row.options ?? null,
    helpText: row.help_text,
    placeholder: row.placeholder,
    unit: row.unit,
    sortOrder: row.sort_order,
  };
}

export function adaptCategoryWithFields(
  row: ICategoryDB,
  fieldRows: ICategoryFieldDB[],
): ICategoryWithFields {
  return {
    ...adaptCategory(row),
    fields: fieldRows.map(adaptCategoryField),
  };
}

export function adaptCategoryListItem(row: ICategoryListItemDB): ICategoryListItem {
  return {
    ...adaptCategory(row),
    assetCount: Number(row.asset_count),
    fieldCount: Number(row.field_count),
  };
}
