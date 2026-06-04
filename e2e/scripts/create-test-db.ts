import { execSync } from "child_process";
import dotenv from "dotenv";
import Redis from "ioredis";
import path from "path";
import { Client } from "pg";
import { TEST_DB_NAME, TEST_REDIS_DB } from "../config";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const quiet = !!process.env.E2E_AGENT;

function log(...args: unknown[]) {
  if (!quiet) console.log(...args);
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function main() {
  const dbUser = process.env.DB_USER || "postgres";
  const dbPassword = process.env.DB_PASSWORD || "postgres";
  const dbHost = process.env.DB_HOST || "localhost";
  const dbPort = parseInt(process.env.DB_PORT || "5432", 10);
  const testDatabaseUrl = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${TEST_DB_NAME}`;

  log(`[e2e setup] Creating test database '${TEST_DB_NAME}'...`);
  const adminClient = new Client({
    user: dbUser,
    password: dbPassword,
    host: dbHost,
    port: dbPort,
    database: "postgres",
  });
  await adminClient.connect();

  await adminClient.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [TEST_DB_NAME],
  );
  await adminClient.query(
    `DROP DATABASE IF EXISTS ${quoteIdentifier(TEST_DB_NAME)}`,
  );
  await adminClient.query(`CREATE DATABASE ${quoteIdentifier(TEST_DB_NAME)}`);
  await adminClient.end();

  const dbClient = new Client({
    user: dbUser,
    password: dbPassword,
    host: dbHost,
    port: dbPort,
    database: TEST_DB_NAME,
  });
  await dbClient.connect();
  await dbClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await dbClient.end();
  log(`[e2e setup] Database '${TEST_DB_NAME}' created`);

  log("[e2e setup] Running migrations...");
  const backendDir = path.resolve(__dirname, "../../backend");
  const migrateEnv = { ...process.env, DATABASE_URL: testDatabaseUrl };
  const migrateCommand =
    "npx tsx node_modules/.bin/knex migrate:latest --knexfile knexfile.test.cjs";

  if (quiet) {
    try {
      execSync(migrateCommand, {
        cwd: backendDir,
        env: migrateEnv,
        stdio: ["ignore", "ignore", "pipe"],
      });
    } catch (e) {
      const stderr =
        e &&
        typeof e === "object" &&
        "stderr" in e &&
        Buffer.isBuffer((e as { stderr: Buffer }).stderr)
          ? (e as { stderr: Buffer }).stderr.toString("utf8")
          : "";
      const line =
        stderr.split("\n").find((l) => l.trim()) ??
        (e instanceof Error ? e.message : String(e));
      console.error(`[e2e setup] FAIL ${line.trim().slice(0, 300)}`);
      process.exit(1);
    }
  } else {
    execSync(migrateCommand, {
      cwd: backendDir,
      env: migrateEnv,
      stdio: "inherit",
    });
  }
  log("[e2e setup] Migrations complete");

  // Flush the test Redis db (db 1) so stale notification jobs from a prior run
  // cannot deliver into this run. FLUSHDB only affects the selected db, never dev (db 0).
  log(`[e2e setup] Flushing Redis db ${TEST_REDIS_DB}...`);
  const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: TEST_REDIS_DB,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  try {
    await redis.connect();
    await redis.flushdb();
    log("[e2e setup] Redis flushed");
  } catch (err) {
    // Redis is optional for non-webhook suites; warn but don't fail setup.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[e2e setup] WARN could not flush Redis db ${TEST_REDIS_DB}: ${msg}`);
  } finally {
    redis.disconnect();
  }

  log("[e2e setup] Test environment ready\n");
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(quiet ? `[e2e setup] FAIL ${msg}` : "[e2e setup] FAILED:", err);
  process.exit(1);
});
