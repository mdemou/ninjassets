/**
 * Export the OpenAPI spec to docs/openapi.json — OFFLINE, no running server.
 *
 * Builds an in-memory hapi server (plugins + auth strategies + routes), asks
 * hapi-swagger for `/docs.json` via `server.inject`, and writes the JSON to a file.
 * Route handlers never execute, so no Postgres/Redis connection is made.
 *
 * Run after changing the API:  `npm run export:openapi`
 * The ninjasset AI assistant indexes this file (SPEC-AI-ASSISTANT-001 §8.1); the
 * backend does not need to be up for the assistant to work.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { plugins } from '@plugins/plugins';
import { routes } from '@routes/routes';
import { createServer } from '@services/server.service';
import { registerStrategies } from '@strategies/strategies';

const OUT = resolve(__dirname, '../../docs/openapi.json');

async function main(): Promise<void> {
  const server = createServer();
  await server.register(plugins);
  registerStrategies(server);
  server.route(routes);
  await server.initialize();

  const res = await server.inject({ method: 'GET', url: '/docs.json' });
  if (res.statusCode !== 200) {
    throw new Error(`/docs.json returned ${res.statusCode}: ${res.payload}`);
  }

  const spec = JSON.parse(res.payload);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(spec, null, 2)}\n`);
  console.log(`Wrote ${OUT} — ${Object.keys(spec.paths ?? {}).length} paths`);

  await server.stop();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
