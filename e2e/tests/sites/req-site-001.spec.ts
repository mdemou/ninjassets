import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-SITE-001: Site and location management
 *
 * "As an admin, I can create sites with coordinates on a map, and when I delete a
 *  site I can choose whether its linked assets are unlinked or deleted too."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-site001-admin@test.com';
const NAME_PREFIX = 'E2E S1 ';
const SERIAL_PREFIX = 'E2E-S1-';

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
       VALUES ($1, 'E2E Site Admin', $2, $3, $4, 'ACTIVE')`,
      [ADMIN_EMAIL, hashed, salt, roleId],
    );
  });
}

async function seedSite(name: string): Promise<string> {
  return withDb(async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO site (name, latitude, longitude) VALUES ($1, 40.4168, -3.7038) RETURNING id`,
      [name],
    );
    return res.rows[0].id;
  });
}

async function seedAssetAtSite(name: string, serial: string, siteId: string): Promise<void> {
  await withDb((client) =>
    client.query(
      `INSERT INTO asset (name, model, serial_number, status, site_id)
       VALUES ($1, '', $2, 'STOCK', $3)`,
      [name, serial, siteId],
    ),
  );
}

async function countSites(name: string): Promise<number> {
  return withDb(async (client) => {
    const res = await client.query<{ count: string }>('SELECT COUNT(*) FROM site WHERE name = $1', [
      name,
    ]);
    return Number(res.rows[0].count);
  });
}

async function getSiteAddress(name: string): Promise<string | null> {
  return withDb(async (client) => {
    const res = await client.query<{ address: string | null }>(
      'SELECT address FROM site WHERE name = $1',
      [name],
    );
    return res.rows[0]?.address ?? null;
  });
}

async function countAssets(serial: string): Promise<number> {
  return withDb(async (client) => {
    const res = await client.query<{ count: string }>(
      'SELECT COUNT(*) FROM asset WHERE serial_number = $1',
      [serial],
    );
    return Number(res.rows[0].count);
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number LIKE $1', [`${SERIAL_PREFIX}%`]);
    await client.query('DELETE FROM site WHERE name LIKE $1', [`${NAME_PREFIX}%`]);
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

test.describe('REQ-SITE-001: Site and location management', () => {
  test.beforeEach(async () => {
    await cleanup();
    await seedAdmin();
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-SITE-001.1: Creating a site with coordinates and a map picker', () => {
    test('the create form shows a map and the new site is persisted', async ({ page }) => {
      const name = `${NAME_PREFIX}Madrid HQ`;

      await loginAdmin(page);
      await page.goto('/admin/sites');
      await page.getByRole('button', { name: 'Create Site' }).click();

      const modal = page.locator('div.z-200');
      await expect(modal.locator('.leaflet-container')).toBeVisible();

      const address = 'Calle Mayor 1, Madrid';
      await modal.getByLabel('Name', { exact: true }).fill(name);
      await modal.getByLabel('Address').fill(address);
      await modal.getByLabel('Latitude').fill('40.4168');
      await modal.getByLabel('Longitude').fill('-3.7038');
      await modal.getByRole('button', { name: 'Create Site' }).click();

      await expect(page.getByText(name)).toBeVisible();
      await expect(page.getByText(address)).toBeVisible();
      await expect.poll(async () => await countSites(name)).toBe(1);
      await expect.poll(async () => await getSiteAddress(name)).toBe(address);
      // The overview map renders once at least one site exists.
      await expect(page.locator('.leaflet-container').first()).toBeVisible();
    });
  });

  test.describe('AC-SITE-001.1b: Site address on create and detail edit', () => {
    test('address can be set on create and updated on the detail page', async ({ page }) => {
      const name = `${NAME_PREFIX}With Address`;
      const createAddress = 'Plaza Mayor 2';
      const updatedAddress = 'Gran Vía 10';

      await loginAdmin(page);
      await page.goto('/admin/sites');
      await page.getByRole('button', { name: 'Create Site' }).click();

      const modal = page.locator('div.z-200');
      await modal.getByLabel('Name', { exact: true }).fill(name);
      await modal.getByLabel('Address').fill(createAddress);
      await modal.getByLabel('Latitude').fill('40.4168');
      await modal.getByLabel('Longitude').fill('-3.7038');
      await modal.getByRole('button', { name: 'Create Site' }).click();

      await expect(page.getByText(createAddress)).toBeVisible();
      await page.getByText(name).click();
      await page.waitForURL(/\/admin\/sites\/[0-9a-f-]+$/);

      const addressField = page.getByLabel('Address');
      await expect(addressField).toHaveValue(createAddress);
      await addressField.fill(updatedAddress);
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expect(page.getByLabel('Address')).toHaveValue(updatedAddress);
      await expect.poll(async () => await getSiteAddress(name)).toBe(updatedAddress);
    });
  });

  test.describe('AC-SITE-001.2: Deleting a site with no linked assets', () => {
    test('a site with no assets is removed', async ({ page }) => {
      const name = `${NAME_PREFIX}Empty Warehouse`;
      await seedSite(name);

      await loginAdmin(page);
      await page.goto('/admin/sites');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Delete Site' }).click();
      const modal = page.locator('div.z-200');
      await modal.getByRole('button', { name: 'Delete Site' }).click();

      await expect.poll(async () => await countSites(name)).toBe(0);
    });
  });

  test.describe('AC-SITE-001.3: Deleting a site and its linked assets', () => {
    test('checking "also delete these assets" removes the site and its assets', async ({ page }) => {
      const name = `${NAME_PREFIX}Data Center`;
      const serial = `${SERIAL_PREFIX}LINKED`;
      const siteId = await seedSite(name);
      await seedAssetAtSite('E2E S1 Rack Server', serial, siteId);

      await loginAdmin(page);
      await page.goto('/admin/sites');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Delete Site' }).click();
      const modal = page.locator('div.z-200');
      // The dialog reports the linked assets and offers to delete them too.
      await expect(modal.getByText(/are currently linked to this site/i)).toBeVisible();
      await modal.getByLabel(/also delete these assets/i).check();
      await modal.getByRole('button', { name: 'Delete Site' }).click();

      await expect.poll(async () => await countSites(name)).toBe(0);
      await expect.poll(async () => await countAssets(serial)).toBe(0);
    });
  });
});
