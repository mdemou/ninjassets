import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-CATALOG-001: Manufacturer catalog
 *
 * "As an admin, I can create, rename, illustrate and delete manufacturers, and a
 *  manufacturer still referenced by assets cannot be deleted."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-catalog001-admin@test.com';
const NAME_PREFIX = 'E2E M1 ';
const SERIAL_PREFIX = 'E2E-M1-';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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
       VALUES ($1, 'E2E Catalog Admin', $2, $3, $4, 'ACTIVE')`,
      [ADMIN_EMAIL, hashed, salt, roleId],
    );
  });
}

async function seedManufacturer(name: string): Promise<string> {
  return withDb(async (client) => {
    const res = await client.query<{ id: string }>(
      'INSERT INTO manufacturer (name) VALUES ($1) RETURNING id',
      [name],
    );
    return res.rows[0].id;
  });
}

async function seedAssetWithManufacturer(serial: string, manufacturerId: string): Promise<void> {
  await withDb((client) =>
    client.query(
      `INSERT INTO asset (name, model, serial_number, status, manufacturer_id)
       VALUES ('E2E M1 Asset', '', $1, 'STOCK', $2)`,
      [serial, manufacturerId],
    ),
  );
}

async function manufacturerImageFilename(id: string): Promise<string | null> {
  return withDb(async (client) => {
    const res = await client.query<{ image_filename: string | null }>(
      'SELECT image_filename FROM manufacturer WHERE id = $1',
      [id],
    );
    return res.rows[0]?.image_filename ?? null;
  });
}

async function manufacturerNames(): Promise<string[]> {
  return withDb(async (client) => {
    const res = await client.query<{ name: string }>(
      'SELECT name FROM manufacturer WHERE name LIKE $1',
      [`${NAME_PREFIX}%`],
    );
    return res.rows.map((r) => r.name);
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number LIKE $1', [`${SERIAL_PREFIX}%`]);
    await client.query('DELETE FROM manufacturer WHERE name LIKE $1', [`${NAME_PREFIX}%`]);
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

test.describe('REQ-CATALOG-001: Manufacturer catalog', () => {
  test.beforeEach(async () => {
    await cleanup();
    await seedAdmin();
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-CATALOG-001.1: Creating a manufacturer', () => {
    test('a new manufacturer appears in the list', async ({ page }) => {
      const name = `${NAME_PREFIX}Acme Corp`;

      await loginAdmin(page);
      await page.goto('/admin/manufacturers');
      await page.getByRole('button', { name: 'Create Manufacturer' }).click();

      const modal = page.locator('div.z-200');
      await modal.getByLabel('Name').fill(name);
      await modal.getByRole('button', { name: 'Create Manufacturer' }).click();

      await expect(page.getByText(name)).toBeVisible();
      await expect.poll(async () => await manufacturerNames()).toContain(name);
    });
  });

  test.describe('AC-CATALOG-001.2: Renaming a manufacturer', () => {
    test('editing updates the manufacturer name', async ({ page }) => {
      const name = `${NAME_PREFIX}Globex`;
      const renamed = `${NAME_PREFIX}Globex International`;
      await seedManufacturer(name);

      await loginAdmin(page);
      await page.goto('/admin/manufacturers');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Edit Manufacturer' }).click();
      const modal = page.locator('div.z-200');
      await modal.getByLabel('Name').fill(renamed);
      await modal.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByText(renamed)).toBeVisible();
      await expect.poll(async () => await manufacturerNames()).toContain(renamed);
    });
  });

  test.describe('AC-CATALOG-001.3: Uploading a manufacturer image', () => {
    test('the uploaded image is stored and served back as webp', async ({ page }) => {
      const id = await seedManufacturer(`${NAME_PREFIX}Initech`);

      await loginAdmin(page);
      const result = await page.evaluate(
        async ({ mid, b64 }) => {
          const token = localStorage.getItem('auth_token');
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const upload = await fetch(`/api/p/manufacturers/${mid}/image`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
            body: bytes,
          });
          const get = await fetch(`/api/p/manufacturers/${mid}/image`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return {
            uploadStatus: upload.status,
            getStatus: get.status,
            contentType: get.headers.get('content-type'),
          };
        },
        { mid: id, b64: PNG_BASE64 },
      );

      expect(result.uploadStatus).toBeLessThan(400);
      expect(result.getStatus).toBe(200);
      expect(result.contentType).toContain('image/webp');
      await expect.poll(async () => await manufacturerImageFilename(id)).toBeTruthy();
    });
  });

  test.describe('AC-CATALOG-001.4: A referenced manufacturer cannot be deleted', () => {
    test('the delete dialog warns and disables deletion while assets reference it', async ({
      page,
    }) => {
      const name = `${NAME_PREFIX}Umbrella`;
      const id = await seedManufacturer(name);
      await seedAssetWithManufacturer(`${SERIAL_PREFIX}REF`, id);

      await loginAdmin(page);
      await page.goto('/admin/manufacturers');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Delete Manufacturer' }).click();
      const modal = page.locator('div.z-200');
      await expect(modal.getByText(/asset\(s\) reference this manufacturer/i)).toBeVisible();
      await expect(modal.getByRole('button', { name: 'Delete Manufacturer' })).toBeDisabled();
    });

    test('a manufacturer with no assets can be deleted', async ({ page }) => {
      const name = `${NAME_PREFIX}Soylent`;
      await seedManufacturer(name);

      await loginAdmin(page);
      await page.goto('/admin/manufacturers');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Delete Manufacturer' }).click();
      const modal = page.locator('div.z-200');
      await modal.getByRole('button', { name: 'Delete Manufacturer' }).click();

      await expect.poll(async () => await manufacturerNames()).not.toContain(name);
    });
  });
});
