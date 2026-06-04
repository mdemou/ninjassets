import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-CATEGORY-003: Asset categories and custom fields
 *
 * "As an admin, I can define categories with type-specific custom fields, fill those
 *  fields on an asset, and a category still referenced by assets cannot be deleted."
 *
 * Mirrors docs/spec-asset-categories.md §14.
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-category003-admin@test.com';
const NAME_PREFIX = 'E2E CT3 ';
const SERIAL_PREFIX = 'E2E-CT3-';

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: TEST_DB_NAME,
};

type FieldSeed = {
  fieldKey: string;
  label: string;
  dataType: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'SELECT' | 'MULTI_SELECT';
  required?: boolean;
  options?: string[] | null;
  sortOrder?: number;
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
       VALUES ($1, 'E2E Category Admin', $2, $3, $4, 'ACTIVE')`,
      [ADMIN_EMAIL, hashed, salt, roleId],
    );
  });
}

async function seedCategory(name: string, fields: FieldSeed[] = []): Promise<string> {
  return withDb(async (client) => {
    const res = await client.query<{ id: string }>(
      'INSERT INTO category (name) VALUES ($1) RETURNING id',
      [name],
    );
    const categoryId = res.rows[0].id;
    for (const [index, f] of fields.entries()) {
      await client.query(
        `INSERT INTO category_field
           (category_id, field_key, label, data_type, required, options, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          categoryId,
          f.fieldKey,
          f.label,
          f.dataType,
          f.required ?? false,
          f.options ? JSON.stringify(f.options) : null,
          f.sortOrder ?? index,
        ],
      );
    }
    return categoryId;
  });
}

async function categoryNames(): Promise<string[]> {
  return withDb(async (client) => {
    const res = await client.query<{ name: string }>(
      'SELECT name FROM category WHERE name LIKE $1',
      [`${NAME_PREFIX}%`],
    );
    return res.rows.map((r) => r.name);
  });
}

async function categoryFieldsOf(categoryId: string): Promise<FieldSeed[]> {
  return withDb(async (client) => {
    const res = await client.query<{
      field_key: string;
      label: string;
      data_type: FieldSeed['dataType'];
      required: boolean;
      sort_order: number;
    }>(
      'SELECT field_key, label, data_type, required, sort_order FROM category_field WHERE category_id = $1 ORDER BY sort_order ASC',
      [categoryId],
    );
    return res.rows.map((r) => ({
      fieldKey: r.field_key,
      label: r.label,
      dataType: r.data_type,
      required: r.required,
      sortOrder: r.sort_order,
    }));
  });
}

async function categoryIdByName(name: string): Promise<string | null> {
  return withDb(async (client) => {
    const res = await client.query<{ id: string }>('SELECT id FROM category WHERE name = $1', [name]);
    return res.rows[0]?.id ?? null;
  });
}

async function readAsset(serial: string): Promise<{
  id: string;
  categoryId: string | null;
  customFields: Record<string, unknown>;
} | null> {
  return withDb(async (client) => {
    const res = await client.query<{
      id: string;
      category_id: string | null;
      custom_fields: Record<string, unknown> | null;
    }>('SELECT id, category_id, custom_fields FROM asset WHERE serial_number = $1', [serial]);
    const row = res.rows[0];
    return row
      ? { id: row.id, categoryId: row.category_id, customFields: row.custom_fields ?? {} }
      : null;
  });
}

async function hasTransaction(assetId: string, action: string): Promise<boolean> {
  return withDb(async (client) => {
    const res = await client.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM transaction WHERE asset_id = $1 AND action = $2',
      [assetId, action],
    );
    return res.rows[0].n > 0;
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    // Assets reference categories with ON DELETE RESTRICT, so delete assets first.
    await client.query('DELETE FROM asset WHERE serial_number LIKE $1', [`${SERIAL_PREFIX}%`]);
    await client.query('DELETE FROM category WHERE name LIKE $1', [`${NAME_PREFIX}%`]);
    await client.query('DELETE FROM "user" WHERE email = $1', [ADMIN_EMAIL]);
  });
}

async function loginAdmin(page: Page): Promise<string> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/admin\/overview/);
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  expect(token).toBeTruthy();
  return token as string;
}

test.describe('REQ-CATEGORY-003: Asset categories and custom fields', () => {
  test.beforeEach(async () => {
    await cleanup();
    await seedAdmin();
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-CATEGORY-003.1: Creating a category with fields', () => {
    test('a new category with a custom field is listed and persisted', async ({ page }) => {
      const name = `${NAME_PREFIX}Laptop`;

      await loginAdmin(page);
      await page.goto('/admin/categories');
      await page.getByRole('button', { name: 'Create Category' }).click();

      const modal = page.locator('div.z-200');
      await modal.getByLabel('Name', { exact: true }).fill(name);
      await modal.getByRole('button', { name: 'Add field' }).click();
      await modal.getByLabel('Label', { exact: true }).fill('RAM');
      await modal.getByRole('checkbox', { name: 'Required' }).check();
      await modal.getByRole('button', { name: 'Create Category' }).click();

      await expect(page.getByText(name)).toBeVisible();
      await expect.poll(async () => await categoryNames()).toContain(name);

      const id = await categoryIdByName(name);
      expect(id).toBeTruthy();
      await expect
        .poll(async () => await categoryFieldsOf(id as string))
        .toEqual([{ fieldKey: 'ram', label: 'RAM', dataType: 'TEXT', required: true, sortOrder: 0 }]);
    });

    test('the category detail API returns fields ordered by sort order', async ({ page }) => {
      const name = `${NAME_PREFIX}Server`;
      const id = await seedCategory(name, [
        { fieldKey: 'cpu', label: 'CPU', dataType: 'TEXT', sortOrder: 0 },
        { fieldKey: 'rack', label: 'Rack position', dataType: 'NUMBER', sortOrder: 1 },
      ]);

      const token = await loginAdmin(page);
      const res = await page.request.get(`/api/p/categories/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as { data: { category: { fields: { fieldKey: string }[] } } };
      expect(body.data.category.fields.map((f) => f.fieldKey)).toEqual(['cpu', 'rack']);
    });
  });

  test.describe('AC-CATEGORY-003.2: Asset with valid custom values is persisted', () => {
    test('creating an asset with a category and custom fields stores and returns them', async ({
      page,
    }) => {
      const categoryName = `${NAME_PREFIX}Laptop`;
      const categoryId = await seedCategory(categoryName, [
        { fieldKey: 'ram', label: 'RAM', dataType: 'TEXT', required: true },
        { fieldKey: 'os', label: 'OS', dataType: 'SELECT', options: ['Windows', 'macOS', 'Linux'] },
      ]);
      const serial = `${SERIAL_PREFIX}CREATE`;

      const token = await loginAdmin(page);
      const res = await page.request.post('/api/p/assets', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name: `${NAME_PREFIX}MacBook`,
          serialNumber: serial,
          categoryId,
          customFields: { ram: '16GB', os: 'macOS' },
        },
      });
      expect(res.status()).toBe(200);
      const created = (await res.json()) as { data: { asset: { id: string } } };
      const assetId = created.data.asset.id;

      await expect.poll(async () => await readAsset(serial)).toEqual({
        id: assetId,
        categoryId,
        customFields: { ram: '16GB', os: 'macOS' },
      });

      const detail = await page.request.get(`/api/p/assets/${assetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await detail.json()) as {
        data: { asset: { categoryName: string; customFields: Record<string, unknown> } };
      };
      expect(body.data.asset.categoryName).toBe(categoryName);
      expect(body.data.asset.customFields).toEqual({ ram: '16GB', os: 'macOS' });
    });
  });

  test.describe('AC-CATEGORY-003.3: A missing required field is rejected', () => {
    test('creating an asset without a required custom value returns 400 and is not persisted', async ({
      page,
    }) => {
      const categoryId = await seedCategory(`${NAME_PREFIX}Laptop`, [
        { fieldKey: 'ram', label: 'RAM', dataType: 'TEXT', required: true },
      ]);
      const serial = `${SERIAL_PREFIX}MISSING`;

      const token = await loginAdmin(page);
      const res = await page.request.post('/api/p/assets', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name: `${NAME_PREFIX}Incomplete`,
          serialNumber: serial,
          categoryId,
          customFields: {},
        },
      });
      expect(res.status()).toBe(400);
      await expect.poll(async () => await readAsset(serial)).toBeNull();
    });

    test('an unknown custom field key is rejected', async ({ page }) => {
      const categoryId = await seedCategory(`${NAME_PREFIX}Laptop`, [
        { fieldKey: 'ram', label: 'RAM', dataType: 'TEXT' },
      ]);
      const serial = `${SERIAL_PREFIX}UNKNOWN`;

      const token = await loginAdmin(page);
      const res = await page.request.post('/api/p/assets', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name: `${NAME_PREFIX}Bogus`,
          serialNumber: serial,
          categoryId,
          customFields: { ram: '8GB', notAField: 'x' },
        },
      });
      expect(res.status()).toBe(400);
      await expect.poll(async () => await readAsset(serial)).toBeNull();
    });
  });

  test.describe('AC-CATEGORY-003.4: Changing category drops stale values and records history', () => {
    test('switching category clears keys the new schema does not define', async ({ page }) => {
      const laptopId = await seedCategory(`${NAME_PREFIX}Laptop`, [
        { fieldKey: 'ram', label: 'RAM', dataType: 'TEXT' },
      ]);
      const phoneId = await seedCategory(`${NAME_PREFIX}Phone`, [
        { fieldKey: 'imei', label: 'IMEI', dataType: 'TEXT' },
      ]);
      const serial = `${SERIAL_PREFIX}SWITCH`;

      const token = await loginAdmin(page);
      const createRes = await page.request.post('/api/p/assets', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name: `${NAME_PREFIX}Convertible`,
          serialNumber: serial,
          categoryId: laptopId,
          customFields: { ram: '16GB' },
        },
      });
      expect(createRes.status()).toBe(200);
      const assetId = ((await createRes.json()) as { data: { asset: { id: string } } }).data.asset.id;

      // Switch to Phone without supplying customFields: the stale "ram" value is dropped.
      const patchRes = await page.request.patch(`/api/p/assets/${assetId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { categoryId: phoneId },
      });
      expect(patchRes.status()).toBe(200);

      await expect.poll(async () => await readAsset(serial)).toEqual({
        id: assetId,
        categoryId: phoneId,
        customFields: {},
      });
      await expect.poll(async () => await hasTransaction(assetId, 'CATEGORY_CHANGED')).toBe(true);
    });
  });

  test.describe('AC-CATEGORY-003.5: A referenced category cannot be deleted', () => {
    test('the delete dialog warns and disables deletion while assets reference it', async ({
      page,
    }) => {
      const name = `${NAME_PREFIX}InUse`;
      const categoryId = await seedCategory(name, [{ fieldKey: 'ram', label: 'RAM', dataType: 'TEXT' }]);
      await withDb((client) =>
        client.query(
          `INSERT INTO asset (name, model, serial_number, status, category_id, custom_fields)
           VALUES ($1, '', $2, 'STOCK', $3, '{}')`,
          [`${NAME_PREFIX}Ref Asset`, `${SERIAL_PREFIX}REF`, categoryId],
        ),
      );

      const token = await loginAdmin(page);
      await page.goto('/admin/categories');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Delete Category' }).click();
      const modal = page.locator('div.z-200');
      await expect(modal.getByText(/asset\(s\) use this category/i)).toBeVisible();
      await expect(modal.getByRole('button', { name: 'Delete Category' })).toBeDisabled();

      // The API rejects it too (409), and the category survives.
      const res = await page.request.delete(`/api/p/categories/${categoryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(409);
      await expect.poll(async () => await categoryNames()).toContain(name);
    });

    test('a category with no assets can be deleted', async ({ page }) => {
      const name = `${NAME_PREFIX}Disposable`;
      await seedCategory(name);

      await loginAdmin(page);
      await page.goto('/admin/categories');
      await expect(page.getByText(name)).toBeVisible();

      await page.getByRole('button', { name: 'Delete Category' }).click();
      const modal = page.locator('div.z-200');
      await modal.getByRole('button', { name: 'Delete Category' }).click();

      await expect.poll(async () => await categoryNames()).not.toContain(name);
    });
  });
});
