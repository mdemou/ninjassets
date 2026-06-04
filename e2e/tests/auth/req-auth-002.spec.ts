import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-AUTH-002: Login, logout, and role-based access
 *
 * "As a registered user, I can sign in with valid credentials and sign out, and
 *  the platform keeps me away from pages my role or session does not allow."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-auth002-admin@test.com';
const USER_EMAIL = 'e2e-auth002-user@test.com';
const INACTIVE_EMAIL = 'e2e-auth002-inactive@test.com';

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

async function seedUser(opts: {
  email: string;
  displayName: string;
  role: 'ADMIN' | 'USER';
  status?: 'ACTIVE' | 'INACTIVE';
}): Promise<void> {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(PASSWORD, salt);
  await withDb(async (client) => {
    const role = await client.query<{ id: number }>('SELECT id FROM role WHERE name = $1 LIMIT 1', [
      opts.role,
    ]);
    const roleId = role.rows[0]?.id;
    if (!roleId) throw new Error(`${opts.role} role not found`);
    await client.query('DELETE FROM "user" WHERE email = $1', [opts.email]);
    await client.query(
      `INSERT INTO "user" (email, display_name, hashed, salt, role_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [opts.email, opts.displayName, hashed, salt, roleId, opts.status ?? 'ACTIVE'],
    );
  });
}

async function cleanup(): Promise<void> {
  await withDb((client) =>
    client.query('DELETE FROM "user" WHERE email = ANY($1)', [
      [ADMIN_EMAIL, USER_EMAIL, INACTIVE_EMAIL],
    ]),
  );
}

async function fillLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
}

test.describe('REQ-AUTH-002: Login, logout, and role-based access', () => {
  test.beforeEach(async () => {
    await seedUser({ email: ADMIN_EMAIL, displayName: 'E2E Admin', role: 'ADMIN' });
    await seedUser({ email: USER_EMAIL, displayName: 'E2E User', role: 'USER' });
    await seedUser({
      email: INACTIVE_EMAIL,
      displayName: 'E2E Inactive',
      role: 'USER',
      status: 'INACTIVE',
    });
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-AUTH-002.1: Valid credentials sign in and land on the role home', () => {
    test('an admin lands on the admin overview', async ({ page }) => {
      await fillLogin(page, ADMIN_EMAIL, PASSWORD);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL(/\/admin\/overview/);
    });

    test('a regular user lands on the personal dashboard', async ({ page }) => {
      await fillLogin(page, USER_EMAIL, PASSWORD);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL(/\/dashboard/);
    });
  });

  test.describe('AC-AUTH-002.2: Invalid credentials are rejected', () => {
    test('a wrong password keeps the user on the login page', async ({ page }) => {
      await fillLogin(page, ADMIN_EMAIL, 'WrongPass1!');
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/session/login') && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: 'Sign In' }).click(),
      ]);
      expect(response.status()).toBeGreaterThanOrEqual(400);
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('AC-AUTH-002.3: Inactive accounts cannot sign in', () => {
    test('an INACTIVE user is refused even with the right password', async ({ page }) => {
      await fillLogin(page, INACTIVE_EMAIL, PASSWORD);
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/session/login') && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: 'Sign In' }).click(),
      ]);
      expect(response.status()).toBeGreaterThanOrEqual(400);
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('AC-AUTH-002.4: Signing out ends the session', () => {
    test('after logout, a protected page redirects back to login', async ({ page }) => {
      await fillLogin(page, USER_EMAIL, PASSWORD);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL(/\/dashboard/);

      await page.goto('/logout');
      await page.waitForURL(/\/login/);

      await page.goto('/dashboard');
      await page.waitForURL(/\/login/);
    });
  });

  test.describe('AC-AUTH-002.5: Access control by role and session', () => {
    test('an unauthenticated visitor is redirected from a protected page to login', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.waitForURL(/\/login/);
    });

    test('a regular user is redirected away from an admin-only page', async ({ page }) => {
      await fillLogin(page, USER_EMAIL, PASSWORD);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL(/\/dashboard/);

      await page.goto('/admin/assets');
      // Admin pages bounce non-admins to the public home and never render the admin heading.
      await expect(page).not.toHaveURL(/\/admin\/assets/);
      await expect(page.getByRole('heading', { name: 'Asset Management' })).toHaveCount(0);
    });

    test('the admin asset API rejects a regular user token', async ({ page }) => {
      await fillLogin(page, USER_EMAIL, PASSWORD);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL(/\/dashboard/);

      const status = await page.evaluate(async () => {
        const res = await fetch('/api/p/assets', {
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
        });
        return res.status;
      });
      expect(status).toBeGreaterThanOrEqual(400);
    });
  });
});
