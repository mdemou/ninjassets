import { expect, test } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../config';

const QR_PRINT_STORAGE_KEY = 'ninjasset:qr-print';

/**
 * Admin QR label print page
 *
 * "As an admin, I can open the print layout for assets selected for QR labels."
 */

const ADMIN_EMAIL = 'e2e-qr-print-admin@test.com';
const ADMIN_PASSWORD = 'Test1234!';

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: TEST_DB_NAME,
};

const PRINT_ITEM = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'E2E Print Asset',
  siteName: 'E2E Site',
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

async function seedAdminUser(): Promise<void> {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, salt);

  await withDb(async (client) => {
    const role = await client.query<{ id: number }>("SELECT id FROM role WHERE name = 'ADMIN' LIMIT 1");
    const roleId = role.rows[0]?.id;
    if (!roleId) throw new Error('ADMIN role not found');

    await client.query('DELETE FROM "user" WHERE email = $1', [ADMIN_EMAIL]);
    await client.query(
      `INSERT INTO "user" (email, display_name, hashed, salt, role_id, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
      [ADMIN_EMAIL, 'E2E QR Admin', hashed, salt, roleId],
    );
  });
}

async function deleteAdminUser(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM "user" WHERE email = $1', [ADMIN_EMAIL]);
  });
}

test.describe('Admin QR print page', () => {
  test.beforeEach(async () => {
    await seedAdminUser();
  });

  test.afterEach(async () => {
    await deleteAdminUser();
  });

  test('shows print toolbar and label grid when session has items', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(admin\/overview|dashboard)/);

    // Land on the print page first so the document context is stable before we
    // touch sessionStorage. Seeding right after waitForURL can race a post-login
    // redirect still in flight and destroy the execution context mid-evaluate.
    await page.goto('/admin/assets/print-qr');
    await page.evaluate(
      ([key, item]) => {
        sessionStorage.setItem(key, JSON.stringify([item]));
      },
      [QR_PRINT_STORAGE_KEY, PRINT_ITEM] as const,
    );
    await page.reload();

    await expect(page.getByRole('heading', { name: /print qr labels/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /print labels/i })).toBeVisible();
    await expect(page.getByText(PRINT_ITEM.name)).toBeVisible();
    const showName = page.getByLabel(/show name/i);
    await expect(showName).toBeChecked();
    await showName.uncheck();
    await expect(page.getByText(PRINT_ITEM.name)).toHaveCount(0);
  });

  test('shows empty state when nothing is selected', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(admin\/overview|dashboard)/);

    // Settle on the print page before clearing storage (see note above), then
    // reload so the page mounts with an empty selection.
    await page.goto('/admin/assets/print-qr');
    await page.evaluate((key) => {
      sessionStorage.removeItem(key);
    }, QR_PRINT_STORAGE_KEY);
    await page.reload();

    await expect(page.getByText(/no assets selected for printing/i)).toBeVisible();
  });
});
