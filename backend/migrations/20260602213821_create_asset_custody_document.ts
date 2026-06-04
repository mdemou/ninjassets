import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.raw(`CREATE TYPE custody_document_type AS ENUM ('CHECK_OUT', 'CHECK_IN')`);

  await knex.schema.createTable('asset_custody_document', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    table.uuid('asset_id').notNullable().references('id').inTable('asset').onDelete('CASCADE');
    table.specificType('type', 'custody_document_type').notNullable();
    // Optional link to the handover this receipt documents. SET NULL so deleting a
    // handover never cascades away the archived signed PDF.
    table.uuid('handover_id').nullable().references('id').inTable('handover').onDelete('SET NULL');
    // Opaque on-disk name ({uuid}.pdf); the raw path is never exposed.
    table.string('storage_filename').notNullable();
    table.string('original_filename').notNullable();
    table.integer('file_size_bytes').notNullable();
    // Date written on the signed form (admin-entered, optional).
    table.date('document_date').nullable();
    table.string('condition_at_handover').nullable();
    table.text('accessories_note').nullable();
    table.text('notes').nullable();
    // Admin who uploaded the signed copy. SET NULL to preserve the archive if the
    // user record is later removed.
    table.uuid('uploaded_by_user_id').nullable().references('id').inTable('user').onDelete('SET NULL');
  });

  await knex.raw('CREATE INDEX idx_custody_document_asset_id ON asset_custody_document(asset_id)');
  await knex.raw('CREATE INDEX idx_custody_document_handover_id ON asset_custody_document(handover_id)');
  await knex.raw(
    'CREATE INDEX idx_custody_document_asset_created ON asset_custody_document(asset_id, date_created DESC)',
  );

  // New audit-log actions. ADD VALUE cannot run in the same transaction that then
  // uses the value, so this migration only adds them (no rows inserted here).
  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'CUSTODY_DOCUMENT_UPLOADED'`);
  await knex.raw(`ALTER TYPE transaction_action ADD VALUE IF NOT EXISTS 'CUSTODY_DOCUMENT_DELETED'`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('asset_custody_document');
  await knex.raw('DROP TYPE IF EXISTS custody_document_type');
  // Postgres cannot remove enum values; transaction_action values remain.
}
