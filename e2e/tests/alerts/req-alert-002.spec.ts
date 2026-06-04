import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-ALERT-002: In-app alerts (overview panel, bell, reports page)
 *
 * "As an admin, I see open issues on the overview, in the notification bell, and on
 *  the reports page; regular users do not see the bell."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-alert002-admin@test.com';
const USER_EMAIL = 'e2e-alert002-user@test.com';
const INACTIVE_EMAIL = 'e2e-alert002-inactive@test.com';
const SERIAL_PREFIX = 'E2E-AL2-';

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
  expectedReturnDate?: string | null;
}): Promise<string> {
  return withDb(async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id, expected_return_date)
       VALUES ($1, '', $2, $3, $4, $5) RETURNING id`,
      [
        opts.name,
        opts.serial,
        opts.status ?? 'STOCK',
        opts.assignedUserId ?? null,
        opts.expectedReturnDate ?? null,
      ],
    );
    return res.rows[0].id;
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number LIKE $1', [`${SERIAL_PREFIX}%`]);
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [
      [ADMIN_EMAIL, USER_EMAIL, INACTIVE_EMAIL],
    ]);
  });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function loginAdmin(page: Page): Promise<void> {
  await login(page, ADMIN_EMAIL);
  await page.waitForURL(/\/admin\/overview/);
}

async function adminAuthHeader(page: Page): Promise<{ Authorization: string }> {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!token) throw new Error('Missing auth token');
  return { Authorization: `Bearer ${token}` };
}

test.describe('REQ-ALERT-002: In-app admin alerts', () => {
  let assigneeId: string;
  let overdueAssetId: string;
  let inactiveAssetId: string;
  const overdueSerial = `${SERIAL_PREFIX}OVERDUE`;
  const inactiveSerial = `${SERIAL_PREFIX}INACTIVE`;

  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'E2E Alert2 Admin', 'ADMIN');
    assigneeId = await seedUser(USER_EMAIL, 'E2E Alert2 User', 'USER');
    const inactiveId = await seedUser(INACTIVE_EMAIL, 'Inactive User', 'USER', 'INACTIVE');

    overdueAssetId = await seedAsset({
      name: 'E2E AL2 Overdue',
      serial: overdueSerial,
      status: 'ASSIGNED',
      assignedUserId: assigneeId,
      expectedReturnDate: yesterdayIso(),
    });

    inactiveAssetId = await seedAsset({
      name: 'E2E AL2 Inactive',
      serial: inactiveSerial,
      status: 'ASSIGNED',
      assignedUserId: inactiveId,
    });
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-ALERT-002.1: Alerts API', () => {
    test('returns total and items for seeded issues', async ({ page }) => {
      await loginAdmin(page);
      const headers = await adminAuthHeader(page);
      const res = await page.request.get('/api/p/alerts?limit=10', { headers });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.data?.total ?? 0).toBeGreaterThanOrEqual(2);
      const serials = (body.data?.alerts ?? []).map((a: { serialNumber: string }) => a.serialNumber);
      expect(serials).toEqual(expect.arrayContaining([overdueSerial, inactiveSerial]));
    });
  });

  test.describe('AC-ALERT-002.2: Notification bell', () => {
    test('badge and dropdown list seeded alerts', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/overview');

      const bell = page.locator('[data-testid="notification-bell"]');
      await expect(bell).toBeVisible();
      await expect(page.locator('[data-testid="notification-bell-badge"]')).toBeVisible();

      await bell.click();
      await expect(page.locator(`[data-testid="notification-item-${overdueAssetId}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="notification-item-${inactiveAssetId}"]`)).toBeVisible();
    });
  });

  test.describe('AC-ALERT-002.3: Overview needs-attention panel', () => {
    test('lists attention rows linking to asset detail', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/overview');

      await expect(page.locator(`[data-testid="attention-row-${overdueAssetId}"]`)).toBeVisible();
      await page.locator(`[data-testid="attention-row-${overdueAssetId}"]`).click();
      await page.waitForURL(new RegExp(`/admin/assets/${overdueAssetId}`));
    });
  });

  test.describe('AC-ALERT-002.4: Reports page filter', () => {
    test('issue query param filters to RETURN_OVERDUE', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/reports?issue=RETURN_OVERDUE');

      await expect(page.locator(`[data-testid="report-row-${overdueAssetId}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="report-row-${inactiveAssetId}"]`)).toHaveCount(0);
    });
  });

  test.describe('AC-ALERT-002.5: Fixing data clears alert', () => {
    test('clearing return date removes overdue from API', async ({ page }) => {
      await loginAdmin(page);
      const headers = await adminAuthHeader(page);

      await page.request.patch(`/api/p/assets/${overdueAssetId}`, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: { expectedReturnDate: null },
      });

      const res = await page.request.get('/api/p/reports/data-quality?issue=RETURN_OVERDUE', { headers });
      const body = await res.json();
      const serials = (body.data?.rows ?? []).map((r: { serialNumber: string }) => r.serialNumber);
      expect(serials).not.toContain(overdueSerial);
    });
  });

  test.describe('AC-ALERT-002.6: Non-admin does not see bell', () => {
    test('regular user dashboard has no notification bell', async ({ page }) => {
      await login(page, USER_EMAIL);
      await page.waitForURL(/\/dashboard/);
      await expect(page.locator('[data-testid="notification-bell"]')).toHaveCount(0);
    });
  });

  test.describe('AC-ALERT-002.7: Nav includes Reports', () => {
    test('admin sidebar links to reports', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/overview');
      await page.locator('aside a[href="/admin/reports"]').click();
      await page.waitForURL(/\/admin\/reports/);
    });
  });
});
