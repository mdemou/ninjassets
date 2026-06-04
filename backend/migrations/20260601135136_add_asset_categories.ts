import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('category', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.timestamp('date_updated').defaultTo(knex.fn.now());
    table.string('name').notNullable();
    table.string('icon').nullable();
    table.text('description').nullable();
  });
  await knex.raw('CREATE UNIQUE INDEX idx_category_name_lower ON category (LOWER(TRIM(name)))');
  await knex.raw('CREATE INDEX idx_category_name ON category(name)');

  await knex.raw(
    `CREATE TYPE category_field_type AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT', 'MULTI_SELECT')`,
  );

  await knex.schema.createTable('category_field', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.timestamp('date_updated').defaultTo(knex.fn.now());
    table.uuid('category_id').notNullable().references('id').inTable('category').onDelete('CASCADE');
    table.string('field_key').notNullable();
    table.string('label').notNullable();
    table.specificType('data_type', 'category_field_type').notNullable();
    table.boolean('required').notNullable().defaultTo(false);
    table.jsonb('options').nullable();
    table.string('help_text').nullable();
    table.string('placeholder').nullable();
    table.string('unit').nullable();
    table.integer('sort_order').notNullable().defaultTo(0);
  });
  await knex.raw('CREATE INDEX idx_category_field_category_id ON category_field(category_id)');
  await knex.raw(
    'CREATE UNIQUE INDEX idx_category_field_key ON category_field(category_id, field_key)',
  );

  await knex.schema.alterTable('asset', (table) => {
    table.uuid('category_id').nullable().references('id').inTable('category').onDelete('RESTRICT');
    table.jsonb('custom_fields').notNullable().defaultTo('{}');
  });
  await knex.raw('CREATE INDEX idx_asset_category_id ON asset(category_id)');

  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'CATEGORY_CHANGED'`);
  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'CUSTOM_FIELDS_CHANGED'`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset', (table) => {
    table.dropForeign('category_id');
    table.dropColumn('category_id');
    table.dropColumn('custom_fields');
  });

  await knex.schema.dropTableIfExists('category_field');
  await knex.schema.dropTableIfExists('category');
  await knex.raw('DROP TYPE IF EXISTS category_field_type');
  // Postgres does not support removing enum values; transaction_action values remain.
}
