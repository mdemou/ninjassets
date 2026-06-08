import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
import {
  TEST_BACKEND_PORT,
  TEST_DB_NAME,
  TEST_FRONTEND_PORT,
  TEST_REDIS_DB,
} from "./config";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const dbUser = process.env.DB_USER || "postgres";
const dbPassword = process.env.DB_PASSWORD || "postgres";
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = process.env.DB_PORT || "5432";
const testDatabaseUrl = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${TEST_DB_NAME}`;
const agentMode = !!process.env.E2E_AGENT;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup",
  globalTeardown: "./global-teardown",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: agentMode ? 0 : process.env.CI ? 2 : 0,
  // CI runners cold-start the Vite/react-router dev server and compile routes
  // on first hit, so give individual tests more headroom there than locally.
  timeout: process.env.CI ? 60_000 : 30_000,
  reporter: agentMode
    ? [["./reporters/agent-summary-reporter.ts"]]
    : [
        [
          "html",
          {
            outputFolder: "playwright-report",
            open: process.env.CI ? "never" : "on-failure",
          },
        ],
        ["list"],
      ],
  use: {
    baseURL: `http://localhost:${TEST_FRONTEND_PORT}`,
    trace: agentMode ? "off" : "on-first-retry",
    screenshot: agentMode ? "off" : "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      cwd: path.resolve(__dirname, "../backend"),
      url: `http://localhost:${TEST_BACKEND_PORT}/api/__health/liveness`,
      timeout: 60_000,
      reuseExistingServer: false,
      ...(agentMode
        ? { stdout: "ignore" as const, stderr: "ignore" as const }
        : {}),
      env: {
        ...process.env,
        PORT: String(TEST_BACKEND_PORT),
        DB_NAME: TEST_DB_NAME,
        DATABASE_URL: testDatabaseUrl,
        LOG_LEVEL: "warn",
        BACKEND_URL: `http://localhost:${TEST_BACKEND_PORT}`,
        FRONTEND_URL: `http://localhost:${TEST_FRONTEND_PORT}`,
        MOCK_CAPTCHA: "true",
        MOCK_EMAIL: "true",
        // AI assistant: enabled + canned SSE from the backend (no aiagent/Qdrant/LLM).
        AI_ASSISTANT_ENABLED: "true",
        MOCK_AI: "true",
        // Isolate the test backend's Redis traffic (notification queue) from dev (db 0).
        REDIS_DB: String(TEST_REDIS_DB),
        // Allow webhook delivery to a local mock receiver (loopback/http).
        WEBHOOK_ALLOW_INSECURE_TARGETS: "true",
        // Long interval so the periodic alert scan never fires mid-test.
        WEBHOOK_ALERT_SCAN_INTERVAL_MS: "86400000",
      },
    },
    {
      command: "npm run dev",
      cwd: path.resolve(__dirname, "../frontend"),
      port: TEST_FRONTEND_PORT,
      timeout: 60_000,
      reuseExistingServer: false,
      ...(agentMode
        ? { stdout: "ignore" as const, stderr: "ignore" as const }
        : {}),
      env: {
        ...process.env,
        PORT: String(TEST_FRONTEND_PORT),
        API_URL: `http://localhost:${TEST_BACKEND_PORT}`,
      },
    },
  ],
});
