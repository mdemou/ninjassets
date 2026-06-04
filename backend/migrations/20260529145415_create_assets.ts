import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.raw(`CREATE TYPE asset_status AS ENUM ('STOCK', 'ASSIGNED', 'MAINTENANCE', 'ARCHIVED')`);

  await knex.schema.createTable('asset', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.timestamp('date_updated').defaultTo(knex.fn.now());
    table.string('name').notNullable();
    table.string('model').notNullable().defaultTo('');
    table.string('serial_number').notNullable().unique();
    table.specificType('status', 'asset_status').notNullable().defaultTo('STOCK');
    // Nullable: an asset only has an owner while status = 'ASSIGNED'. SET NULL so
    // deleting a user releases their assets instead of cascading the deletion.
    table.uuid('assigned_user_id').nullable().references('id').inTable('user').onDelete('SET NULL');
    // The Sites/Locations module is a later phase; the FK constraint will be added
    // alongside the `site` table migration. Kept nullable + unconstrained for now.
    table.uuid('site_id').nullable();
  });

  // Supports the omnipresent debounced search (ILIKE across these columns).
  await knex.raw('CREATE INDEX idx_asset_name ON asset(name)');
  await knex.raw('CREATE INDEX idx_asset_model ON asset(model)');
  await knex.raw('CREATE INDEX idx_asset_serial_number ON asset(serial_number)');
  await knex.raw('CREATE INDEX idx_asset_assigned_user_id ON asset(assigned_user_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('asset');
  await knex.raw('DROP TYPE IF EXISTS asset_status');
}
