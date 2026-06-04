import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user', (table) => {
    // Filename (not path) of the user's avatar on disk. Resolved against
    // config.uploads.avatarPath when served. Null = no avatar (show initials).
    table.string('avatar_filename').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user', (table) => {
    table.dropColumn('avatar_filename');
  });
}
