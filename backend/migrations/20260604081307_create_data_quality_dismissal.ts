import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('data_quality_dismissal', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('date_created').defaultTo(knex.fn.now());
    // Deleting the asset removes its dismissals — they are meaningless without it.
    table.uuid('asset_id').notNullable().references('id').inTable('asset').onDelete('CASCADE');
    // Same string values as IDataQualityIssue. Kept as TEXT (not a pg enum) so adding
    // a new computed issue type never requires a migration to dismiss it.
    table.text('issue').notNullable();
    // Fingerprint of the issue instance at dismiss time (e.g. the warranty/return date,
    // the assignee id, or the asset's date_updated). A dismissal only hides a row while
    // the recomputed signature still matches; any change resurfaces the alert.
    table.text('signature').notNullable();
    // Admin who dismissed. SET NULL so removing the user keeps the (global) dismissal.
    table
      .uuid('dismissed_by_user_id')
      .nullable()
      .references('id')
      .inTable('user')
      .onDelete('SET NULL');
    // Global, one dismissal per (asset, issue); re-dismissing updates the signature.
    table.unique(['asset_id', 'issue']);
  });

  await knex.raw('CREATE INDEX idx_data_quality_dismissal_asset_id ON data_quality_dismissal(asset_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('data_quality_dismissal');
}
