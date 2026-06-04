import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset', (table) => {
    // Filename on disk under config.uploads.assetImagePath. Null = no image.
    table.string('image_filename').nullable();
    table.text('note').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('asset', (table) => {
    table.dropColumn('image_filename');
    table.dropColumn('note');
  });
}
