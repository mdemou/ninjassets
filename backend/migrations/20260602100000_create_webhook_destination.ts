import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Admin-managed outbound webhook destinations (SPEC-WEBHOOK-001 §8.1).
  // `target` holds platform delivery coordinates ({ url } for Slack/Discord,
  // { botToken, chatId } for Telegram) — a secret, masked on read. Stored
  // plaintext in v1, consistent with the SMTP-credential posture (D4).
  await knex.schema.createTable('webhook_destination', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.text('name').notNullable();
    table.text('platform').notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.jsonb('target').notNullable().defaultTo('{}');
    // Catalog event types this destination wants (webhook-only filter).
    table.jsonb('subscribed_events').notNullable().defaultTo('[]');
    table.uuid('created_by').nullable().references('id').inTable('user').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.raw(
    "ALTER TABLE webhook_destination ADD CONSTRAINT chk_webhook_platform " +
      "CHECK (platform IN ('slack','discord','telegram'))",
  );
  // Dispatcher hot path: only enabled destinations.
  await knex.raw('CREATE INDEX idx_webhook_destination_enabled ON webhook_destination(enabled)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('webhook_destination');
}
