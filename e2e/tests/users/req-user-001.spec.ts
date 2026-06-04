import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-USER-001: Admin user management
 *
 * "As an admin, I can create users (who receive an activation email), edit their
 *  role and status, and delete users."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-user001-admin@test.com';
const EMAIL_PREFIX = 'e2e-user001-';

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

async function readUser(
  email: string,
): Promise<{ displayName: string; status: string; role: string } | null> {
  return withDb(async (client) => {
    const res = await client.query<{ display_name: string; status: string; role: string }>(
      `SELECT u.display_name, u.status, r.name AS role
       FROM "user" u JOIN role r ON r.id = u.role_id WHERE u.email = $1`,
      [email],
    );
    const row = res.rows[0];
    return row ? { displayName: row.display_name, status: row.status, role: row.role } : null;
  });
}

async function cleanup(): Promise<void> {
  await withDb((client) => client.query('DELETE FROM "user" WHERE email LIKE $1', [`${EMAIL_PREFIX}%`]));
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/admin\/overview/);
}

/** A specific user's table row, matched by its (unique) email. */
function userRow(page: Page, email: string) {
  return page.getByRole('row').filter({ hasText: email });
}

test.describe('REQ-USER-001: Admin user management', () => {
  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'E2E Users Admin', 'ADMIN');
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-USER-001.1: Creating a user', () => {
    test('a new user is created as INACTIVE and listed', async ({ page }) => {
      const email = `${EMAIL_PREFIX}created@test.com`;

      await loginAdmin(page);
      await page.goto('/admin/users');
      await page.getByRole('button', { name: 'Create User' }).click();

      const modal = page.locator('div.z-200');
      await modal.getByLabel('Email').fill(email);
      await modal.getByLabel('Display Name').fill('E2E Created User');
      await modal.getByRole('button', { name: 'Create User' }).click();

      await expect(page.getByText(email)).toBeVisible();
      await expect.poll(async () => (await readUser(email))?.status).toBe('INACTIVE');
    });
  });

  test.describe('AC-USER-001.2: Editing a user', () => {
    test('changing the role and display name is persisted', async ({ page }) => {
      const email = `${EMAIL_PREFIX}edit@test.com`;
      await seedUser(email, 'E2E Edit User', 'USER');

      await loginAdmin(page);
      await page.goto('/admin/users');
      await expect(page.getByText(email)).toBeVisible();

      await userRow(page, email).getByRole('button', { name: 'Edit User' }).click();
      const modal = page.locator('div.z-200');
      await modal.getByLabel('Display Name').fill('E2E Promoted User');
      await modal.getByLabel('Role').click();
      await page.getByRole('option', { name: 'ADMIN' }).click();
      await modal.getByRole('button', { name: 'Save Changes' }).click();

      await expect.poll(async () => await readUser(email)).toMatchObject({
        displayName: 'E2E Promoted User',
        role: 'ADMIN',
      });
    });
  });

  test.describe('AC-USER-001.3: Deleting a user', () => {
    test('deleting removes the user', async ({ page }) => {
      const email = `${EMAIL_PREFIX}del@test.com`;
      await seedUser(email, 'E2E Deletable User', 'USER');

      await loginAdmin(page);
      await page.goto('/admin/users');
      await expect(page.getByText(email)).toBeVisible();

      await userRow(page, email).getByRole('button', { name: 'Delete User' }).click();
      const modal = page.locator('div.z-200');
      await modal.getByRole('button', { name: 'Delete User' }).click();

      await expect(page.getByText(email)).toHaveCount(0);
      await expect.poll(async () => await readUser(email)).toBeNull();
    });
  });
});
