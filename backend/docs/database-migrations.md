# Database Migrations

## Migration file names

Each migration file must be named:

```text
<YYYYMMDDHHMMSS>_<name>.ts
```

- **`YYYYMMDDHHMMSS`** — 14 digits: 4-digit year, 2-digit month, day, hour, minute, and second (UTC). This keeps filenames ordered by creation time.
- **`name`** — short snake_case description (e.g. `add_user_table`, `add_email_index`).

Example: `20250518143022_add_user_preferences.ts`

## Creating a Migration

Always use the `migrate:make` script — never create migration files manually:

```bash
cd backend
npm run migrate:make <migration_name>
```

This runs `scripts/migrate-make.cjs`, which creates `backend/migrations/<YYYYMMDDHHMMSS>_<migration_name>.ts` using the naming convention above.

## Migration Template

```typescript
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // your changes here
}

export async function down(knex: Knex): Promise<void> {
  // reverse your changes here
}
```

## Patterns

**UUID primary key:**

```typescript
table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
```

**Timestamps:**

```typescript
table.timestamp('date_created').defaultTo(knex.fn.now());
table.timestamp('date_updated').defaultTo(knex.fn.now());
```

**Postgres enums** — create before table, drop after table in `down`:

```typescript
await knex.raw(`CREATE TYPE my_enum AS ENUM ('value1', 'value2')`);
table.specificType('column', 'my_enum').notNullable();
// down:
await knex.raw('DROP TYPE IF EXISTS my_enum');
```

**Foreign keys:**

```typescript
table.uuid('fk_user_id').notNullable().references('id').inTable('user').onDelete('CASCADE');
```

**Indexes** — add after table creation:

```typescript
await knex.raw('CREATE INDEX idx_table_col ON table(col)');
```

## Running Migrations

```bash
npm run migrate           # apply pending
npm run migrate:rollback  # rollback last batch
```

## Configuration

Config lives in `backend/knexfile.cjs`. Migrations directory is `backend/migrations/`.
