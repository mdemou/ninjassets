import type { Knex } from 'knex';

/**
 * Import / export hub (SPEC-IMPORT-001 §8). Async jobs for bulk migration and
 * exports: import_job (+ staging rows), export_job, and reusable mapping presets.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Shared entity enum for both import and export jobs (§8.1, §8.3).
  await knex.raw(
    `CREATE TYPE import_entity_type AS ENUM ('ASSET', 'SITE', 'USER', 'MANUFACTURER', 'VENDOR')`,
  );
  // Import job lifecycle (§7.1).
  await knex.raw(`CREATE TYPE import_job_status AS ENUM (
    'QUEUED', 'PARSING', 'MAPPED', 'DRY_RUNNING', 'DRY_RUN_SUCCEEDED', 'DRY_RUN_FAILED',
    'COMMITTING', 'SUCCEEDED', 'PARTIAL_SUCCEEDED', 'FAILED', 'CANCELLED'
  )`);
  // Export job lifecycle (subset, §8.3).
  await knex.raw(
    `CREATE TYPE export_job_status AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED')`,
  );
  await knex.raw(`CREATE TYPE import_file_format AS ENUM ('CSV', 'XLSX', 'JSON')`);
  await knex.raw(`CREATE TYPE import_export_scope AS ENUM ('FULL', 'FILTERED')`);
  await knex.raw(`CREATE TYPE import_row_severity AS ENUM ('OK', 'WARNING', 'ERROR')`);

  // §8.4 — saved column maps (referenced by import_job.preset_id), created first.
  await knex.schema.createTable('import_mapping_preset', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('name').notNullable();
    table.specificType('entity_type', 'import_entity_type').notNullable();
    table.jsonb('mapping_json').notNullable();
    // SET NULL keeps the preset usable if the author is later removed.
    table.uuid('created_by_user_id').nullable().references('id').inTable('user').onDelete('SET NULL');
  });

  // §8.1 — import job.
  await knex.schema.createTable('import_job', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('created_by_user_id').nullable().references('id').inTable('user').onDelete('SET NULL');
    table.specificType('entity_type', 'import_entity_type').notNullable();
    table.specificType('status', 'import_job_status').notNullable().defaultTo('QUEUED');
    table.specificType('file_format', 'import_file_format').notNullable();
    table.string('original_filename').notNullable();
    table.string('storage_path').notNullable();
    // Column map + options (force, partialMode, createMissingSites, etc.).
    table.jsonb('mapping_json').nullable();
    table.uuid('preset_id').nullable().references('id').inTable('import_mapping_preset').onDelete('SET NULL');
    table.jsonb('dry_run_summary').nullable();
    table.jsonb('commit_summary').nullable();
    table.string('error_artifact_path').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('started_at').nullable();
    table.timestamp('finished_at').nullable();
  });
  await knex.raw('CREATE INDEX idx_import_job_status ON import_job(status)');
  await knex.raw('CREATE INDEX idx_import_job_created ON import_job(created_at DESC)');

  // §8.2 — staging rows.
  await knex.schema.createTable('import_job_row', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('import_job_id').notNullable().references('id').inTable('import_job').onDelete('CASCADE');
    table.integer('row_number').notNullable();
    table.jsonb('raw_json').notNullable();
    table.jsonb('mapped_json').nullable();
    table.specificType('severity', 'import_row_severity').notNullable().defaultTo('OK');
    table.jsonb('messages').notNullable().defaultTo('[]');
    table.uuid('target_entity_id').nullable();
  });
  await knex.raw(
    'CREATE UNIQUE INDEX idx_import_job_row_unique ON import_job_row(import_job_id, row_number)',
  );
  await knex.raw('CREATE INDEX idx_import_job_row_severity ON import_job_row(import_job_id, severity)');

  // §8.3 — export job.
  await knex.schema.createTable('export_job', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('created_by_user_id').nullable().references('id').inTable('user').onDelete('SET NULL');
    table.specificType('entity_type', 'import_entity_type').notNullable();
    table.specificType('status', 'export_job_status').notNullable().defaultTo('QUEUED');
    table.specificType('file_format', 'import_file_format').notNullable();
    table.specificType('scope', 'import_export_scope').notNullable().defaultTo('FULL');
    table.jsonb('filter_json').nullable();
    table.string('artifact_path').nullable();
    table.integer('row_count').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('finished_at').nullable();
  });
  await knex.raw('CREATE INDEX idx_export_job_status ON export_job(status)');
  await knex.raw('CREATE INDEX idx_export_job_created ON export_job(created_at DESC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('import_job_row');
  await knex.schema.dropTableIfExists('export_job');
  await knex.schema.dropTableIfExists('import_job');
  await knex.schema.dropTableIfExists('import_mapping_preset');
  await knex.raw('DROP TYPE IF EXISTS import_row_severity');
  await knex.raw('DROP TYPE IF EXISTS import_export_scope');
  await knex.raw('DROP TYPE IF EXISTS import_file_format');
  await knex.raw('DROP TYPE IF EXISTS export_job_status');
  await knex.raw('DROP TYPE IF EXISTS import_job_status');
  await knex.raw('DROP TYPE IF EXISTS import_entity_type');
}
