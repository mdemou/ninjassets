import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-HANDOVER-004: Token and identity
 *
 * "Magic links are single-use, expire, and only work for the intended recipient;
 *  wrong-account access shows an ambiguous message."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-ho004-admin@test.com';
const USER_A_EMAIL = 'e2e-ho004-user-a@test.com';
const USER_B_EMAIL = 'e2e-ho004-user-b@test.com';
const ASSET_NAME = 'E2E HO004 Monitor';
const SERIAL = 'E2E-HO4-TOKEN';

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

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/logout');
  await page.waitForURL(/\/login/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/(dashboard|admin\/overview)/);
}

async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!token) throw new Error('Missing auth token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function createCheckoutAcceptPath(page: Page, assetId: string, targetUserId: string): Promise<string> {
  const res = await page.request.post(`/api/p/assets/${assetId}/handovers`, {
    headers: await authHeaders(page),
    data: { type: 'CHECK_OUT', targetUserId, sendEmail: false },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: { acceptUrl: string } };
  const url = new URL(body.data.acceptUrl);
  return `${url.pathname}${url.search}`;
}

async function expireHandoverForAsset(assetId: string): Promise<void> {
  await withDb((client) =>
    client.query(`UPDATE handover SET expires_at = NOW() - interval '1 hour' WHERE asset_id = $1 AND status = 'OPEN'`, [
      assetId,
    ]),
  );
}

test.describe('REQ-HANDOVER-004: Token and identity', () => {
  let userAId: string;
  let assetId: string;

  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'ADMIN');
    userAId = await seedUser(USER_A_EMAIL, 'USER');
    await seedUser(USER_B_EMAIL, 'USER');
    assetId = await seedAsset();
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-HANDOVER-004.1: Wrong recipient sees an ambiguous message', () => {
    test('user B opening user A link sees nothing pending, not a wrong-account hint', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      const acceptPath = await createCheckoutAcceptPath(page, assetId, userAId);

      await login(page, USER_B_EMAIL);
      await page.goto(acceptPath);

      await expect(page.getByRole('heading', { name: 'Nothing pending for you' })).toBeVisible();
      await expect(page.getByText(/intended for another/i)).toHaveCount(0);
      await expect(page.getByText(/wrong account/i)).toHaveCount(0);
    });
  });

  test.describe('AC-HANDOVER-004.2: Expired token is rejected', () => {
    test('an expired link shows an error on the accept page', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      const acceptPath = await createCheckoutAcceptPath(page, assetId, userAId);
      await expireHandoverForAsset(assetId);

      await login(page, USER_A_EMAIL);
      await page.goto(acceptPath);

      await expect(page.getByText('This link has expired')).toBeVisible();
    });
  });

  test.describe('AC-HANDOVER-004.3: Reused token is rejected', () => {
    test('accepting twice with the same token fails the second time', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      const acceptPath = await createCheckoutAcceptPath(page, assetId, userAId);

      await login(page, USER_A_EMAIL);
      await page.goto(acceptPath);
      await page.getByRole('button', { name: 'Confirm receipt' }).click();
      await expect(page.getByText('You have confirmed receipt of this asset.')).toBeVisible();

      await page.goto(acceptPath);
      await expect(page.getByText('This link has already been used')).toBeVisible();
    });
  });
});
