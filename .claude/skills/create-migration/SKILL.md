---
name: create-migration
description: Create a Knex database migration for the backend. Use when asked to create a migration, add a table, add columns, or change the database schema.
---

**Read `backend/docs/database-migrations.md` before doing anything — it contains all patterns, conventions, and examples for this skill.**

Run the `migrate:make` script to generate the file, then implement `up` and `down` following the patterns in that doc:

```bash
cd backend && npm run migrate:make <migration_name>
```
