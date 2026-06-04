import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-ALERT-001: Warranty, return dates, and data-quality API
 *
 * "As an admin, I can set warranty and return dates on assets, and the system
 *  surfaces data-quality issues via API and overview counts."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-alert001-admin@test.com';
const ASSIGNEE_EMAIL = 'e2e-alert001-user@test.com';
const SERIAL_PREFIX = 'E2E-AL1-';

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: TEST_DB_NAME,
};

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function seedUser(
  email: string,
  displayName: string,
  role: 'ADMIN' | 'USER',
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(PASSWORD, salt);
  return withDb(async (client) => {
    const r = await client.query<{ id: number }>('SELECT id FROM role WHERE name = $1 LIMIT 1', [role]);
    const roleId = r.rows[0]?.id;
    if (!roleId) throw new Error(`${role} role not found`);
    await client.query('DELETE FROM "user" WHERE email = $1', [email]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO "user" (email, display_name, hashed, salt, role_id, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [email, displayName, hashed, salt, roleId, status],
    );
    return res.rows[0].id;
  });
}

async function seedAsset(opts: {
  name: string;
  serial: string;
  status?: string;
  assignedUserId?: string | null;
  warrantyEndDate?: string | null;
  expectedReturnDate?: string | null;
}): Promise<string> {
  return withDb(async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id, warranty_end_date, expected_return_date)
       VALUES ($1, '', $2, $3, $4, $5, $6) RETURNING id`,
      [
        opts.name,
        opts.serial,
        opts.status ?? 'STOCK',
        opts.assignedUserId ?? null,
        opts.warrantyEndDate ?? null,
        opts.expectedReturnDate ?? null,
      ],
    );
    return res.rows[0].id;
  });
}

async function readAsset(
  serial: string,
): Promise<{ warrantyEndDate: string | null; expectedReturnDate: string | null } | null> {
  return withDb(async (client) => {
    const res = await client.query<{ warranty_end_date: string | null; expected_return_date: string | null }>(
      `SELECT to_char(warranty_end_date, 'YYYY-MM-DD') AS warranty_end_date,
              to_char(expected_return_date, 'YYYY-MM-DD') AS expected_return_date
       FROM asset WHERE serial_number = $1`,
      [serial],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      warrantyEndDate: row.warranty_end_date,
      expectedReturnDate: row.expected_return_date,
    };
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number LIKE $1', [`${SERIAL_PREFIX}%`]);
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [[ADMIN_EMAIL, ASSIGNEE_EMAIL]]);
  });
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/admin\/overview/);
}

async function adminAuthHeader(page: Page): Promise<{ Authorization: string }> {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!token) throw new Error('Missing auth token after login');
  return { Authorization: `Bearer ${token}` };
}

test.describe('REQ-ALERT-001: Warranty, return dates, and data-quality', () => {
  let assigneeId: string;

  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'E2E Alert Admin', 'ADMIN');
    assigneeId = await seedUser(ASSIGNEE_EMAIL, 'E2E Alert User', 'USER');
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-ALERT-001.1: Admin can set warranty and return dates', () => {
    test('create asset with date fields persists to the database', async ({ page }) => {
      const serial = `${SERIAL_PREFIX}DATES`;
      const warranty = '2030-06-15';
      const returnDate = '2030-12-01';

      await loginAdmin(page);
      await page.goto('/admin/assets');
      await page.getByRole('button', { name: 'Create Asset' }).click();

      const modal = page.locator('div.z-200');
      await modal.getByLabel('Name', { exact: true }).fill('E2E AL1 Dates');
      await modal.getByLabel('Serial Number').fill(serial);
      await modal.locator('[data-testid="asset-expected-return-date"]').fill(returnDate);
      await modal.getByText(/Financial & depreciation|Financiero y depreciación/i).click();
      await modal.locator('[data-testid="asset-warranty-end-date"]').fill(warranty);
      await modal.getByRole('button', { name: 'Create Asset' }).click();

      await expect(page.getByText('E2E AL1 Dates')).toBeVisible();
      await expect.poll(async () => await readAsset(serial)).toEqual({
        warrantyEndDate: warranty,
        expectedReturnDate: returnDate,
      });
    });
  });

  test.describe('AC-ALERT-001.2: Return overdue in data-quality API', () => {
    test('seeded overdue asset appears in RETURN_OVERDUE report', async ({ page }) => {
      const serial = `${SERIAL_PREFIX}OVERDUE`;
      await seedAsset({
        name: 'E2E AL1 Overdue',
        serial,
        status: 'ASSIGNED',
        assignedUserId: assigneeId,
        expectedReturnDate: yesterdayIso(),
      });

      await loginAdmin(page);
      const headers = await adminAuthHeader(page);
      const res = await page.request.get('/api/p/reports/data-quality?issue=RETURN_OVERDUE', { headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const rows = body.data?.rows ?? [];
      expect(rows.some((r: { serialNumber: string }) => r.serialNumber === serial)).toBe(true);
    });
  });

  test.describe('AC-ALERT-001.3: Inactive assignee in data-quality API', () => {
    test('inactive user with assigned asset is reported', async ({ page }) => {
      const inactiveId = await seedUser('e2e-alert001-inactive@test.com', 'Inactive', 'USER', 'INACTIVE');
      const serial = `${SERIAL_PREFIX}INACTIVE`;
      await seedAsset({
        name: 'E2E AL1 Inactive',
        serial,
        status: 'ASSIGNED',
        assignedUserId: inactiveId,
      });

      await loginAdmin(page);
      const headers = await adminAuthHeader(page);
      const res = await page.request.get('/api/p/reports/data-quality?issue=INACTIVE_USER_ASSIGNED', {
        headers,
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const rows = body.data?.rows ?? [];
      expect(rows.some((r: { serialNumber: string }) => r.serialNumber === serial)).toBe(true);

      await withDb(async (client) => {
        await client.query('DELETE FROM "user" WHERE email = $1', ['e2e-alert001-inactive@test.com']);
      });
    });
  });

  test.describe('AC-ALERT-001.4: Stats overview attention counts', () => {
    test('returnOverdueCount is at least 1 when an overdue asset exists', async ({ page }) => {
      await seedAsset({
        name: 'E2E AL1 Stats',
        serial: `${SERIAL_PREFIX}STATS`,
        status: 'ASSIGNED',
        assignedUserId: assigneeId,
        expectedReturnDate: yesterdayIso(),
      });

      await loginAdmin(page);
      const headers = await adminAuthHeader(page);
      const res = await page.request.get('/api/p/stats/overview', { headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.data?.attention?.returnOverdueCount ?? 0).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('AC-ALERT-001.5: Overview attention tile', () => {
    test('RETURN_OVERDUE tile is visible with count >= 1', async ({ page }) => {
      await seedAsset({
        name: 'E2E AL1 Tile',
        serial: `${SERIAL_PREFIX}TILE`,
        status: 'ASSIGNED',
        assignedUserId: assigneeId,
        expectedReturnDate: yesterdayIso(),
      });

      await loginAdmin(page);
      await page.goto('/admin/overview');
      const tile = page.locator('[data-testid="attention-tile-RETURN_OVERDUE"]');
      await expect(tile).toBeVisible();
      await expect(tile).toContainText(/[1-9]/);
    });
  });
});
