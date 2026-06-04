import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.raw(`CREATE TYPE handover_type AS ENUM ('CHECK_OUT', 'CHECK_IN')`);
  await knex.raw(`CREATE TYPE handover_status AS ENUM ('OPEN', 'CONSUMED', 'CANCELLED', 'EXPIRED')`);

  await knex.schema.createTable('handover', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.uuid('asset_id').notNullable().references('id').inTable('asset').onDelete('CASCADE');
    table.specificType('type', 'handover_type').notNullable();
    // Explicit lifecycle state. OPEN until consumed/cancelled/expired; expiry is a
    // lazy OPEN->EXPIRED transition so the partial unique index can stay IMMUTABLE
    // (a `now()` predicate is illegal in a Postgres index).
    table.specificType('status', 'handover_status').notNullable().defaultTo('OPEN');
    table.uuid('target_user_id').notNullable().references('id').inTable('user').onDelete('CASCADE');
    table.uuid('created_by_user_id').nullable().references('id').inTable('user').onDelete('SET NULL');
    // Only the SHA-256 hash of the opaque token is stored; the raw token lives only
    // in the email/link. (Intentionally stronger than the plaintext-token tables.)
    table.string('token_hash').notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('consumed_at').nullable();
    table.uuid('consumed_by_user_id').nullable().references('id').inTable('user').onDelete('SET NULL');
    table.timestamp('cancelled_at').nullable();
    table.uuid('cancelled_by_user_id').nullable().references('id').inTable('user').onDelete('SET NULL');
  });

  // At most one OPEN handover per asset (concurrency guard, REQ-HANDOVER-003).
  await knex.raw(
    `CREATE UNIQUE INDEX idx_handover_one_open_per_asset ON handover(asset_id) WHERE status = 'OPEN'`,
  );
  await knex.raw('CREATE INDEX idx_handover_token_hash ON handover(token_hash)');
  await knex.raw('CREATE INDEX idx_handover_asset_id ON handover(asset_id)');
  await knex.raw('CREATE INDEX idx_handover_target_user_id ON handover(target_user_id)');

  // New audit-log actions. ADD VALUE cannot run in the same transaction that then
  // uses the value, so this migration only adds them (no rows inserted here).
  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'HANDOVER_CREATED'`);
  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'HANDOVER_CANCELLED'`);
  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'CUSTODY_ACCEPTED'`);
  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'CUSTODY_COMPLETED_ON_BEHALF'`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('handover');
  await knex.raw('DROP TYPE IF EXISTS handover_status');
  await knex.raw('DROP TYPE IF EXISTS handover_type');
  // Postgres cannot remove enum values; transaction_action values remain.
}
