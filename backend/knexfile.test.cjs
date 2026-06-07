const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

function numericMigrationSort(a, b) {
  const numA = BigInt(a.split('_')[0]);
  const numB = BigInt(b.split('_')[0]);
  return numA < numB ? -1 : numA > numB ? 1 : 0;
}

const migrationSource = {
  async getMigrations() {
    const dir = path.resolve(__dirname, 'migrations');
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(ts|js)$/.test(f) && !f.startsWith('seed'))
      .sort(numericMigrationSort);
  },
  getMigrationName(migration) {
    return migration;
  },
  async getMigration(migration) {
    return require(path.resolve(__dirname, 'migrations', migration));
  },
};

module.exports = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: { migrationSource },
};
