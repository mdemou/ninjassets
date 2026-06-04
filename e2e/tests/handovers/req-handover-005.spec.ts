import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-HANDOVER-005: Admin override
 *
 * "Admins can complete or cancel open handovers, and direct assignment still works
 *  when no handover is pending."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-ho005-admin@test.com';
const USER_EMAIL = 'e2e-ho005-user@test.com';
const ASSET_CHECKOUT = 'E2E HO005 Checkout Asset';
const SERIAL_CHECKOUT = 'E2E-HO5-CHECKOUT';
const ASSET_DIRECT = 'E2E HO005 Direct Asset';
const SERIAL_DIRECT = 'E2E-HO5-DIRECT';

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

async function seedAsset(name: string, serial: string, status: string, assignedUserId: string | null): Promise<string> {
  return withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number = $1', [serial]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id)
       VALUES ($1, '', $2, $3, $4) RETURNING id`,
      [name, serial, status, assignedUserId],
    );
    return res.rows[0].id;
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM transaction WHERE asset_name = ANY($1)', [[ASSET_CHECKOUT, ASSET_DIRECT]]);
    await client.query('DELETE FROM asset WHERE serial_number = ANY($1)', [[SERIAL_CHECKOUT, SERIAL_DIRECT]]);
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [[ADMIN_EMAIL, USER_EMAIL]]);
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

async function createCheckout(page: Page, assetId: string, targetUserId: string): Promise<string> {
  const res = await page.request.post(`/api/p/assets/${assetId}/handovers`, {
    headers: await authHeaders(page),
    data: { type: 'CHECK_OUT', targetUserId, sendEmail: false },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: { handover: { id: string } } };
  return body.data.handover.id;
}

async function readAsset(serial: string): Promise<{ status: string; assignedUserId: string | null } | null> {
  return withDb(async (client) => {
    const res = await client.query<{ status: string; assigned_user_id: string | null }>(
      'SELECT status, assigned_user_id FROM asset WHERE serial_number = $1',
      [serial],
    );
    const row = res.rows[0];
    return row ? { status: row.status, assignedUserId: row.assigned_user_id } : null;
  });
}

async function readHandoverStatus(handoverId: string): Promise<string | null> {
  return withDb(async (client) => {
    const res = await client.query<{ status: string }>('SELECT status FROM handover WHERE id = $1', [handoverId]);
    return res.rows[0]?.status ?? null;
  });
}

async function readTransactionActions(assetName: string): Promise<string[]> {
  return withDb(async (client) => {
    const res = await client.query<{ action: string }>(
      'SELECT action FROM transaction WHERE asset_name = $1 ORDER BY date_created',
      [assetName],
    );
    return res.rows.map((r) => r.action);
  });
}

test.describe('REQ-HANDOVER-005: Admin override', () => {
  let userId: string;

  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'ADMIN');
    userId = await seedUser(USER_EMAIL, 'USER');
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-HANDOVER-005.1: Complete on behalf', () => {
    test('admin complete assigns the asset and audits the admin actor', async ({ page }) => {
      const assetId = await seedAsset(ASSET_CHECKOUT, SERIAL_CHECKOUT, 'STOCK', null);
      await loginAdmin(page);
      const handoverId = await createCheckout(page, assetId, userId);

      const res = await page.request.post(`/api/p/handovers/${handoverId}/complete`, {
        headers: await authHeaders(page),
      });
      expect(res.ok()).toBeTruthy();

      await expect.poll(() => readAsset(SERIAL_CHECKOUT)).toEqual({ status: 'ASSIGNED', assignedUserId: userId });
      await expect.poll(() => readHandoverStatus(handoverId)).toBe('CONSUMED');
      await expect
        .poll(() => readTransactionActions(ASSET_CHECKOUT))
        .toEqual(expect.arrayContaining(['CUSTODY_COMPLETED_ON_BEHALF', 'ASSIGNED']));
    });
  });

  test.describe('AC-HANDOVER-005.2: Cancel handover', () => {
    test('admin cancel leaves the asset unchanged and closes the handover', async ({ page }) => {
      const assetId = await seedAsset(ASSET_CHECKOUT, SERIAL_CHECKOUT, 'STOCK', null);
      await loginAdmin(page);
      const handoverId = await createCheckout(page, assetId, userId);

      const res = await page.request.post(`/api/p/handovers/${handoverId}/cancel`, {
        headers: await authHeaders(page),
      });
      expect(res.ok()).toBeTruthy();

      await expect.poll(() => readAsset(SERIAL_CHECKOUT)).toEqual({ status: 'STOCK', assignedUserId: null });
      await expect.poll(() => readHandoverStatus(handoverId)).toBe('CANCELLED');
      await expect.poll(() => readTransactionActions(ASSET_CHECKOUT)).toEqual(
        expect.arrayContaining(['HANDOVER_CREATED', 'HANDOVER_CANCELLED']),
      );
    });
  });

  test.describe('AC-HANDOVER-005.3: Direct assign without handover', () => {
    test('PATCH assign still works when no open handover exists', async ({ page }) => {
      const assetId = await seedAsset(ASSET_DIRECT, SERIAL_DIRECT, 'STOCK', null);
      await loginAdmin(page);

      const res = await page.request.patch(`/api/p/assets/${assetId}`, {
        headers: await authHeaders(page),
        data: { status: 'ASSIGNED', assignedUserId: userId },
      });
      expect(res.ok()).toBeTruthy();

      await expect.poll(() => readAsset(SERIAL_DIRECT)).toEqual({ status: 'ASSIGNED', assignedUserId: userId });
    });
  });
});
