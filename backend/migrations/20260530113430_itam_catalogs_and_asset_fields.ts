import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('manufacturer', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.timestamp('date_updated').defaultTo(knex.fn.now());
    table.string('name').notNullable();
  });
  await knex.raw(
    'CREATE UNIQUE INDEX idx_manufacturer_name_lower ON manufacturer (LOWER(TRIM(name)))',
  );
  await knex.raw('CREATE INDEX idx_manufacturer_name ON manufacturer(name)');

  await knex.schema.createTable('vendor', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.timestamp('date_updated').defaultTo(knex.fn.now());
    table.string('name').notNullable();
  });
  await knex.raw('CREATE UNIQUE INDEX idx_vendor_name_lower ON vendor (LOWER(TRIM(name)))');
  await knex.raw('CREATE INDEX idx_vendor_name ON vendor(name)');

  await knex.raw(`CREATE TYPE depreciation_method AS ENUM ('STRAIGHT_LINE')`);

  await knex.schema.alterTable('asset', (table) => {
    table.uuid('manufacturer_id').nullable().references('id').inTable('manufacturer').onDelete('RESTRICT');
    table.uuid('vendor_id').nullable().references('id').inTable('vendor').onDelete('RESTRICT');
    table.uuid('parent_asset_id').nullable().references('id').inTable('asset').onDelete('SET NULL');
    table.date('purchase_date').nullable();
    table.decimal('purchase_cost', 12, 2).nullable();
    table.decimal('salvage_value', 12, 2).nullable();
    table.integer('useful_life_months').nullable();
    table.specificType('depreciation_method', 'depreciation_method').nullable();
  });

  await knex.raw('CREATE INDEX idx_asset_manufacturer_id ON asset(manufacturer_id)');
  await knex.raw('CREATE INDEX idx_asset_vendor_id ON asset(vendor_id)');
  await knex.raw('CREATE INDEX idx_asset_parent_asset_id ON asset(parent_asset_id)');

  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'MANUFACTURER_CHANGED'`);
  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'VENDOR_CHANGED'`);
  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'PARENT_CHANGED'`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset', (table) => {
    table.dropForeign('manufacturer_id');
    table.dropForeign('vendor_id');
    table.dropForeign('parent_asset_id');
    table.dropColumn('manufacturer_id');
    table.dropColumn('vendor_id');
    table.dropColumn('parent_asset_id');
    table.dropColumn('purchase_date');
    table.dropColumn('purchase_cost');
    table.dropColumn('salvage_value');
    table.dropColumn('useful_life_months');
    table.dropColumn('depreciation_method');
  });

  await knex.schema.dropTableIfExists('vendor');
  await knex.schema.dropTableIfExists('manufacturer');
  await knex.raw('DROP TYPE IF EXISTS depreciation_method');
  // Postgres does not support removing enum values; transaction_action values remain.
}
