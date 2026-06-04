import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-CATALOG-002: Vendor catalog
 *
 * "As an admin, I can create, rename and delete vendors, and a vendor still
 *  referenced by assets cannot be deleted."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-catalog002-admin@test.com';
const NAME_PREFIX = 'E2E V1 ';
const SERIAL_PREFIX = 'E2E-V1-';

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

async function seedAdmin(): Promise<void> {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(PASSWORD, salt);
  await withDb(async (client) => {
    const r = await client.query<{ id: number }>("SELECT id FROM role WHERE name = 'ADMIN' LIMIT 1");
    const roleId = r.rows[0]?.id;
    if (!roleId) throw new Error('ADMIN role not found');
    await client.query('DELETE FROM "user" WHERE email = $1', [ADMIN_EMAIL]);
    await client.query(
      `INSERT INTO "user" (email, display_name, hashed, salt, role_id, status)
       VALUES ($1, 'E2E Vendor Admin', $2, $3, $4, 'ACTIVE')`,
      [ADMIN_EMAIL, hashed, salt, roleId],
    );
  });
}

async function seedVendor(name: string): Promise<string> {
  return withDb(async (client) => {
    const res = await client.query<{ id: string }>(
      'INSERT INTO vendor (name) VALUES ($1) RETURNING id',
      [name],
    );
    return res.rows[0].id;
  });
}

async function seedAssetWithVendor(serial: string, vendorId: string): Promise<void> {
  await withDb((client) =>
    client.query(
      `INSERT INTO asset (name, model, serial_number, status, vendor_id)
       VALUES ('E2E V1 Asset', '', $1, 'STOCK', $2)`,
      [serial, vendorId],
    ),
  );
}

async function vendorNames(): Promise<string[]> {
  return withDb(async (client) => {
    const res = await client.query<{ name: string }>('SELECT name FROM vendor WHERE name LIKE $1', [
      `${NAME_PREFIX}%`,
    ]);
    return res.rows.map((r) => r.name);
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number LIKE $1', [`${SERIAL_PREFIX}%`]);
    await client.query('DELETE FROM vendor WHERE name LIKE $1', [`${NAME_PREFIX}%`]);
    await client.query('DELETE FROM "user" WHERE email = $1', [ADMIN_EMAIL]);
  });
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/admin\/overview/);
}

test.describe('REQ-CATALOG-002: Vendor catalog', () => {
  test.beforeEach(async () => {
    await cleanup();
    await seedAdmin();
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-CATALOG-002.1: Creating a vendor', () => {
    test('a new vendor appears in the list', async ({ page }) => {
      const name = `${NAME_PREFIX}Northwind`;

      await loginAdmin(page);
      await page.goto('/admin/vendors');
      await page.getByRole('button', { name: 'Create Vendor' }).click();

      const modal = page.locator('div.z-200');
      await modal.getByLabel('Name').fill(name);
      await modal.getByRole('button', { name: 'Create Vendor' }).click();

      await expect(page.getByText(name)).toBeVisible();
      await expect.poll(async () => await vendorNames()).toContain(name);
    });
  });

  test.describe('AC-CATALOG-002.2: Renaming a vendor', () => {
    test('editing updates the vendor name', async ({ page }) => {
      const name = `${NAME_PREFIX}Contoso`;
      const renamed = `${NAME_PREFIX}Contoso Ltd`;
      await seedVendor(name);

      await loginAdmin(page);
      await page.goto('/admin/vendors');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Edit Vendor' }).click();
      const modal = page.locator('div.z-200');
      await modal.getByLabel('Name').fill(renamed);
      await modal.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByText(renamed)).toBeVisible();
      await expect.poll(async () => await vendorNames()).toContain(renamed);
    });
  });

  test.describe('AC-CATALOG-002.3: A referenced vendor cannot be deleted', () => {
    test('the delete dialog warns and disables deletion while assets reference it', async ({
      page,
    }) => {
      const name = `${NAME_PREFIX}Cyberdyne`;
      const id = await seedVendor(name);
      await seedAssetWithVendor(`${SERIAL_PREFIX}REF`, id);

      await loginAdmin(page);
      await page.goto('/admin/vendors');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Delete Vendor' }).click();
      const modal = page.locator('div.z-200');
      await expect(modal.getByText(/asset\(s\) reference this vendor/i)).toBeVisible();
      await expect(modal.getByRole('button', { name: 'Delete Vendor' })).toBeDisabled();
    });

    test('a vendor with no assets can be deleted', async ({ page }) => {
      const name = `${NAME_PREFIX}Stark Industries`;
      await seedVendor(name);

      await loginAdmin(page);
      await page.goto('/admin/vendors');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Delete Vendor' }).click();
      const modal = page.locator('div.z-200');
      await modal.getByRole('button', { name: 'Delete Vendor' }).click();

      await expect.poll(async () => await vendorNames()).not.toContain(name);
    });
  });
});
