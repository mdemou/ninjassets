import { IAssetStatus, ICreateAsset, IDepreciationMethod, IUpdateAsset } from '@domain/_interfaces/asset.interface';
import {
  IImportEntityType,
  IImportOptions,
  IRowMessage,
} from '@domain/_interfaces/importExport.interface';
import { IUserRole, IUserStatus } from '@domain/_interfaces/users.interface';
import type { AssetRepository } from '@domain/_repositories/asset.repository';
import type { CategoryRepository } from '@domain/_repositories/category.repository';
import type { HandoverRepository } from '@domain/_repositories/handover.repository';
import type { ManufacturerRepository } from '@domain/_repositories/manufacturer.repository';
import type { SiteRepository } from '@domain/_repositories/site.repository';
import type { UserRepository } from '@domain/_repositories/user.repository';
import type { VendorRepository } from '@domain/_repositories/vendor.repository';
import { validateCustomFields } from '@domain/categories/categoryFields.util';

export interface Requester {
  id: string;
  role: string;
}

/** Entity domains the importer commits through (reusing all invariants). */
export interface EntityDomains {
  asset: {
    createAsset(actor: Requester, payload: ICreateAsset): Promise<{ id: string }>;
    updateAsset(actor: Requester, id: string, payload: IUpdateAsset, options?: { force?: boolean }): Promise<{ id: string }>;
  };
  site: { createSite(payload: { name: string; description?: string | null; address?: string | null; latitude: number; longitude: number }): Promise<{ id: string }> };
  manufacturer: { createManufacturer(payload: { name: string }): Promise<{ id: string }> };
  vendor: { createVendor(payload: { name: string }): Promise<{ id: string }> };
  user: {
    createUser(payload: { email: string; displayName: string; roleName: IUserRole }): Promise<void>;
    updateUser(id: string, payload: { displayName?: string; roleName?: IUserRole; status?: IUserStatus }): Promise<void>;
  };
}

export interface ImportContext {
  options: IImportOptions;
  actor: Requester;
  domains: EntityDomains;
  repos: {
    asset: AssetRepository;
    site: SiteRepository;
    manufacturer: ManufacturerRepository;
    vendor: VendorRepository;
    user: UserRepository;
    category: CategoryRepository;
    handover?: HandoverRepository;
  };
}

export type CanonicalRow = Record<string, string | null>;

export interface ValidationResult {
  messages: IRowMessage[];
  mode: 'create' | 'update';
}

export interface ApplyResult {
  action: 'created' | 'updated';
  targetEntityId: string;
}

export interface EntityImporter {
  validate(row: CanonicalRow, ctx: ImportContext): Promise<ValidationResult>;
  apply(row: CanonicalRow, ctx: ImportContext): Promise<ApplyResult>;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function err(field: string | null, message: string, code = 'ROW_INVALID'): IRowMessage {
  return { code, field, message };
}

function str(row: CanonicalRow, key: string): string | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

function parseNumber(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowMode(row: CanonicalRow): 'create' | 'update' {
  return str(row, 'id') ? 'update' : 'create';
}

// ---------------------------------------------------------------------------
// Catalog (manufacturer / vendor) — identical shape
// ---------------------------------------------------------------------------

function nameImporter(
  find: (ctx: ImportContext, id: string) => Promise<{ id: string } | null>,
  create: (ctx: ImportContext, name: string) => Promise<{ id: string }>,
): EntityImporter {
  return {
    async validate(row, ctx) {
      const messages: IRowMessage[] = [];
      const id = str(row, 'id');
      const mode = rowMode(row);
      const name = str(row, 'name');
      if (id && !isUuid(id)) messages.push(err('id', 'id is not a valid UUID'));
      else if (id && !(await find(ctx, id))) messages.push(err('id', 'No row matches that id'));
      if (mode === 'create' && !name) messages.push(err('name', 'name is required'));
      return { messages, mode };
    },
    async apply(row, ctx) {
      const id = str(row, 'id');
      const name = str(row, 'name');
      if (id) {
        // Catalog entities expose no rename via import in v1 beyond name; treat as no-op update.
        return { action: 'updated', targetEntityId: id };
      }
      const created = await create(ctx, name as string);
      return { action: 'created', targetEntityId: created.id };
    },
  };
}

// ---------------------------------------------------------------------------
// Reference resolution shared by asset import
// ---------------------------------------------------------------------------

async function findSiteByName(ctx: ImportContext, name: string): Promise<string | null> {
  const { sites } = await ctx.repos.site.list({ search: name });
  const match = sites.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
  return match ? match.id : null;
}

async function resolveAssetRefs(
  row: CanonicalRow,
  ctx: ImportContext,
  create: boolean,
): Promise<{ messages: IRowMessage[]; refs: Partial<ICreateAsset> }> {
  const messages: IRowMessage[] = [];
  const refs: Partial<ICreateAsset> = {};

  const siteName = str(row, 'site_name');
  if (siteName) {
    const existing = await findSiteByName(ctx, siteName);
    if (existing) {
      refs.siteId = existing;
    } else if (ctx.options.createMissingSites) {
      if (create) {
        // Inline auto-create: a name-only site defaults to 0/0 coordinates the
        // admin can correct later (SPEC-IMPORT-001 §7.3).
        const site = await ctx.domains.site.createSite({ name: siteName, latitude: 0, longitude: 0 });
        refs.siteId = site.id;
      }
    } else {
      messages.push(err('site_name', `Unknown site "${siteName}" and auto-create is off`));
    }
  }

  const manName = str(row, 'manufacturer_name');
  if (manName) {
    const found = await ctx.repos.manufacturer.findByNameNormalized(manName);
    if (found) refs.manufacturerId = found.id;
    else if (ctx.options.createMissingCatalog) {
      if (create) refs.manufacturerId = (await ctx.domains.manufacturer.createManufacturer({ name: manName })).id;
    } else messages.push(err('manufacturer_name', `Unknown manufacturer "${manName}" and auto-create is off`));
  }

  const venName = str(row, 'vendor_name');
  if (venName) {
    const found = await ctx.repos.vendor.findByNameNormalized(venName);
    if (found) refs.vendorId = found.id;
    else if (ctx.options.createMissingCatalog) {
      if (create) refs.vendorId = (await ctx.domains.vendor.createVendor({ name: venName })).id;
    } else messages.push(err('vendor_name', `Unknown vendor "${venName}" and auto-create is off`));
  }

  const catName = str(row, 'category_name');
  if (catName) {
    const found = await ctx.repos.category.findByNameNormalized(catName);
    if (found) refs.categoryId = found.id;
    else messages.push(err('category_name', `Unknown category "${catName}"`));
  }

  // Assignee: email or UUID; must resolve to an ACTIVE user (never auto-created).
  const email = str(row, 'assignee_email');
  const userId = str(row, 'assigned_user_id');
  if (email) {
    const user = await ctx.repos.user.findByEmail(email);
    if (!user) messages.push(err('assignee_email', `No user with email "${email}"`));
    else if (user.status !== IUserStatus.ACTIVE) messages.push(err('assignee_email', 'Assignee is not ACTIVE'));
    else refs.assignedUserId = user.id;
  } else if (userId) {
    if (!isUuid(userId)) messages.push(err('assigned_user_id', 'assigned_user_id is not a valid UUID'));
    else {
      const user = await ctx.repos.user.findById(userId);
      if (!user) messages.push(err('assigned_user_id', 'No user with that id'));
      else if (user.status !== IUserStatus.ACTIVE) messages.push(err('assigned_user_id', 'Assignee is not ACTIVE'));
      else refs.assignedUserId = user.id;
    }
  }

  return { messages, refs };
}

function parseAssetScalars(row: CanonicalRow, messages: IRowMessage[]): Partial<ICreateAsset> {
  const out: Partial<ICreateAsset> = {};
  const name = str(row, 'name');
  if (name) out.name = name;
  const model = str(row, 'model');
  if (model) out.model = model;
  const serial = str(row, 'serial_number');
  if (serial) out.serialNumber = serial;
  const note = str(row, 'note');
  if (note) out.note = note;

  const status = str(row, 'status');
  if (status) {
    if (!(Object.values(IAssetStatus) as string[]).includes(status)) {
      messages.push(err('status', `Invalid status "${status}"`));
    } else {
      out.status = status as IAssetStatus;
    }
  }

  for (const [key, field] of [
    ['warranty_end_date', 'warrantyEndDate'],
    ['expected_return_date', 'expectedReturnDate'],
    ['purchase_date', 'purchaseDate'],
  ] as const) {
    const v = str(row, key);
    if (v) {
      if (!ISO_DATE_RE.test(v)) messages.push(err(key, 'Expected ISO date YYYY-MM-DD'));
      else (out as Record<string, unknown>)[field] = v;
    }
  }

  for (const [key, field] of [
    ['purchase_cost', 'purchaseCost'],
    ['salvage_value', 'salvageValue'],
    ['useful_life_months', 'usefulLifeMonths'],
    ['latitude', 'latitude'],
    ['longitude', 'longitude'],
  ] as const) {
    const v = str(row, key);
    if (v) {
      const n = parseNumber(v);
      if (n === null) messages.push(err(key, 'Expected a number'));
      else (out as Record<string, unknown>)[field] = n;
    }
  }

  const dep = str(row, 'depreciation_method');
  if (dep) {
    if (!(Object.values(IDepreciationMethod) as string[]).includes(dep)) {
      messages.push(err('depreciation_method', `Invalid depreciation_method "${dep}"`));
    } else {
      out.depreciationMethod = dep as IDepreciationMethod;
    }
  }

  const cf = str(row, 'custom_fields');
  if (cf) {
    try {
      const parsed = JSON.parse(cf);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        out.customFields = parsed as Record<string, unknown>;
      } else {
        messages.push(err('custom_fields', 'custom_fields must be a JSON object'));
      }
    } catch {
      messages.push(err('custom_fields', 'custom_fields is not valid JSON'));
    }
  }

  return out;
}

const assetImporter: EntityImporter = {
  async validate(row, ctx) {
    const messages: IRowMessage[] = [];
    const id = str(row, 'id');
    const mode = rowMode(row);

    if (id && !isUuid(id)) messages.push(err('id', 'id is not a valid UUID'));
    const existing = id && isUuid(id) ? await ctx.repos.asset.findById(id) : null;
    if (id && isUuid(id) && !existing) messages.push(err('id', 'No asset matches that id'));

    const scalars = parseAssetScalars(row, messages);

    if (mode === 'create') {
      if (!scalars.name) messages.push(err('name', 'name is required'));
      if (!scalars.serialNumber) messages.push(err('serial_number', 'serial_number is required'));
      else {
        const dup = await ctx.repos.asset.findBySerialNumber(scalars.serialNumber);
        if (dup) messages.push(err('serial_number', 'serial_number already exists'));
      }
    } else if (scalars.serialNumber && existing && scalars.serialNumber !== existing.serialNumber) {
      const dup = await ctx.repos.asset.findBySerialNumber(scalars.serialNumber);
      if (dup && dup.id !== existing.id) messages.push(err('serial_number', 'serial_number already exists'));
    }

    const { messages: refMsgs, refs } = await resolveAssetRefs(row, ctx, false);
    messages.push(...refMsgs);

    // Effective status drives the assignment rule.
    const effectiveStatus = scalars.status ?? (existing ? existing.status : IAssetStatus.STOCK);
    if (effectiveStatus === IAssetStatus.ASSIGNED) {
      const willHaveAssignee = refs.assignedUserId ?? existing?.assignedUserId ?? null;
      if (!willHaveAssignee && !refMsgs.some((m) => m.field?.startsWith('assign'))) {
        messages.push(err('assignee_email', 'status=ASSIGNED requires an assignee'));
      }
    }

    // Custom fields validated against the resolved (or existing) category.
    if (scalars.customFields !== undefined) {
      const categoryId = refs.categoryId ?? existing?.categoryId ?? null;
      try {
        const category = categoryId ? await ctx.repos.category.findById(categoryId) : null;
        validateCustomFields(category?.fields ?? null, scalars.customFields, { dropUnknown: false });
      } catch (e) {
        messages.push(err('custom_fields', (e as Error).message));
      }
    }

    // Open-handover block (policy A) on custody-changing updates unless force.
    if (mode === 'update' && existing && ctx.repos.handover && !ctx.options.force) {
      const changesStatus = scalars.status !== undefined && scalars.status !== existing.status;
      const changesAssignee = refs.assignedUserId !== undefined && refs.assignedUserId !== existing.assignedUserId;
      if (changesStatus || changesAssignee) {
        const open = await ctx.repos.handover.findOpenByAssetId(existing.id);
        if (open && new Date(open.expiresAt) > new Date()) {
          messages.push(err('status', 'Open handover blocks status/assignee change; set force to override'));
        }
      }
    }

    return { messages, mode };
  },

  async apply(row, ctx) {
    const messages: IRowMessage[] = [];
    const id = str(row, 'id');
    const mode = rowMode(row);
    const scalars = parseAssetScalars(row, messages);
    const { refs } = await resolveAssetRefs(row, ctx, true);

    const payload: ICreateAsset & IUpdateAsset = { ...scalars, ...refs } as ICreateAsset & IUpdateAsset;

    if (mode === 'create') {
      const created = await ctx.domains.asset.createAsset(ctx.actor, payload);
      return { action: 'created', targetEntityId: created.id };
    }
    const updated = await ctx.domains.asset.updateAsset(ctx.actor, id as string, payload, {
      force: ctx.options.force,
    });
    return { action: 'updated', targetEntityId: updated.id };
  },
};

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------

const siteImporter: EntityImporter = {
  async validate(row, ctx) {
    const messages: IRowMessage[] = [];
    const id = str(row, 'id');
    const mode = rowMode(row);
    if (id && !isUuid(id)) messages.push(err('id', 'id is not a valid UUID'));
    else if (id && !(await ctx.repos.site.findById(id))) messages.push(err('id', 'No site matches that id'));

    if (mode === 'create') {
      if (!str(row, 'name')) messages.push(err('name', 'name is required'));
      for (const key of ['latitude', 'longitude']) {
        const v = str(row, key);
        if (!v) messages.push(err(key, `${key} is required`));
        else if (parseNumber(v) === null) messages.push(err(key, 'Expected a number'));
      }
    } else {
      for (const key of ['latitude', 'longitude']) {
        const v = str(row, key);
        if (v && parseNumber(v) === null) messages.push(err(key, 'Expected a number'));
      }
    }
    return { messages, mode };
  },
  async apply(row, ctx) {
    const id = str(row, 'id');
    if (id) return { action: 'updated', targetEntityId: id };
    const site = await ctx.domains.site.createSite({
      name: str(row, 'name') as string,
      description: str(row, 'description'),
      address: str(row, 'address'),
      latitude: parseNumber(str(row, 'latitude') as string) as number,
      longitude: parseNumber(str(row, 'longitude') as string) as number,
    });
    return { action: 'created', targetEntityId: site.id };
  },
};

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

const userImporter: EntityImporter = {
  async validate(row, ctx) {
    const messages: IRowMessage[] = [];
    const id = str(row, 'id');
    const mode = rowMode(row);
    if (id && !isUuid(id)) messages.push(err('id', 'id is not a valid UUID'));
    else if (id && !(await ctx.repos.user.findById(id))) messages.push(err('id', 'No user matches that id'));

    const email = str(row, 'email');
    if (mode === 'create') {
      if (!email) messages.push(err('email', 'email is required'));
      else if (await ctx.repos.user.findByEmail(email)) messages.push(err('email', 'email already exists'));
      if (!str(row, 'display_name')) messages.push(err('display_name', 'display_name is required'));
    }

    const role = str(row, 'role');
    if (role) {
      if (!(Object.values(IUserRole) as string[]).includes(role)) {
        messages.push(err('role', `Invalid role "${role}"`));
      } else if ((role as IUserRole) === IUserRole.ADMIN && !ctx.options.allowAdminPromotion) {
        messages.push(err('role', 'role=ADMIN requires allowAdminPromotion'));
      }
    }
    const status = str(row, 'status');
    if (status && !(Object.values(IUserStatus) as string[]).includes(status)) {
      messages.push(err('status', `Invalid status "${status}"`));
    }
    return { messages, mode };
  },
  async apply(row, ctx) {
    const id = str(row, 'id');
    const role = str(row, 'role') as IUserRole | null;
    const status = str(row, 'status') as IUserStatus | null;
    if (id) {
      await ctx.domains.user.updateUser(id, {
        displayName: str(row, 'display_name') ?? undefined,
        roleName: role ?? undefined,
        status: status ?? undefined,
      });
      return { action: 'updated', targetEntityId: id };
    }
    // New users follow admin-create rules: INACTIVE + activation email.
    await ctx.domains.user.createUser({
      email: str(row, 'email') as string,
      displayName: str(row, 'display_name') as string,
      roleName: role ?? IUserRole.USER,
    });
    const created = await ctx.repos.user.findByEmail(str(row, 'email') as string);
    return { action: 'created', targetEntityId: created?.id ?? '' };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const manufacturerImporter = nameImporter(
  (ctx, id) => ctx.repos.manufacturer.findById(id),
  (ctx, name) => ctx.domains.manufacturer.createManufacturer({ name }),
);
const vendorImporter = nameImporter(
  (ctx, id) => ctx.repos.vendor.findById(id),
  (ctx, name) => ctx.domains.vendor.createVendor({ name }),
);

export const ENTITY_IMPORTERS: Record<IImportEntityType, EntityImporter> = {
  [IImportEntityType.ASSET]: assetImporter,
  [IImportEntityType.SITE]: siteImporter,
  [IImportEntityType.USER]: userImporter,
  [IImportEntityType.MANUFACTURER]: manufacturerImporter,
  [IImportEntityType.VENDOR]: vendorImporter,
};
