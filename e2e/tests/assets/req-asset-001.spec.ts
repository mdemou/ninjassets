import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-ASSET-001: Admin asset management
 *
 * "As an admin, I can create, assign, search, edit and delete assets, and the
 *  STOCK/ASSIGNED lifecycle keeps an owner only while an asset is ASSIGNED."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-asset001-admin@test.com';
const ASSIGNEE_EMAIL = 'e2e-asset001-user@test.com';
const ASSIGNEE_NAME = 'E2E Asset Assignee';
const SERIAL_PREFIX = 'E2E-A1-';

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

async function seedAsset(opts: {
  name: string;
  serial: string;
  status?: string;
  assignedUserId?: string | null;
}): Promise<string> {
  return withDb(async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id)
       VALUES ($1, '', $2, $3, $4) RETURNING id`,
      [opts.name, opts.serial, opts.status ?? 'STOCK', opts.assignedUserId ?? null],
    );
    return res.rows[0].id;
  });
}

async function readAsset(
  serial: string,
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

test.describe('REQ-ASSET-001: Admin asset management', () => {
  let assigneeId: string;

  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'E2E Asset Admin', 'ADMIN');
    assigneeId = await seedUser(ASSIGNEE_EMAIL, ASSIGNEE_NAME, 'USER');
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-ASSET-001.1: Creating an asset', () => {
    test('a new asset appears in the list and is persisted as STOCK', async ({ page }) => {
      const name = 'E2E A1 Created Laptop';
      const serial = `${SERIAL_PREFIX}CREATE`;

      await loginAdmin(page);
      await page.goto('/admin/assets');
      await page.getByRole('button', { name: 'Create Asset' }).click();

      const modal = page.locator('div.z-200');
      await modal.getByLabel('Name', { exact: true }).fill(name);
      await modal.getByLabel('Serial Number').fill(serial);
      await modal.getByRole('button', { name: 'Create Asset' }).click();

      await expect(page.getByText(name)).toBeVisible();
      await expect.poll(async () => (await readAsset(serial))?.status).toBe('STOCK');
    });
  });

  test.describe('AC-ASSET-001.2: Assigning a user moves the asset to ASSIGNED', () => {
    test('picking an assignee on create stores the owner and ASSIGNED status', async ({ page }) => {
      const name = 'E2E A1 Assigned Monitor';
      const serial = `${SERIAL_PREFIX}ASSIGN`;

      await loginAdmin(page);
      await page.goto('/admin/assets');
      await page.getByRole('button', { name: 'Create Asset' }).click();

      const modal = page.locator('div.z-200');
      await modal.getByLabel('Name', { exact: true }).fill(name);
      await modal.getByLabel('Serial Number').fill(serial);

      // Choosing an assignee implies ASSIGNED (the combobox menu is portalled to body).
      await modal.getByLabel('Assigned To').click();
      await page.getByPlaceholder(/type to search/i).fill(ASSIGNEE_EMAIL);
      await page.getByRole('option', { name: ASSIGNEE_EMAIL }).click();
      // Custody verification is checked by default; uncheck for direct (unverified) assign.
      await modal.getByRole('checkbox').uncheck();

      await modal.getByRole('button', { name: 'Create Asset' }).click();

      await expect(page.getByText(name)).toBeVisible();
      await expect.poll(async () => await readAsset(serial)).toEqual({
        status: 'ASSIGNED',
        assignedUserId: assigneeId,
      });
    });
  });

  test.describe('AC-ASSET-001.3: Leaving ASSIGNED clears the owner', () => {
    test('switching an assigned asset to In Stock drops the assignee', async ({ page }) => {
      const name = 'E2E A1 Lifecycle Tablet';
      const serial = `${SERIAL_PREFIX}LIFECYCLE`;
      await seedAsset({ name, serial, status: 'ASSIGNED', assignedUserId: assigneeId });

      await loginAdmin(page);
      await page.goto('/admin/assets');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Edit Asset' }).click();
      const modal = page.locator('div.z-200');
      await modal.getByLabel('Status').click();
      await page.getByRole('option', { name: 'In Stock' }).click();
      await modal.getByRole('button', { name: 'Save Changes' }).click();

      await expect.poll(async () => await readAsset(serial)).toEqual({
        status: 'STOCK',
        assignedUserId: null,
      });
    });
  });

  test.describe('AC-ASSET-001.4: Searching filters the list', () => {
    test('the search box narrows results to matching assets', async ({ page }) => {
      const alpha = 'E2E A1 Alpha Laptop';
      const bravo = 'E2E A1 Bravo Phone';
      await seedAsset({ name: alpha, serial: `${SERIAL_PREFIX}ALPHA` });
      await seedAsset({ name: bravo, serial: `${SERIAL_PREFIX}BRAVO` });

      await loginAdmin(page);
      await page.goto('/admin/assets');
      await expect(page.getByText(alpha)).toBeVisible();
      await expect(page.getByText(bravo)).toBeVisible();

      await page.getByPlaceholder(/search by name/i).fill('Alpha');
      await expect(page.getByText(alpha)).toBeVisible();
      await expect(page.getByText(bravo)).toHaveCount(0);
    });
  });

  test.describe('AC-ASSET-001.5: Deleting an asset', () => {
    test('confirming deletion removes the asset', async ({ page }) => {
      const name = 'E2E A1 Disposable Dock';
      const serial = `${SERIAL_PREFIX}DELETE`;
      await seedAsset({ name, serial });

      await loginAdmin(page);
      await page.goto('/admin/assets');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Delete Asset' }).click();
      const modal = page.locator('div.z-200');
      await modal.getByRole('button', { name: 'Delete Asset' }).click();

      await expect(page.getByText(name)).toHaveCount(0);
      await expect.poll(async () => await readAsset(serial)).toBeNull();
    });
  });

  test.describe('AC-ASSET-001.7: Duplicate serial number', () => {
    test('creating an asset with an existing serial shows an error and does not add a row', async ({
      page,
    }) => {
      const existingName = 'E2E A1 Existing Laptop';
      const serial = `${SERIAL_PREFIX}DUP`;
      await seedAsset({ name: existingName, serial });

      await loginAdmin(page);
      await page.goto('/admin/assets');
      await page.getByRole('button', { name: 'Create Asset' }).click();

      const modal = page.locator('div.z-200');
      await modal.getByLabel('Name', { exact: true }).fill('E2E A1 Duplicate Attempt');
      await modal.getByLabel('Serial Number').fill(serial);
      await modal.getByRole('button', { name: 'Create Asset' }).click();

      await expect(modal.getByText(/serial number already exists/i)).toBeVisible();
      await expect(page.getByText('E2E A1 Duplicate Attempt')).toHaveCount(0);
      await expect.poll(async () => {
        const res = await withDb(async (client) =>
          client.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM asset WHERE serial_number = $1', [
            serial,
          ]),
        );
        return res.rows[0].n;
      }).toBe(1);
    });
  });

  test.describe('AC-ASSET-001.6: Direct assign blocked by open handover', () => {
    test('PATCH to assign is rejected while a verified checkout is pending', async ({ page }) => {
      const name = 'E2E A1 Blocked Laptop';
      const serial = `${SERIAL_PREFIX}BLOCKED`;
      const assetId = await seedAsset({ name, serial, status: 'STOCK' });

      await loginAdmin(page);
      const token = await page.evaluate(() => localStorage.getItem('auth_token'));
      expect(token).toBeTruthy();

      const handoverRes = await page.request.post(`/api/p/assets/${assetId}/handovers`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { type: 'CHECK_OUT', targetUserId: assigneeId, sendEmail: false },
      });
      expect(handoverRes.ok()).toBeTruthy();

      const patchRes = await page.request.patch(`/api/p/assets/${assetId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { status: 'ASSIGNED', assignedUserId: assigneeId },
      });
      expect(patchRes.status()).toBe(409);
      await expect.poll(async () => (await readAsset(serial))?.status).toBe('STOCK');
    });
  });
});
