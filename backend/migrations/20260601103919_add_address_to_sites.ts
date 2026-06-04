import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('site', (table) => {
    table.string('address').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('site', (table) => {
    table.dropColumn('address');
  });
}
