export enum ICategoryFieldType {
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  SELECT = 'SELECT',
  MULTI_SELECT = 'MULTI_SELECT',
}

export interface ICategoryField {
  id: string;
  categoryId: string;
  fieldKey: string;
  label: string;
  dataType: ICategoryFieldType;
  required: boolean;
  options: string[] | null;
  helpText: string | null;
  placeholder: string | null;
  unit: string | null;
  sortOrder: number;
}

export interface ICategory {
  id: string;
  dateCreated: string;
  dateUpdated: string;
  name: string;
  icon: string | null;
  description: string | null;
}

export interface ICategoryWithFields extends ICategory {
  fields: ICategoryField[];
}

export interface ICategoryListItem extends ICategory {
  assetCount: number;
  fieldCount: number;
}

/** Field as supplied by the client on create/update (no id; key is derived if absent). */
export interface ICategoryFieldInput {
  fieldKey?: string;
  label: string;
  dataType: ICategoryFieldType;
  required?: boolean;
  options?: string[] | null;
  helpText?: string | null;
  placeholder?: string | null;
  unit?: string | null;
  sortOrder?: number;
}

/** Normalized field ready to persist (key derived, order sequenced). */
export interface ICategoryFieldPersist {
  fieldKey: string;
  label: string;
  dataType: ICategoryFieldType;
  required: boolean;
  options: string[] | null;
  helpText: string | null;
  placeholder: string | null;
  unit: string | null;
  sortOrder: number;
}

export interface ICreateCategory {
  name: string;
  icon?: string | null;
  description?: string | null;
  fields?: ICategoryFieldInput[];
}

export interface IUpdateCategory {
  name?: string;
  icon?: string | null;
  description?: string | null;
  fields?: ICategoryFieldInput[];
}
