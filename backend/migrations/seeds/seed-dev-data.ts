/**
 * Standalone dev seed script — for testing only.
 * Run with: npm run seed
 * Full demo reset (keeps users): npm run seed:demo
 * Rollback tracked catalog rows: npm run seed:rollback
 *
 * Lives in migrations/seeds/ so DB-related files stay together.
 * Knex does NOT read subfolders, so this never runs with npm run migrate.
 */

import knex from 'knex';
import path from 'path';

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const knexConfig = require('../../knexfile.cjs');

const TRACKING_TABLE = '_seed_dev_tracking';
const TARGET_COUNT = 50;
const DEMO_SITES = 25;
const DEMO_ASSETS = 300;
const DEMO_TRANSACTIONS = 200;

const MANUFACTURER_ADJECTIVES = [
  'Apex',
  'Atlas',
  'Bright',
  'Cobalt',
  'Core',
  'Delta',
  'Echo',
  'Fusion',
  'Global',
  'Horizon',
  'Iron',
  'Keystone',
  'Lunar',
  'Metro',
  'Nova',
  'Omni',
  'Prime',
  'Quantum',
  'Rapid',
  'Solid',
  'Summit',
  'Titan',
  'Ultra',
  'Vector',
  'Zenith',
];

const MANUFACTURER_NOUNS = [
  'Components',
  'Devices',
  'Dynamics',
  'Electronics',
  'Fabrication',
  'Hardware',
  'Industries',
  'Instruments',
  'Labs',
  'Machinery',
  'Manufacturing',
  'Microsystems',
  'Optics',
  'Robotics',
  'Semiconductor',
  'Solutions',
  'Systems',
  'Technologies',
  'Works',
  'Workshop',
];

const VENDOR_ADJECTIVES = [
  'Active',
  'Allied',
  'Blue',
  'Capital',
  'Central',
  'City',
  'Coastal',
  'Direct',
  'Eastern',
  'First',
  'Gateway',
  'Grand',
  'Harbor',
  'Metro',
  'National',
  'Northern',
  'Pacific',
  'Premier',
  'Royal',
  'Southern',
  'Sterling',
  'Summit',
  'United',
  'Valley',
  'Western',
];

const VENDOR_NOUNS = [
  'Computer',
  'Distribution',
  'Electronics',
  'Enterprises',
  'Equipment',
  'Group',
  'Holdings',
  'Imports',
  'Logistics',
  'Merchants',
  'Networks',
  'Partners',
  'Retail',
  'Source',
  'Supply',
  'Systems',
  'Tech',
  'Trading',
  'Ventures',
  'Wholesale',
];

const SITE_NAMES = [
  'Headquarters',
  'North Campus',
  'South Campus',
  'East Warehouse',
  'West Warehouse',
  'Data Center A',
  'Data Center B',
  'Remote Office — Chicago',
  'Remote Office — Austin',
  'Remote Office — Seattle',
  'Remote Office — Denver',
  'Remote Office — Boston',
  'Remote Office — Miami',
  'Remote Office — Atlanta',
  'Remote Office — Portland',
  'Remote Office — Phoenix',
  'Remote Office — Dallas',
  'Remote Office — San Diego',
  'Remote Office — Minneapolis',
  'Remote Office — Nashville',
  'Training Lab',
  'Repair Depot',
  'Staging Area',
  'Field Kit Storage',
  'Executive Suite',
];

const ASSET_TYPES = [
  { name: 'Laptop', model: 'ProBook 450', category: 'Laptop' },
  { name: 'Laptop', model: 'ThinkPad X1', category: 'Laptop' },
  { name: 'Laptop', model: 'MacBook Pro 14"', category: 'Laptop' },
  { name: 'Monitor', model: 'UltraSharp 27"', category: 'Monitor' },
  { name: 'Monitor', model: 'ProDisplay XDR', category: 'Monitor' },
  { name: 'Phone', model: 'iPhone 15', category: 'Phone' },
  { name: 'Phone', model: 'Galaxy S24', category: 'Phone' },
  { name: 'Tablet', model: 'iPad Air', category: 'Tablet' },
  { name: 'Tablet', model: 'Surface Pro 9', category: 'Tablet' },
  { name: 'Server', model: 'PowerEdge R750', category: 'Server' },
  { name: 'Server', model: 'ProLiant DL380', category: 'Server' },
  { name: 'Docking Station', model: 'USB-C Dock G5', category: 'Accessory' },
  { name: 'Keyboard', model: 'MX Keys', category: 'Accessory' },
  { name: 'Mouse', model: 'MX Master 3S', category: 'Accessory' },
  { name: 'Headset', model: 'Zone Wireless 2', category: 'Accessory' },
  { name: 'Printer', model: 'LaserJet Pro M404', category: 'Printer' },
  { name: 'Router', model: 'Meraki MX68', category: 'Network' },
  { name: 'Switch', model: 'Catalyst 9300', category: 'Network' },
];

const TRANSACTION_ACTIONS = [
  'CREATED',
  'UPDATED',
  'ASSIGNED',
  'UNASSIGNED',
  'STATUS_CHANGED',
  'SITE_CHANGED',
] as const;

const CLEAR_TABLES = [
  'import_job_row',
  'import_job',
  'export_job',
  'import_mapping_preset',
  'api_access_log',
  'idempotency_record',
  'api_key',
  'asset_custody_document',
  'handover',
  'transaction',
  'asset',
  'category_field',
  'category',
  'manufacturer',
  'vendor',
  'site',
  'webhook_destination',
  'messages',
  'session',
  'email_verification_token',
  'password_reset_token',
  TRACKING_TABLE,
];

type Db = ReturnType<typeof knex>;

function generateCatalogNames(
  adjectives: string[],
  nouns: string[],
  label: string,
  count: number,
): string[] {
  const combos: string[] = [];
  for (let i = 0; i < adjectives.length; i++) {
    for (let j = 0; j < nouns.length; j++) {
      combos.push(`${adjectives[i]} ${nouns[j]}`);
    }
  }
  const names: string[] = [];
  for (let i = 0; names.length < count && i < combos.length; i++) {
    names.push(combos[i]);
  }
  while (names.length < count) {
    const n = names.length + 1;
    names.push(`${label} ${String(n).padStart(3, '0')}`);
  }
  return names.slice(0, count);
}

function pick<T>(items: T[], index: number): T {
  return items[index % items.length];
}

function padSerial(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(6, '0')}`;
}

async function ensureTrackingTable(db: Db): Promise<void> {
  const exists = await db.schema.hasTable(TRACKING_TABLE);
  if (exists) return;

  await db.schema.createTable(TRACKING_TABLE, (table) => {
    table.increments('id').primary();
    table.string('entity_table', 64).notNullable();
    table.uuid('entity_id').notNullable();
    table.timestamp('seeded_at').defaultTo(db.fn.now());
    table.index(['entity_table', 'entity_id']);
  });
}

async function existingNamesLower(
  db: Db,
  table: 'manufacturer' | 'vendor',
): Promise<Set<string>> {
  const rows = await db(table).select('name');
  return new Set(rows.map((r: { name: string }) => r.name.trim().toLowerCase()));
}

async function seedCatalog(
  db: Db,
  table: 'manufacturer' | 'vendor',
  names: string[],
  track = true,
): Promise<{ inserted: number; skipped: boolean }> {
  const existing = await existingNamesLower(db, table);
  if (existing.size >= TARGET_COUNT) {
    return { inserted: 0, skipped: true };
  }

  const needed = TARGET_COUNT - existing.size;
  const toInsert = names
    .filter((name) => !existing.has(name.trim().toLowerCase()))
    .slice(0, needed);
  if (toInsert.length === 0) return { inserted: 0, skipped: false };

  const rows = await db(table)
    .insert(toInsert.map((name) => ({ name: name.trim() })))
    .returning(['id']);

  if (track && rows.length > 0) {
    await ensureTrackingTable(db);
    await db(TRACKING_TABLE).insert(
      rows.map((row: { id: string }) => ({
        entity_table: table,
        entity_id: row.id,
      })),
    );
  }

  return { inserted: rows.length, skipped: false };
}

async function clearNonUserData(db: Db): Promise<void> {
  const existing: string[] = [];
  for (const table of CLEAR_TABLES) {
    if (await db.schema.hasTable(table)) {
      existing.push(table);
    }
  }
  if (existing.length === 0) return;

  await db.raw(`TRUNCATE TABLE ${existing.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  console.log(`Cleared ${existing.length} table(s); users and roles preserved.`);
}

async function seedCategories(db: Db): Promise<Map<string, string>> {
  const defs = [
    {
      name: 'Laptop',
      icon: 'laptop',
      fields: [
        { field_key: 'ram_gb', label: 'RAM (GB)', data_type: 'NUMBER', sort_order: 0 },
        { field_key: 'storage_gb', label: 'Storage (GB)', data_type: 'NUMBER', sort_order: 1 },
        { field_key: 'cpu', label: 'CPU', data_type: 'TEXT', sort_order: 2 },
      ],
    },
    {
      name: 'Monitor',
      icon: 'monitor',
      fields: [
        { field_key: 'size_inches', label: 'Size (inches)', data_type: 'NUMBER', sort_order: 0 },
        { field_key: 'resolution', label: 'Resolution', data_type: 'TEXT', sort_order: 1 },
      ],
    },
    {
      name: 'Phone',
      icon: 'smartphone',
      fields: [
        { field_key: 'carrier', label: 'Carrier', data_type: 'TEXT', sort_order: 0 },
        { field_key: 'imei', label: 'IMEI', data_type: 'TEXT', sort_order: 1 },
      ],
    },
    {
      name: 'Tablet',
      icon: 'tablet',
      fields: [{ field_key: 'storage_gb', label: 'Storage (GB)', data_type: 'NUMBER', sort_order: 0 }],
    },
    {
      name: 'Server',
      icon: 'server',
      fields: [
        { field_key: 'rack_unit', label: 'Rack units', data_type: 'NUMBER', sort_order: 0 },
        { field_key: 'os', label: 'Operating system', data_type: 'TEXT', sort_order: 1 },
      ],
    },
    {
      name: 'Accessory',
      icon: 'plug',
      fields: [{ field_key: 'connection', label: 'Connection type', data_type: 'TEXT', sort_order: 0 }],
    },
    {
      name: 'Printer',
      icon: 'printer',
      fields: [{ field_key: 'color', label: 'Color capable', data_type: 'BOOLEAN', sort_order: 0 }],
    },
    {
      name: 'Network',
      icon: 'network',
      fields: [{ field_key: 'ports', label: 'Port count', data_type: 'NUMBER', sort_order: 0 }],
    },
  ];

  const byName = new Map<string, string>();
  for (const def of defs) {
    const [cat] = await db('category')
      .insert({ name: def.name, icon: def.icon, description: `Demo ${def.name} category` })
      .returning(['id']);
    byName.set(def.name, cat.id);

    if (def.fields.length > 0) {
      await db('category_field').insert(
        def.fields.map((f) => ({
          category_id: cat.id,
          field_key: f.field_key,
          label: f.label,
          data_type: f.data_type,
          sort_order: f.sort_order,
        })),
      );
    }
  }
  return byName;
}

async function seedSites(db: Db): Promise<string[]> {
  const baseLat = 40.7128;
  const baseLng = -74.006;
  const rows = SITE_NAMES.slice(0, DEMO_SITES).map((name, i) => ({
    name,
    description: `Demo site ${i + 1}`,
    address: `${100 + i} Demo Street, New York, NY`,
    latitude: baseLat + (i % 5) * 0.02 - 0.04,
    longitude: baseLng + Math.floor(i / 5) * 0.03 - 0.06,
  }));
  const inserted = await db('site').insert(rows).returning(['id']);
  return inserted.map((r: { id: string }) => r.id);
}

type UserRow = { id: string; display_name: string };

async function seedAssets(
  db: Db,
  siteIds: string[],
  manufacturerIds: string[],
  vendorIds: string[],
  categoryByName: Map<string, string>,
  users: UserRow[],
): Promise<Array<{ id: string; name: string }>> {
  const statuses = ['STOCK', 'ASSIGNED', 'MAINTENANCE', 'ARCHIVED'] as const;
  const statusWeights = [0.4, 0.35, 0.15, 0.1];
  const assets: Array<Record<string, unknown>> = [];

  for (let i = 0; i < DEMO_ASSETS; i++) {
    const type = pick(ASSET_TYPES, i);
    const roll = (i % 100) / 100;
    let status: (typeof statuses)[number] = 'STOCK';
    let cumulative = 0;
    for (let s = 0; s < statuses.length; s++) {
      cumulative += statusWeights[s];
      if (roll < cumulative) {
        status = statuses[s];
        break;
      }
    }

    const assignedUser =
      status === 'ASSIGNED' && users.length > 0 ? pick(users, i) : null;
    const purchaseCost = 200 + (i % 80) * 25;
    const purchaseDate = new Date(2022 + (i % 4), i % 12, (i % 28) + 1)
      .toISOString()
      .slice(0, 10);

    assets.push({
      name: `${type.name} ${String(i + 1).padStart(3, '0')}`,
      model: type.model,
      serial_number: padSerial('DEMO', i + 1),
      status,
      assigned_user_id: assignedUser?.id ?? null,
      site_id: pick(siteIds, i),
      manufacturer_id: pick(manufacturerIds, i),
      vendor_id: pick(vendorIds, i),
      category_id: categoryByName.get(type.category) ?? null,
      custom_fields: JSON.stringify({}),
      note: i % 7 === 0 ? 'Demo asset — inspect quarterly.' : null,
      purchase_date: purchaseDate,
      purchase_cost: purchaseCost,
      salvage_value: Math.round(purchaseCost * 0.1),
      useful_life_months: 36,
      depreciation_method: 'STRAIGHT_LINE',
      warranty_end_date:
        i % 5 === 0
          ? new Date(2026, (i % 12) + 1, 15).toISOString().slice(0, 10)
          : null,
      expected_return_date:
        status === 'ASSIGNED' && i % 3 === 0
          ? new Date(2026, 8, (i % 28) + 1).toISOString().slice(0, 10)
          : null,
    });
  }

  const inserted = await db('asset').insert(assets).returning(['id', 'name']);
  return inserted;
}

async function seedTransactions(
  db: Db,
  assets: Array<{ id: string; name: string }>,
  users: UserRow[],
  adminUser: UserRow | null,
): Promise<number> {
  if (assets.length === 0 || users.length === 0) return 0;

  const actor = adminUser ?? users[0];
  const rows: Array<Record<string, unknown>> = [];
  const count = Math.min(DEMO_TRANSACTIONS, assets.length * 2);

  for (let i = 0; i < count; i++) {
    const asset = pick(assets, i);
    const target = pick(users, i + 1);
    const action = pick([...TRANSACTION_ACTIONS], i);
    const daysAgo = count - i;
    rows.push({
      action,
      asset_id: asset.id,
      asset_name: asset.name,
      actor_user_id: actor.id,
      actor_name: actor.display_name,
      target_user_id: target.id,
      target_name: target.display_name,
      detail: `Demo ${action.toLowerCase().replace('_', ' ')} event`,
      date_created: db.raw(`NOW() - INTERVAL '${daysAgo} hours'`),
    });
  }

  await db('transaction').insert(rows);
  return rows.length;
}

async function seedDemo(db: Db): Promise<void> {
  await clearNonUserData(db);

  const manufacturerNames = generateCatalogNames(
    MANUFACTURER_ADJECTIVES,
    MANUFACTURER_NOUNS,
    'Dev Manufacturer',
    TARGET_COUNT,
  );
  const vendorNames = generateCatalogNames(
    VENDOR_ADJECTIVES,
    VENDOR_NOUNS,
    'Dev Vendor',
    TARGET_COUNT,
  );

  await seedCatalog(db, 'manufacturer', manufacturerNames, false);
  await seedCatalog(db, 'vendor', vendorNames, false);

  const manufacturers = await db('manufacturer').select('id');
  const vendors = await db('vendor').select('id');
  const users = await db('user').select('id', 'display_name');
  const adminUser =
    (await db('user')
      .join('role', 'user.role_id', 'role.id')
      .where('role.name', 'ADMIN')
      .select('user.id', 'user.display_name')
      .first()) ?? null;

  const categoryByName = await seedCategories(db);
  const siteIds = await seedSites(db);
  const assets = await seedAssets(
    db,
    siteIds,
    manufacturers.map((m: { id: string }) => m.id),
    vendors.map((v: { id: string }) => v.id),
    categoryByName,
    users,
  );
  const txCount = await seedTransactions(db, assets, users, adminUser);

  console.log(
    `Demo seed completed: ${manufacturers.length} manufacturers, ${vendors.length} vendors, ` +
      `${siteIds.length} sites, ${assets.length} assets, ${categoryByName.size} categories, ` +
      `${txCount} transactions (${users.length} user(s) preserved).`,
  );
}

async function seedUp(db: Db): Promise<void> {
  await ensureTrackingTable(db);

  const manufacturerNames = generateCatalogNames(
    MANUFACTURER_ADJECTIVES,
    MANUFACTURER_NOUNS,
    'Dev Manufacturer',
    TARGET_COUNT,
  );
  const vendorNames = generateCatalogNames(
    VENDOR_ADJECTIVES,
    VENDOR_NOUNS,
    'Dev Vendor',
    TARGET_COUNT,
  );

  const manufacturers = await seedCatalog(db, 'manufacturer', manufacturerNames);
  const vendors = await seedCatalog(db, 'vendor', vendorNames);

  const parts: string[] = [];
  if (manufacturers.skipped) {
    parts.push(`manufacturers already have ≥${TARGET_COUNT} rows`);
  } else {
    parts.push(`${manufacturers.inserted} manufacturer(s) inserted`);
  }
  if (vendors.skipped) {
    parts.push(`vendors already have ≥${TARGET_COUNT} rows`);
  } else {
    parts.push(`${vendors.inserted} vendor(s) inserted`);
  }
  console.log(`Seed completed: ${parts.join('; ')}.`);
}

async function seedDown(db: Db): Promise<void> {
  const hasTracking = await db.schema.hasTable(TRACKING_TABLE);
  if (!hasTracking) {
    console.log('No seed tracking table — nothing to roll back.');
    return;
  }

  const tracked = await db(TRACKING_TABLE).select('entity_table', 'entity_id');
  if (tracked.length === 0) {
    console.log('Seed rollback: no tracked rows.');
    return;
  }

  const byTable = tracked.reduce(
    (acc, row: { entity_table: string; entity_id: string }) => {
      const list = acc.get(row.entity_table) ?? [];
      list.push(row.entity_id);
      acc.set(row.entity_table, list);
      return acc;
    },
    new Map<string, string[]>(),
  );

  for (const table of ['vendor', 'manufacturer'] as const) {
    const ids = byTable.get(table);
    if (!ids?.length) continue;

    const referenced = await db('asset')
      .whereIn(`${table}_id`, ids)
      .whereNotNull(`${table}_id`)
      .select(`${table}_id`);
    const referencedIds = new Set(
      referenced.map((r: Record<string, string>) => r[`${table}_id`]),
    );
    const safeIds = ids.filter((id) => !referencedIds.has(id));

    if (safeIds.length > 0) {
      await db(table).whereIn('id', safeIds).delete();
    }
    if (referencedIds.size > 0) {
      console.log(
        `Skipped ${referencedIds.size} ${table}(s) still linked to assets.`,
      );
    }
  }

  await db(TRACKING_TABLE).delete();
  console.log('Seed rollback completed.');
}

async function main(): Promise<void> {
  const rollback = process.argv.includes('--rollback');
  const reset = process.argv.includes('--reset');
  const db = knex(knexConfig);

  try {
    if (rollback) {
      await seedDown(db);
    } else if (reset) {
      await seedDemo(db);
    } else {
      await seedUp(db);
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
