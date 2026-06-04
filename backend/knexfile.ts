import type { Knex } from 'knex';

const config: Knex.Config = {
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ninjasset_dev',
  migrations: {
    directory: './migrations',
  },
};

export default config;
