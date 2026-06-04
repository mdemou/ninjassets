import type { Knex } from 'knex';

/**
 * serial_number was declared UNIQUE in create_assets; this migration makes that
 * guarantee explicit on older DBs and drops the redundant non-unique btree index
 * (the UNIQUE constraint already maintains a btree for equality lookups).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_asset_serial_number');

  const result = await knex.raw(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
      WHERE t.relname = 'asset'
        AND c.contype = 'u'
        AND a.attname = 'serial_number'
    ) AS exists
  `);
  const exists = Boolean((result.rows as { exists: boolean }[] | undefined)?.[0]?.exists);

  if (!exists) {
    await knex.schema.alterTable('asset', (table) => {
      table.unique(['serial_number'], { indexName: 'asset_serial_number_unique' });
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // UNIQUE on serial_number predates this migration; only restore the search index removed in up.
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_asset_serial_number ON asset(serial_number)');
}
