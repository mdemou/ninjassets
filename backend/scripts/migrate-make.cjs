const fs = require('fs');
const path = require('path');

function migrationTimestampUtc(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    String(d.getUTCFullYear()) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

const name = process.argv.slice(2).find((a) => !a.startsWith('-')) || 'migration';
const timestamp = migrationTimestampUtc();
const filename = `${timestamp}_${name.replace(/\.ts$/, '')}.ts`;
const migrationsDir = path.join(process.cwd(), 'migrations');
const filepath = path.join(migrationsDir, filename);

const stub = `import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  
}

export async function down(knex: Knex): Promise<void> {
  
}
`;

fs.writeFileSync(filepath, stub);
console.log(`Created ${filename}`);
