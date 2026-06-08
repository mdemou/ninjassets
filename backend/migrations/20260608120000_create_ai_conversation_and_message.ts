import type { Knex } from 'knex';

// Admin AI assistant conversations + messages (SPEC-AI-ASSISTANT-001 §12).
// The backend owns conversation memory; the aiagent service is stateless (D2/D11).
export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('ai_conversation', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE');
    table.string('title', 120).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
  });
  // List endpoint: a given admin's most-recently-updated, non-deleted conversations.
  await knex.raw(
    'CREATE INDEX idx_ai_conversation_owner ON ai_conversation(user_id, updated_at DESC) WHERE deleted_at IS NULL',
  );

  await knex.schema.createTable('ai_message', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('conversation_id')
      .notNullable()
      .references('id')
      .inTable('ai_conversation')
      .onDelete('CASCADE');
    table.text('role').notNullable();
    table.text('content').notNullable();
    table.string('locale', 2).notNullable();
    // Snapshot of retrieved sources for assistant messages (null for user messages).
    table.jsonb('sources').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw("ALTER TABLE ai_message ADD CONSTRAINT chk_ai_message_role CHECK (role IN ('user','assistant'))");
  // History fetch: messages of a conversation in chronological order.
  await knex.raw('CREATE INDEX idx_ai_message_conversation ON ai_message(conversation_id, created_at)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ai_message');
  await knex.schema.dropTableIfExists('ai_conversation');
}
