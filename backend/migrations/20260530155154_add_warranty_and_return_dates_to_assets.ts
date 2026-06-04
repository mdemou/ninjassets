import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset', (table) => {
    table.date('warranty_end_date').nullable();
    table.date('expected_return_date').nullable();
  });

  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'WARRANTY_CHANGED'`);
  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'RETURN_DATE_CHANGED'`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset', (table) => {
    table.dropColumn('warranty_end_date');
    table.dropColumn('expected_return_date');
  });
}
