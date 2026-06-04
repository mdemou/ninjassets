import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-HANDOVER-002: Verified return
 *
 * "As an admin, I can start a verified return; the asset stays ASSIGNED until the
 *  holder confirms, then returns to STOCK."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-ho002-admin@test.com';
const USER_EMAIL = 'e2e-ho002-user@test.com';
const ASSET_NAME = 'E2E HO002 Tablet';
const SERIAL = 'E2E-HO2-RETURN';

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

async function seedUser(email: string, displayName: string, role: 'ADMIN' | 'USER'): Promise<string> {
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
      [email, displayName, hashed, salt, roleId],
    );
    return res.rows[0].id;
  });
}

async function seedAsset(assignedUserId: string): Promise<string> {
  return withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number = $1', [SERIAL]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id)
       VALUES ($1, '', $2, 'ASSIGNED', $3) RETURNING id`,
      [ASSET_NAME, SERIAL, assignedUserId],
    );
    return res.rows[0].id;
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM transaction WHERE asset_name = $1', [ASSET_NAME]);
    await client.query('DELETE FROM asset WHERE serial_number = $1', [SERIAL]);
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [[ADMIN_EMAIL, USER_EMAIL]]);
  });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/logout');
  await page.waitForURL(/\/login/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!token) throw new Error('Missing auth token');
  return { Authorization: `Bearer ${token}` };
}

async function createCheckinHandover(page: Page, assetId: string, targetUserId: string): Promise<string> {
  const headers = await authHeaders(page);
  const res = await page.request.post(`/api/p/assets/${assetId}/handovers`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
    data: { type: 'CHECK_IN', targetUserId, sendEmail: false },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: { acceptUrl: string } };
  const url = new URL(body.data.acceptUrl);
  return `${url.pathname}${url.search}`;
}

async function readAsset(): Promise<{ status: string; assignedUserId: string | null } | null> {
  return withDb(async (client) => {
    const res = await client.query<{ status: string; assigned_user_id: string | null }>(
      'SELECT status, assigned_user_id FROM asset WHERE serial_number = $1',
      [SERIAL],
    );
    const row = res.rows[0];
    return row ? { status: row.status, assignedUserId: row.assigned_user_id } : null;
  });
}

test.describe('REQ-HANDOVER-002: Verified return', () => {
  let assigneeId: string;
  let assetId: string;

  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'E2E HO002 Admin', 'ADMIN');
    assigneeId = await seedUser(USER_EMAIL, 'E2E HO002 User', 'USER');
    assetId = await seedAsset(assigneeId);
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-HANDOVER-002.1: Return handover keeps asset ASSIGNED until confirmed', () => {
    test('starting CHECK_IN leaves the asset ASSIGNED to the current holder', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      await page.waitForURL(/\/admin\/overview/);
      await createCheckinHandover(page, assetId, assigneeId);

      await expect.poll(readAsset).toEqual({ status: 'ASSIGNED', assignedUserId: assigneeId });
    });
  });

  test.describe('AC-HANDOVER-002.2: Holder accepts return', () => {
    test('the assignee confirms and the asset returns to STOCK', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      await page.waitForURL(/\/admin\/overview/);
      const acceptPath = await createCheckinHandover(page, assetId, assigneeId);

      await login(page, USER_EMAIL);
      await page.waitForURL(/\/dashboard/);
      await page.goto(acceptPath);

      await expect(page.getByRole('heading', { name: 'Confirm the return of this asset' })).toBeVisible();
      await page.getByRole('button', { name: 'Confirm return' }).click();

      await expect(page.getByText('You have confirmed the return of this asset.')).toBeVisible();
      await expect.poll(readAsset).toEqual({ status: 'STOCK', assignedUserId: null });
    });
  });
});
