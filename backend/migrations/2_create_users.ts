import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.raw(`CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE')`);

  await knex.schema.createTable('user', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.string('email').notNullable().unique();
    table.string('display_name').notNullable();
    table.string('hashed').notNullable();
    table.string('salt').notNullable();
    table.integer('role_id').unsigned().notNullable().references('id').inTable('role');
    table.specificType('status', 'user_status').notNullable().defaultTo('ACTIVE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user');
  await knex.raw('DROP TYPE IF EXISTS user_status');
}
