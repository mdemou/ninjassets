/**
 * Capture README screenshots against the local dev stack (frontend :3000).
 * Usage (from e2e/): node scripts/capture-readme-screenshots.mjs
 */
import { chromium } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(ROOT, 'backend', '.env') });

const OUT_DIR = path.join(ROOT, 'docs', 'screenshots');
const BASE_URL = process.env.README_SCREENSHOT_BASE_URL || 'http://localhost:3000';
const PASSWORD = 'Screenshot123!';

const ADMIN_EMAIL = 'readme-screenshots-admin@test.com';
const USER_EMAIL = 'readme-screenshots-user@test.com';

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'ninjasset_dev',
};

async function withDb(fn) {
  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function seedUser(email, displayName, roleName) {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(PASSWORD, salt);

  await withDb(async (client) => {
    const role = await client.query('SELECT id FROM role WHERE name = $1 LIMIT 1', [roleName]);
    const roleId = role.rows[0]?.id;
    if (!roleId) throw new Error(`${roleName} role not found`);

    await client.query('DELETE FROM "user" WHERE email = $1', [email]);
    await client.query(
      `INSERT INTO "user" (email, display_name, hashed, salt, role_id, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
      [email, displayName, hashed, salt, roleId],
    );
  });
}

/** @type {{ id: string, status: string, assigned_user_id: string | null }[]} */
let assetAssignmentBackup = [];

async function assignDemoAssetsToUser(email, limit = 6) {
  assetAssignmentBackup = await withDb(async (client) => {
    const userRes = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
    const userId = userRes.rows[0]?.id;
    if (!userId) throw new Error(`User not found: ${email}`);

    const assets = await client.query(
      `SELECT id, status, assigned_user_id
       FROM asset
       ORDER BY name ASC
       LIMIT $1`,
      [limit],
    );

    const backup = assets.rows.map((row) => ({
      id: row.id,
      status: row.status,
      assigned_user_id: row.assigned_user_id,
    }));

    if (backup.length === 0) return backup;

    await client.query(
      `UPDATE asset
       SET status = 'ASSIGNED', assigned_user_id = $1
       WHERE id = ANY($2::uuid[])`,
      [userId, backup.map((row) => row.id)],
    );

    return backup;
  });
}

async function restoreAssetAssignments() {
  if (assetAssignmentBackup.length === 0) return;

  await withDb(async (client) => {
    for (const row of assetAssignmentBackup) {
      await client.query('UPDATE asset SET status = $1, assigned_user_id = $2 WHERE id = $3', [
        row.status,
        row.assigned_user_id,
        row.id,
      ]);
    }
  });

  assetAssignmentBackup = [];
}

async function deleteUsers() {
  await restoreAssetAssignments();
  await withDb(async (client) => {
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [[ADMIN_EMAIL, USER_EMAIL]]);
  });
}

async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(admin\/overview|dashboard|assets)/, { timeout: 15000 });
}

async function shot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`wrote ${file}`);
}

async function waitForStable(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await seedUser(ADMIN_EMAIL, 'README Admin', 'ADMIN');
  await seedUser(USER_EMAIL, 'README User', 'USER');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    await page.goto('/');
    await waitForStable(page);
    await shot(page, 'public-home');

    await page.goto('/login');
    await waitForStable(page);
    await shot(page, 'login');

    await login(page, ADMIN_EMAIL);

    await page.goto('/admin/overview');
    await waitForStable(page);
    await shot(page, 'admin-overview');

    await page.goto('/admin/assets');
    await waitForStable(page);
    await shot(page, 'admin-assets');

    const assetId = await withDb(async (client) => {
      const res = await client.query('SELECT id FROM asset ORDER BY date_created DESC LIMIT 1');
      return res.rows[0]?.id ?? null;
    });
    if (assetId) {
      await page.goto(`/admin/assets/${assetId}`);
      await waitForStable(page);
      await shot(page, 'admin-asset-detail');
    }

    await page.goto('/admin/sites');
    await waitForStable(page);
    await shot(page, 'admin-sites');

    await page.goto('/admin/webhooks');
    await waitForStable(page);
    await shot(page, 'admin-integrations');

    await page.goto('/admin/import-export');
    await waitForStable(page);
    await shot(page, 'admin-import-export');

    await assignDemoAssetsToUser(USER_EMAIL, 6);

    await page.goto('/logout');
    await page.waitForURL(/\/(login)?$/);

    await login(page, USER_EMAIL);
    await page.goto('/dashboard');
    await waitForStable(page);
    await shot(page, 'personal-dashboard');
  } finally {
    await browser.close();
    await deleteUsers();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
