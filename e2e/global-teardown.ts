import dotenv from "dotenv";
import path from "path";
import { Client } from "pg";
import { TEST_DB_NAME, TEST_REDIS_DB } from "./config";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const quiet = !!process.env.E2E_AGENT;

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default async function globalTeardown() {
  const dbUser = process.env.DB_USER || "postgres";
  const dbPassword = process.env.DB_PASSWORD || "postgres";
  const dbHost = process.env.DB_HOST || "localhost";
  const dbPort = parseInt(process.env.DB_PORT || "5432", 10);

  if (!quiet)
    console.log(`[e2e teardown] Dropping database '${TEST_DB_NAME}'...`);
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
  await adminClient.end();
  if (!quiet) console.log(`[e2e teardown] Database '${TEST_DB_NAME}' dropped`);
}
