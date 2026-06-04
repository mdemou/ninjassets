import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('session', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.text('token_val').notNullable();
    table.boolean('status').notNullable().defaultTo(true);
    table.uuid('fk_user_id').notNullable().references('id').inTable('user').onDelete('CASCADE');
    table.string('platform').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('session');
}
