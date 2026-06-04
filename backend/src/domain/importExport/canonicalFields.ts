import { IImportEntityType } from '@domain/_interfaces/importExport.interface';

/**
 * Canonical column catalog per entity (SPEC-IMPORT-001 §8.5). Drives import
 * templates, the mapping UI's target-field list, and export column order. The
 * `id` column round-trips the UUID upsert key (D-IMPORT-1); export always emits it.
 */
export interface CanonicalField {
  key: string;
  /** Required to CREATE a row (ignored on update — fields are patched). */
  requiredOnCreate: boolean;
  hint: string;
}

const ASSET_FIELDS: CanonicalField[] = [
  { key: 'id', requiredOnCreate: false, hint: 'UUID. Leave blank to create; set to update.' },
  { key: 'name', requiredOnCreate: true, hint: 'Asset name' },
  { key: 'model', requiredOnCreate: false, hint: 'Model' },
  { key: 'serial_number', requiredOnCreate: true, hint: 'Unique serial number' },
  { key: 'status', requiredOnCreate: false, hint: 'STOCK | ASSIGNED | MAINTENANCE | ARCHIVED (default STOCK)' },
  { key: 'assignee_email', requiredOnCreate: false, hint: 'Required when status=ASSIGNED; must be an ACTIVE user' },
  { key: 'assigned_user_id', requiredOnCreate: false, hint: 'UUID alternative to assignee_email' },
  { key: 'site_name', requiredOnCreate: false, hint: 'Resolved to a site; auto-created when enabled' },
  { key: 'manufacturer_name', requiredOnCreate: false, hint: 'Auto-created when enabled' },
  { key: 'vendor_name', requiredOnCreate: false, hint: 'Auto-created when enabled' },
  { key: 'category_name', requiredOnCreate: false, hint: 'Existing category name' },
  { key: 'custom_fields', requiredOnCreate: false, hint: 'JSON object of custom field values' },
  { key: 'warranty_end_date', requiredOnCreate: false, hint: 'ISO date (YYYY-MM-DD)' },
  { key: 'expected_return_date', requiredOnCreate: false, hint: 'ISO date (YYYY-MM-DD)' },
  { key: 'note', requiredOnCreate: false, hint: 'Free text' },
  { key: 'purchase_date', requiredOnCreate: false, hint: 'ISO date' },
  { key: 'purchase_cost', requiredOnCreate: false, hint: 'Number' },
  { key: 'salvage_value', requiredOnCreate: false, hint: 'Number, ≤ purchase_cost' },
  { key: 'useful_life_months', requiredOnCreate: false, hint: 'Positive integer' },
  { key: 'depreciation_method', requiredOnCreate: false, hint: 'STRAIGHT_LINE' },
  { key: 'latitude', requiredOnCreate: false, hint: 'Override site latitude' },
  { key: 'longitude', requiredOnCreate: false, hint: 'Override site longitude' },
];

const SITE_FIELDS: CanonicalField[] = [
  { key: 'id', requiredOnCreate: false, hint: 'UUID. Leave blank to create; set to update.' },
  { key: 'name', requiredOnCreate: true, hint: 'Site name' },
  { key: 'description', requiredOnCreate: false, hint: 'Description' },
  { key: 'address', requiredOnCreate: false, hint: 'Address' },
  { key: 'latitude', requiredOnCreate: true, hint: 'Decimal latitude' },
  { key: 'longitude', requiredOnCreate: true, hint: 'Decimal longitude' },
];

const USER_FIELDS: CanonicalField[] = [
  { key: 'id', requiredOnCreate: false, hint: 'UUID. Leave blank to create; set to update.' },
  { key: 'email', requiredOnCreate: true, hint: 'Unique email' },
  { key: 'display_name', requiredOnCreate: true, hint: 'Display name' },
  { key: 'role', requiredOnCreate: false, hint: 'USER | ADMIN (ADMIN needs allowAdminPromotion)' },
  { key: 'status', requiredOnCreate: false, hint: 'ACTIVE | INACTIVE (new users start INACTIVE)' },
];

const MANUFACTURER_FIELDS: CanonicalField[] = [
  { key: 'id', requiredOnCreate: false, hint: 'UUID. Leave blank to create; set to update.' },
  { key: 'name', requiredOnCreate: true, hint: 'Manufacturer name' },
];

const VENDOR_FIELDS: CanonicalField[] = [
  { key: 'id', requiredOnCreate: false, hint: 'UUID. Leave blank to create; set to update.' },
  { key: 'name', requiredOnCreate: true, hint: 'Vendor name' },
];

const CATALOG: Record<IImportEntityType, CanonicalField[]> = {
  [IImportEntityType.ASSET]: ASSET_FIELDS,
  [IImportEntityType.SITE]: SITE_FIELDS,
  [IImportEntityType.USER]: USER_FIELDS,
  [IImportEntityType.MANUFACTURER]: MANUFACTURER_FIELDS,
  [IImportEntityType.VENDOR]: VENDOR_FIELDS,
};

export function canonicalFieldsFor(entityType: IImportEntityType): CanonicalField[] {
  return CATALOG[entityType];
}

export function canonicalKeysFor(entityType: IImportEntityType): string[] {
  return CATALOG[entityType].map((f) => f.key);
}
