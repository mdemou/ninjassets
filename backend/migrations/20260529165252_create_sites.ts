import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('site', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.timestamp('date_updated').defaultTo(knex.fn.now());
    table.string('name').notNullable();
    table.text('description').nullable();
    // WGS84 decimal degrees: lat -90..90, lng -180..180. scale 7 ≈ ~1cm precision.
    table.decimal('latitude', 10, 7).notNullable();
    table.decimal('longitude', 10, 7).notNullable();
  });

  await knex.raw('CREATE INDEX idx_site_name ON site(name)');

  await knex.schema.alterTable('asset', (table) => {
    // Per-asset coordinate override. When null, the asset inherits its site's
    // coordinates (resolved with COALESCE on read).
    table.decimal('latitude', 10, 7).nullable();
    table.decimal('longitude', 10, 7).nullable();
    // Activate the FK reserved by the asset migration. SET NULL so removing a
    // site simply unlinks its assets rather than deleting them.
    table.foreign('site_id').references('id').inTable('site').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset', (table) => {
    table.dropForeign('site_id');
    table.dropColumn('latitude');
    table.dropColumn('longitude');
  });
  await knex.schema.dropTableIfExists('site');
}
