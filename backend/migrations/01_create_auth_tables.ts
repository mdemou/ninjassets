import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('role', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.timestamp('date_created').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('scope', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.timestamp('date_created').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('role_scope', (table) => {
    table.increments('id').primary();
    table.integer('role_id').unsigned().notNullable().references('id').inTable('role').onDelete('CASCADE');
    table.integer('scope_id').unsigned().notNullable().references('id').inTable('scope').onDelete('CASCADE');
    table.unique(['role_id', 'scope_id']);
    table.timestamp('date_created').defaultTo(knex.fn.now());
  });

  // Seed roles
  const [adminRole] = await knex('role').insert([
    { name: 'ADMIN' },
    { name: 'USER' },
  ]).returning('id');

  const userRole = (await knex('role').where({ name: 'USER' }).first());

  // Seed scopes
  const scopes = await knex('scope').insert([
    { name: 'LIST_USERS' },
    { name: 'DETAILS_USERS' },
    { name: 'MANAGE_USERS' },
  ]).returning('*');

  const listUsersScope = scopes.find((s: { name: string }) => s.name === 'LIST_USERS');
  const detailsUsersScope = scopes.find((s: { name: string }) => s.name === 'DETAILS_USERS');
  const manageUsersScope = scopes.find((s: { name: string }) => s.name === 'MANAGE_USERS');

  // ADMIN gets all scopes
  await knex('role_scope').insert([
    { role_id: adminRole.id, scope_id: listUsersScope.id },
    { role_id: adminRole.id, scope_id: detailsUsersScope.id },
    { role_id: adminRole.id, scope_id: manageUsersScope.id },
  ]);

  // USER gets list + details
  await knex('role_scope').insert([
    { role_id: userRole.id, scope_id: listUsersScope.id },
    { role_id: userRole.id, scope_id: detailsUsersScope.id },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('role_scope');
  await knex.schema.dropTableIfExists('scope');
  await knex.schema.dropTableIfExists('role');
}
