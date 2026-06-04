import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.raw(
    `CREATE TYPE transaction_action AS ENUM ('CREATED', 'UPDATED', 'ASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED', 'SITE_CHANGED', 'DELETED')`,
  );

  await knex.schema.createTable('transaction', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.specificType('action', 'transaction_action').notNullable();
    // Snapshots (name columns) keep the row readable even after the referenced
    // asset/user is deleted; the FKs go null rather than removing history.
    table.uuid('asset_id').nullable().references('id').inTable('asset').onDelete('SET NULL');
    table.string('asset_name').notNullable();
    table.uuid('actor_user_id').nullable().references('id').inTable('user').onDelete('SET NULL');
    table.string('actor_name').nullable();
    // The user the event concerns (assignee). Drives a user's personal history.
    table.uuid('target_user_id').nullable().references('id').inTable('user').onDelete('SET NULL');
    table.string('target_name').nullable();
    table.string('detail').nullable();
  });

  await knex.raw('CREATE INDEX idx_transaction_date_created ON transaction(date_created DESC)');
  await knex.raw('CREATE INDEX idx_transaction_target_user_id ON transaction(target_user_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transaction');
  await knex.raw('DROP TYPE IF EXISTS transaction_action');
}
