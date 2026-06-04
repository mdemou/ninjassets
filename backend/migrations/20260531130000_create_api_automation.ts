import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Long-lived machine credentials (SPEC-API-001 §8.1). Only the SHA-256 hash of
  // the full bearer secret is stored; the raw secret lives only in the create/
  // regenerate response. `prefix` is the public lookup id embedded in the secret.
  await knex.schema.createTable('api_key', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE');
    table.text('name').notNullable();
    table.text('prefix').notNullable();
    table.text('secret_hash').notNullable();
    // Capability grant (§7.5). ["*"] or empty = full admin in MVP.
    table.jsonb('scopes').notNullable().defaultTo(JSON.stringify(['*']));
    table.timestamp('expires_at').nullable();
    table.timestamp('revoked_at').nullable();
    table.timestamp('last_used_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Validation reads by indexed prefix, then constant-time compares the hash — no scan.
  await knex.raw('CREATE UNIQUE INDEX idx_api_key_prefix ON api_key(prefix)');
  // Deployment-wide list: active keys first, newest first (D-API-7).
  await knex.raw('CREATE INDEX idx_api_key_list ON api_key(revoked_at, created_at)');

  // Append-only access log for key-authenticated /api/p/* calls (§8.2).
  await knex.schema.createTable('api_access_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('api_key_id').nullable().references('id').inTable('api_key').onDelete('SET NULL');
    table.uuid('user_id').nullable().references('id').inTable('user').onDelete('SET NULL');
    table.text('method').notNullable();
    table.text('path').notNullable();
    table.integer('status_code').notNullable();
    table.integer('duration_ms').nullable();
    table.text('ip').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_api_access_log_key ON api_access_log(api_key_id, created_at)');
  await knex.raw('CREATE INDEX idx_api_access_log_created ON api_access_log(created_at)');

  // Idempotency replay store for retried POSTs (§8.2a / §9.5). Per-caller.
  await knex.schema.createTable('idempotency_record', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.text('principal_id').notNullable();
    table.text('idempotency_key').notNullable();
    table.text('request_fingerprint').notNullable();
    table.integer('response_status').notNullable();
    table.jsonb('response_body').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.raw(
    'CREATE UNIQUE INDEX idx_idempotency_principal_key ON idempotency_record(principal_id, idempotency_key)',
  );
  await knex.raw('CREATE INDEX idx_idempotency_created ON idempotency_record(created_at)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('idempotency_record');
  await knex.schema.dropTableIfExists('api_access_log');
  await knex.schema.dropTableIfExists('api_key');
}
