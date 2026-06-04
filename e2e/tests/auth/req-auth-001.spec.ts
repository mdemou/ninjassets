import { expect, test } from '@playwright/test';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-AUTH-001: Self-registration and email verification
 *
 * "As a visitor, I can create an account and activate it by verifying my email,
 *  and I cannot sign in until I have verified."
 */

const PASSWORD = 'Test1234!';
const EMAIL = 'e2e-auth001-register@test.com';
const DISPLAY_NAME = 'E2E Register User';

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

async function findUser(email: string): Promise<{ id: string; status: string } | null> {
  return withDb(async (client) => {
    const res = await client.query<{ id: string; status: string }>(
      'SELECT id, status FROM "user" WHERE email = $1',
      [email],
    );
    return res.rows[0] ?? null;
  });
}

async function latestVerificationToken(userId: string): Promise<string | null> {
  return withDb(async (client) => {
    const res = await client.query<{ token: string }>(
      'SELECT token FROM email_verification_token WHERE fk_user_id = $1 ORDER BY date_created DESC LIMIT 1',
      [userId],
    );
    return res.rows[0]?.token ?? null;
  });
}

async function deleteUser(email: string): Promise<void> {
  await withDb((client) => client.query('DELETE FROM "user" WHERE email = $1', [email]));
}

test.describe('REQ-AUTH-001: Self-registration and email verification', () => {
  test.beforeEach(async () => {
    await deleteUser(EMAIL);
  });

  test.afterEach(async () => {
    await deleteUser(EMAIL);
  });

  test.describe('AC-AUTH-001.1: Registering creates a pending (inactive) account', () => {
    test('submitting the form shows success and the user starts INACTIVE', async ({ page }) => {
      await page.goto('/register');
      await page.getByLabel('Email').fill(EMAIL);
      await page.getByLabel('Display Name').fill(DISPLAY_NAME);
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await page.getByLabel('Confirm Password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Create Account' }).click();

      await expect(page.getByText(/check your email to verify/i)).toBeVisible();

      const user = await findUser(EMAIL);
      expect(user).not.toBeNull();
      expect(user?.status).toBe('INACTIVE');
    });
  });

  test.describe('AC-AUTH-001.2: An unverified account cannot sign in', () => {
    test('login is rejected while the account is INACTIVE', async ({ page }) => {
      await page.goto('/register');
      await page.getByLabel('Email').fill(EMAIL);
      await page.getByLabel('Display Name').fill(DISPLAY_NAME);
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await page.getByLabel('Confirm Password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Create Account' }).click();
      await expect(page.getByText(/check your email to verify/i)).toBeVisible();

      await page.goto('/login');
      await page.getByLabel('Email').fill(EMAIL);
      await page.getByLabel('Password').fill(PASSWORD);
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

  test.describe('AC-AUTH-001.3: Verifying the email activates the account', () => {
    test('opening the verification link activates the user and enables login', async ({ page }) => {
      await page.goto('/register');
      await page.getByLabel('Email').fill(EMAIL);
      await page.getByLabel('Display Name').fill(DISPLAY_NAME);
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await page.getByLabel('Confirm Password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Create Account' }).click();
      await expect(page.getByText(/check your email to verify/i)).toBeVisible();

      const user = await findUser(EMAIL);
      expect(user).not.toBeNull();
      const token = await latestVerificationToken(user!.id);
      expect(token).toBeTruthy();

      const [verifyResponse] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/session/verify-email') && r.request().method() === 'POST',
        ),
        page.goto(`/verify-email?token=${token}`),
      ]);
      expect(verifyResponse.status()).toBeLessThan(400);
      await expect(page.locator('.bg-success')).toBeVisible();

      const activated = await findUser(EMAIL);
      expect(activated?.status).toBe('ACTIVE');

      // The activated account can now sign in and lands on the personal dashboard.
      await page.goto('/login');
      await page.getByLabel('Email').fill(EMAIL);
      await page.getByLabel('Password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL(/\/dashboard/);
    });

    test('an invalid token reports an error', async ({ page }) => {
      await page.goto('/verify-email?token=not-a-real-token');
      await expect(page.locator('.bg-danger')).toBeVisible();
    });
  });
});
