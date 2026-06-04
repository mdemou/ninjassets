import {
  IAsset,
  IAssetChildSummary,
  IAssetStatus,
  IAssetWithAssignee,
  IDepreciationMethod,
} from '@domain/_interfaces/asset.interface';
import { computeDepreciation } from '@domain/assets/depreciation.util';
import { IAssetDB, IAssigneeListAssetDB, IAssetWithAssigneeDB } from './assetDb.interface';

function toNum(value: string | number | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** Normalizes Postgres `date` values (string or Date from node-pg) to `YYYY-MM-DD`. */
function purchaseDateToIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const text = String(value);
  if (text.includes('T')) return text.split('T')[0] ?? text;
  return text;
}

export function adaptAsset(row: IAssetDB): IAsset {
  return {
    id: row.id,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
    name: row.name,
    model: row.model,
    serialNumber: row.serial_number,
    status: row.status as IAssetStatus,
    assignedUserId: row.assigned_user_id,
    siteId: row.site_id,
    latitude: toNum(row.latitude),
    longitude: toNum(row.longitude),
    imageFilename: row.image_filename,
    note: row.note,
    manufacturerId: row.manufacturer_id,
    vendorId: row.vendor_id,
    parentAssetId: row.parent_asset_id,
    categoryId: row.category_id,
    customFields: row.custom_fields ?? {},
    purchaseDate: purchaseDateToIso(row.purchase_date),
    purchaseCost: toNum(row.purchase_cost),
    salvageValue: toNum(row.salvage_value),
    usefulLifeMonths: row.useful_life_months,
    depreciationMethod: row.depreciation_method as IDepreciationMethod | null,
    warrantyEndDate: purchaseDateToIso(row.warranty_end_date),
    expectedReturnDate: purchaseDateToIso(row.expected_return_date),
  };
}

/** Maps the slim assignee-list query; only fields used by the me API mapper are populated. */
export function adaptAssigneeListAsset(row: IAssigneeListAssetDB): IAssetWithAssignee {
  return {
    id: row.id,
    dateCreated: '',
    dateUpdated: '',
    name: row.name,
    model: row.model,
    serialNumber: row.serial_number,
    status: row.status as IAssetStatus,
    assignedUserId: null,
    siteId: row.site_id,
    latitude: toNum(row.latitude),
    longitude: toNum(row.longitude),
    imageFilename: null,
    note: null,
    manufacturerId: row.manufacturer_id,
    vendorId: null,
    parentAssetId: null,
    categoryId: null,
    customFields: {},
    purchaseDate: null,
    purchaseCost: null,
    salvageValue: null,
    usefulLifeMonths: null,
    depreciationMethod: null,
    warrantyEndDate: null,
    expectedReturnDate: null,
    categoryName: null,
    assignedUserName: null,
    assignedUserEmail: null,
    assignedUserAvatarFilename: null,
    siteName: row.site_name,
    effectiveLatitude: toNum(row.effective_latitude),
    effectiveLongitude: toNum(row.effective_longitude),
    manufacturerName: row.manufacturer_name,
    manufacturerImageFilename: row.manufacturer_image_filename,
    assignedAt: row.assigned_at,
    vendorName: null,
    parentAssetName: null,
    childCount: 0,
    monthlyDepreciation: null,
    accumulatedDepreciation: null,
    bookValue: null,
  };
}

export function adaptAssetWithAssignee(
  row: IAssetWithAssigneeDB,
  children?: IAssetChildSummary[],
): IAssetWithAssignee {
  const base = adaptAsset(row);
  const computed = computeDepreciation({
    purchaseCost: base.purchaseCost,
    purchaseDate: base.purchaseDate,
    salvageValue: base.salvageValue,
    usefulLifeMonths: base.usefulLifeMonths,
    depreciationMethod: base.depreciationMethod,
  });

  return {
    ...base,
    assignedUserName: row.assigned_user_name,
    assignedUserEmail: row.assigned_user_email,
    assignedUserAvatarFilename: row.assigned_user_avatar_filename,
    siteName: row.site_name,
    effectiveLatitude: toNum(row.effective_latitude),
    effectiveLongitude: toNum(row.effective_longitude),
    manufacturerName: row.manufacturer_name,
    manufacturerImageFilename: row.manufacturer_image_filename,
    assignedAt: row.assigned_at,
    vendorName: row.vendor_name,
    parentAssetName: row.parent_asset_name,
    categoryName: row.category_name,
    childCount: Number(row.child_count ?? 0),
    children,
    monthlyDepreciation: computed.monthlyDepreciation,
    accumulatedDepreciation: computed.accumulatedDepreciation,
    bookValue: computed.bookValue,
  };
}
