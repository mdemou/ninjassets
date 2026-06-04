export interface ICategoryDB {
  id: string;
  date_created: string;
  date_updated: string;
  name: string;
  icon: string | null;
  description: string | null;
}

export interface ICategoryListItemDB extends ICategoryDB {
  asset_count: string;
  field_count: string;
}

export interface ICategoryFieldDB {
  id: string;
  date_created: string;
  date_updated: string;
  category_id: string;
  field_key: string;
  label: string;
  data_type: string;
  required: boolean;
  options: string[] | null;
  help_text: string | null;
  placeholder: string | null;
  unit: string | null;
  sort_order: number;
}
