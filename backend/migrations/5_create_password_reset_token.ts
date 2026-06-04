import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('password_reset_token', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.string('token', 64).notNullable();
    table.uuid('fk_user_id').notNullable().references('id').inTable('user').onDelete('CASCADE');
    table.timestamp('expires_at').notNullable();

    table.index('token');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('password_reset_token');
}
