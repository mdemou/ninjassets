import { IAssetWithAssignee } from '@domain/_interfaces/asset.interface';
import {
  IExportFilter,
  IImportEntityType,
} from '@domain/_interfaces/importExport.interface';
import { ISiteWithAssetCount } from '@domain/_interfaces/site.interface';
import { IUserWithRole } from '@domain/_interfaces/users.interface';
import type { AssetRepository } from '@domain/_repositories/asset.repository';
import type { ManufacturerRepository } from '@domain/_repositories/manufacturer.repository';
import type { SiteRepository } from '@domain/_repositories/site.repository';
import type { UserRepository } from '@domain/_repositories/user.repository';
import type { VendorRepository } from '@domain/_repositories/vendor.repository';
import type { ExportRow } from '@services/importExport/fileWriter.service';
import { canonicalKeysFor } from './canonicalFields';

export interface ExportRepos {
  asset: AssetRepository;
  site: SiteRepository;
  manufacturer: ManufacturerRepository;
  vendor: VendorRepository;
  user: UserRepository;
}

export interface ExportResult {
  headers: string[];
  rows: ExportRow[];
}

function assetRow(a: IAssetWithAssignee): ExportRow {
  return {
    id: a.id,
    name: a.name,
    model: a.model,
    serial_number: a.serialNumber,
    status: a.status,
    assignee_email: a.assignedUserEmail,
    assigned_user_id: a.assignedUserId,
    site_name: a.siteName,
    manufacturer_name: a.manufacturerName,
    vendor_name: a.vendorName,
    category_name: a.categoryName,
    custom_fields: a.customFields && Object.keys(a.customFields).length > 0 ? JSON.stringify(a.customFields) : '',
    warranty_end_date: a.warrantyEndDate,
    expected_return_date: a.expectedReturnDate,
    note: a.note,
    purchase_date: a.purchaseDate,
    purchase_cost: a.purchaseCost,
    salvage_value: a.salvageValue,
    useful_life_months: a.usefulLifeMonths,
    depreciation_method: a.depreciationMethod,
    latitude: a.latitude,
    longitude: a.longitude,
  };
}

async function exportAssets(repos: ExportRepos, filter: IExportFilter | null): Promise<ExportRow[]> {
  const rows: ExportRow[] = [];
  let page = 1;
  // Paginate the admin list query until every matching asset is collected.
  for (;;) {
    const { assets, total } = await repos.asset.list({
      page,
      search: filter?.search,
      siteId: filter?.siteId,
      status: filter?.status as IAssetWithAssignee['status'] | undefined,
      manufacturerId: filter?.manufacturerId,
      vendorId: filter?.vendorId,
      categoryId: filter?.categoryId,
    });
    rows.push(...assets.map(assetRow));
    if (rows.length >= total || assets.length === 0) break;
    page += 1;
  }
  return rows;
}

function siteToExportRow(s: ISiteWithAssetCount): ExportRow {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
  };
}

function userToExportRow(u: IUserWithRole): ExportRow {
  return {
    id: u.id,
    email: u.email,
    display_name: u.displayName,
    role: u.roleName,
    status: u.status,
  };
}

async function exportSites(repos: ExportRepos, filter: IExportFilter | null): Promise<ExportRow[]> {
  const { sites } = await repos.site.list({ search: filter?.search });
  return sites.map(siteToExportRow);
}

async function exportUsers(repos: ExportRepos, filter: IExportFilter | null): Promise<ExportRow[]> {
  const { users } = await repos.user.searchAndCount({ search: filter?.search });
  return users
    .filter((u) => (filter?.role ? u.roleName === filter.role : true))
    .filter((u) => (filter?.userStatus == null || u.status === filter.userStatus))
    .map(userToExportRow);
}

async function exportManufacturers(repos: ExportRepos, filter: IExportFilter | null): Promise<ExportRow[]> {
  const { manufacturers } = await repos.manufacturer.list({ search: filter?.search });
  return manufacturers.map((m) => ({ id: m.id, name: m.name }));
}

async function exportVendors(repos: ExportRepos, filter: IExportFilter | null): Promise<ExportRow[]> {
  const { vendors } = await repos.vendor.list({ search: filter?.search });
  return vendors.map((v) => ({ id: v.id, name: v.name }));
}

export async function exportEntity(
  entityType: IImportEntityType,
  repos: ExportRepos,
  filter: IExportFilter | null,
): Promise<ExportResult> {
  const headers = canonicalKeysFor(entityType);
  let rows: ExportRow[];
  switch (entityType) {
    case IImportEntityType.ASSET:
      rows = await exportAssets(repos, filter);
      break;
    case IImportEntityType.SITE:
      rows = await exportSites(repos, filter);
      break;
    case IImportEntityType.USER:
      rows = await exportUsers(repos, filter);
      break;
    case IImportEntityType.MANUFACTURER:
      rows = await exportManufacturers(repos, filter);
      break;
    case IImportEntityType.VENDOR:
      rows = await exportVendors(repos, filter);
      break;
    default:
      rows = [];
  }
  return { headers, rows };
}
