import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-HANDOVER-001: Verified checkout
 *
 * "As an admin, I can start a verified checkout; the asset stays STOCK until the
 *  recipient confirms, then becomes ASSIGNED with a full audit trail."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-ho001-admin@test.com';
const USER_EMAIL = 'e2e-ho001-user@test.com';
const USER_NAME = 'E2E HO001 Assignee';
const ASSET_NAME = 'E2E HO001 Laptop';
const SERIAL = 'E2E-HO1-CHECKOUT';
const UI_CREATE_NAME = 'E2E HO001 UI Create';
const UI_CREATE_SERIAL = 'E2E-HO1-UI-CREATE';

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

async function seedAsset(status: string, assignedUserId: string | null): Promise<string> {
  return withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number = $1', [SERIAL]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id)
       VALUES ($1, '', $2, $3, $4) RETURNING id`,
      [ASSET_NAME, SERIAL, status, assignedUserId],
    );
    return res.rows[0].id;
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM transaction WHERE asset_name = ANY($1)', [[ASSET_NAME, UI_CREATE_NAME]]);
    await client.query('DELETE FROM asset WHERE serial_number = ANY($1)', [[SERIAL, UI_CREATE_SERIAL]]);
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

async function createCheckoutHandover(
  page: Page,
  assetId: string,
  targetUserId: string,
): Promise<{ handoverId: string; acceptPath: string }> {
  const headers = await authHeaders(page);
  const res = await page.request.post(`/api/p/assets/${assetId}/handovers`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
    data: { type: 'CHECK_OUT', targetUserId, sendEmail: false },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: { handover: { id: string }; acceptUrl: string } };
  const acceptUrl = body.data.acceptUrl;
  expect(acceptUrl).toBeTruthy();
  const url = new URL(acceptUrl);
  return { handoverId: body.data.handover.id, acceptPath: `${url.pathname}${url.search}` };
}

async function readAsset(
  serial: string = SERIAL,
): Promise<{ status: string; assignedUserId: string | null } | null> {
  return withDb(async (client) => {
    const res = await client.query<{ status: string; assigned_user_id: string | null }>(
      'SELECT status, assigned_user_id FROM asset WHERE serial_number = $1',
      [serial],
    );
    const row = res.rows[0];
    return row ? { status: row.status, assignedUserId: row.assigned_user_id } : null;
  });
}

async function readOpenHandoverForSerial(serial: string): Promise<string | null> {
  return withDb(async (client) => {
    const res = await client.query<{ status: string }>(
      `SELECT h.status FROM handover h
       INNER JOIN asset a ON a.id = h.asset_id
       WHERE a.serial_number = $1 AND h.status = 'OPEN'`,
      [serial],
    );
    return res.rows[0]?.status ?? null;
  });
}

async function readHandoverStatus(handoverId: string): Promise<string | null> {
  return withDb(async (client) => {
    const res = await client.query<{ status: string }>('SELECT status FROM handover WHERE id = $1', [handoverId]);
    return res.rows[0]?.status ?? null;
  });
}

async function readTransactionActions(): Promise<string[]> {
  return withDb(async (client) => {
    const res = await client.query<{ action: string }>(
      'SELECT action FROM transaction WHERE asset_name = $1 ORDER BY date_created',
      [ASSET_NAME],
    );
    return res.rows.map((r) => r.action);
  });
}

test.describe('REQ-HANDOVER-001: Verified checkout', () => {
  let assigneeId: string;
  let assetId: string;

  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'E2E HO001 Admin', 'ADMIN');
    assigneeId = await seedUser(USER_EMAIL, USER_NAME, 'USER');
    assetId = await seedAsset('STOCK', null);
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-HANDOVER-001.1: Checkout keeps asset in STOCK until confirmed', () => {
    test('starting CHECK_OUT leaves the asset STOCK with an open handover', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      await page.waitForURL(/\/admin\/overview/);

      const { handoverId } = await createCheckoutHandover(page, assetId, assigneeId);

      await expect.poll(readAsset).toEqual({ status: 'STOCK', assignedUserId: null });
      await expect.poll(() => readHandoverStatus(handoverId)).toBe('OPEN');
    });
  });

  test.describe('AC-HANDOVER-001.2: Recipient accepts via magic link', () => {
    test('the assignee confirms on the accept page and the asset becomes ASSIGNED', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      await page.waitForURL(/\/admin\/overview/);
      const { acceptPath } = await createCheckoutHandover(page, assetId, assigneeId);

      await login(page, USER_EMAIL);
      await page.waitForURL(/\/dashboard/);
      await page.goto(acceptPath);

      await expect(page.getByRole('heading', { name: 'Confirm you are receiving this asset' })).toBeVisible();
      await expect(page.getByText(ASSET_NAME)).toBeVisible();
      await expect(page.getByText(SERIAL)).toBeVisible();
      await page.getByRole('button', { name: 'Confirm receipt' }).click();

      await expect(page.getByText('You have confirmed receipt of this asset.')).toBeVisible();
      await expect.poll(readAsset).toEqual({ status: 'ASSIGNED', assignedUserId: assigneeId });
    });
  });

  test.describe('AC-HANDOVER-001.3: Audit log records custody acceptance', () => {
    test('accepting emits CUSTODY_ACCEPTED and assignment events', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      await page.waitForURL(/\/admin\/overview/);
      const { acceptPath } = await createCheckoutHandover(page, assetId, assigneeId);

      await login(page, USER_EMAIL);
      await page.waitForURL(/\/dashboard/);
      await page.goto(acceptPath);
      await page.getByRole('button', { name: 'Confirm receipt' }).click();
      await expect(page.getByText('You have confirmed receipt of this asset.')).toBeVisible();

      await expect
        .poll(readTransactionActions)
        .toEqual(expect.arrayContaining(['HANDOVER_CREATED', 'CUSTODY_ACCEPTED', 'ASSIGNED', 'STATUS_CHANGED']));
    });
  });

  test.describe('AC-HANDOVER-001.4: Pending panel on personal pages', () => {
    test('the assignee sees pending handovers on dashboard and My Assets', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      await page.waitForURL(/\/admin\/overview/);
      const { handoverId } = await createCheckoutHandover(page, assetId, assigneeId);

      await login(page, USER_EMAIL);
      await page.waitForURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Awaiting your confirmation' })).toBeVisible();
      await expect(page.getByTestId(`my-pending-handover-${handoverId}`)).toBeVisible();

      await page.goto('/assets');
      await expect(page.getByRole('heading', { name: 'Awaiting your confirmation' })).toBeVisible();
      await expect(page.getByTestId(`my-pending-handover-${handoverId}`)).toBeVisible();
    });
  });

  test.describe('AC-HANDOVER-001.5: In-app confirm from pending panel', () => {
    test('the assignee can confirm from the dashboard panel without the email link', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      await page.waitForURL(/\/admin\/overview/);
      await createCheckoutHandover(page, assetId, assigneeId);

      await login(page, USER_EMAIL);
      await page.waitForURL(/\/dashboard/);
      await page.getByRole('button', { name: 'Confirm' }).click();

      await expect(page.getByText('Receipt confirmed.')).toBeVisible();
      await expect.poll(readAsset).toEqual({ status: 'ASSIGNED', assignedUserId: assigneeId });
      await expect(page.getByRole('heading', { name: 'Awaiting your confirmation' })).toHaveCount(0);
    });
  });

  test.describe('AC-HANDOVER-001.6: Admin create form defaults to verified checkout', () => {
    test('assigning on create leaves the asset STOCK with an open handover', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      await page.waitForURL(/\/admin\/overview/);
      await page.goto('/admin/assets');
      await page.getByRole('button', { name: 'Create Asset' }).click();

      const modal = page.locator('div.z-200');
      await modal.getByLabel('Name', { exact: true }).fill(UI_CREATE_NAME);
      await modal.getByLabel('Serial Number').fill(UI_CREATE_SERIAL);
      await modal.getByLabel('Assigned To').click();
      await page.getByPlaceholder(/type to search/i).fill(USER_EMAIL);
      await page.getByRole('option', { name: USER_EMAIL }).click();

      await expect(modal.getByRole('checkbox')).toBeChecked();
      await modal.getByRole('button', { name: 'Assign with verification' }).click();

      await expect(page.getByText(UI_CREATE_NAME)).toBeVisible();
      await expect.poll(async () => await readAsset(UI_CREATE_SERIAL)).toEqual({
        status: 'STOCK',
        assignedUserId: null,
      });
      await expect.poll(async () => await readOpenHandoverForSerial(UI_CREATE_SERIAL)).toBe('OPEN');
    });
  });
});
