import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('manufacturer', (table) => {
    table.string('image_filename').nullable();
  });
  await knex.schema.alterTable('vendor', (table) => {
    table.string('image_filename').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('manufacturer', (table) => {
    table.dropColumn('image_filename');
  });
  await knex.schema.alterTable('vendor', (table) => {
    table.dropColumn('image_filename');
  });
}
