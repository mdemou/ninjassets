import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-HANDOVER-003: Concurrency and blocking
 *
 * "While a handover is open, no second handover can start and direct status/assignee
 *  changes on that asset are blocked."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-ho003-admin@test.com';
const USER_A_EMAIL = 'e2e-ho003-user-a@test.com';
const USER_B_EMAIL = 'e2e-ho003-user-b@test.com';
const ASSET_NAME = 'E2E HO003 Phone';
const SERIAL = 'E2E-HO3-BLOCK';

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: TEST_DB_NAME,
};

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function seedUser(email: string, role: 'ADMIN' | 'USER'): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(PASSWORD, salt);
  return withDb(async (client) => {
    const r = await client.query<{ id: number }>('SELECT id FROM role WHERE name = $1 LIMIT 1', [role]);
    const roleId = r.rows[0]?.id;
    if (!roleId) throw new Error(`${role} role not found`);
    await client.query('DELETE FROM "user" WHERE email = $1', [email]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO "user" (email, display_name, hashed, salt, role_id, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE') RETURNING id`,
      [email, email, hashed, salt, roleId],
    );
    return res.rows[0].id;
  });
}

async function seedAsset(): Promise<string> {
  return withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number = $1', [SERIAL]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id)
       VALUES ($1, '', $2, 'STOCK', NULL) RETURNING id`,
      [ASSET_NAME, SERIAL],
    );
    return res.rows[0].id;
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM transaction WHERE asset_name = $1', [ASSET_NAME]);
    await client.query('DELETE FROM asset WHERE serial_number = $1', [SERIAL]);
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [[ADMIN_EMAIL, USER_A_EMAIL, USER_B_EMAIL]]);
  });
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/admin\/overview/);
}

async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!token) throw new Error('Missing auth token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function startCheckout(page: Page, assetId: string, targetUserId: string): Promise<number> {
  const res = await page.request.post(`/api/p/assets/${assetId}/handovers`, {
    headers: await authHeaders(page),
    data: { type: 'CHECK_OUT', targetUserId, sendEmail: false },
  });
  return res.status();
}

test.describe('REQ-HANDOVER-003: Concurrency and blocking', () => {
  let userAId: string;
  let userBId: string;
  let assetId: string;

  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'ADMIN');
    userAId = await seedUser(USER_A_EMAIL, 'USER');
    userBId = await seedUser(USER_B_EMAIL, 'USER');
    assetId = await seedAsset();
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-HANDOVER-003.1: Only one open handover per asset', () => {
    test('a second handover on the same asset returns 409', async ({ page }) => {
      await loginAdmin(page);
      expect(await startCheckout(page, assetId, userAId)).toBe(200);
      expect(await startCheckout(page, assetId, userAId)).toBe(409);
    });
  });

  test.describe('AC-HANDOVER-003.2: Cannot checkout to another user while one is open', () => {
    test('CHECK_OUT to B is rejected when an open CHECK_OUT to A exists', async ({ page }) => {
      await loginAdmin(page);
      expect(await startCheckout(page, assetId, userAId)).toBe(200);
      expect(await startCheckout(page, assetId, userBId)).toBe(409);
    });
  });

  test.describe('AC-HANDOVER-003.3: Direct PATCH blocked while handover is open', () => {
    test('changing status or assignee via PATCH returns 409', async ({ page }) => {
      await loginAdmin(page);
      expect(await startCheckout(page, assetId, userAId)).toBe(200);

      const headers = await authHeaders(page);
      const statusRes = await page.request.patch(`/api/p/assets/${assetId}`, {
        headers,
        data: { status: 'ASSIGNED', assignedUserId: userAId },
      });
      expect(statusRes.status()).toBe(409);

      const assigneeRes = await page.request.patch(`/api/p/assets/${assetId}`, {
        headers,
        data: { assignedUserId: userBId },
      });
      expect(assigneeRes.status()).toBe(409);
    });
  });
});
