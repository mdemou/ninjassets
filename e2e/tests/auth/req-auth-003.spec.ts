import { expect, test } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-AUTH-003: Password reset by email
 *
 * "As a user who forgot my password, I can request a reset link and choose a new
 *  password, after which the old password no longer works."
 */

const OLD_PASSWORD = 'OldPass1234!';
const NEW_PASSWORD = 'NewPass5678!';
const EMAIL = 'e2e-auth003-reset@test.com';

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

async function seedActiveUser(): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(OLD_PASSWORD, salt);
  return withDb(async (client) => {
    const role = await client.query<{ id: number }>("SELECT id FROM role WHERE name = 'USER' LIMIT 1");
    const roleId = role.rows[0]?.id;
    if (!roleId) throw new Error('USER role not found');
    await client.query('DELETE FROM "user" WHERE email = $1', [EMAIL]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO "user" (email, display_name, hashed, salt, role_id, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE') RETURNING id`,
      [EMAIL, 'E2E Reset User', hashed, salt, roleId],
    );
    return res.rows[0].id;
  });
}

async function latestResetToken(userId: string): Promise<string | null> {
  return withDb(async (client) => {
    const res = await client.query<{ token: string }>(
      'SELECT token FROM password_reset_token WHERE fk_user_id = $1 ORDER BY date_created DESC LIMIT 1',
      [userId],
    );
    return res.rows[0]?.token ?? null;
  });
}

async function deleteUser(): Promise<void> {
  await withDb((client) => client.query('DELETE FROM "user" WHERE email = $1', [EMAIL]));
}

test.describe('REQ-AUTH-003: Password reset by email', () => {
  let userId: string;

  test.beforeEach(async () => {
    userId = await seedActiveUser();
  });

  test.afterEach(async () => {
    await deleteUser();
  });

  test.describe('AC-AUTH-003.1: Requesting a reset link confirms and issues a token', () => {
    test('submitting the email shows a confirmation and stores a reset token', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.getByLabel('Email').fill(EMAIL);
      await page.getByRole('button', { name: 'Send Reset Link' }).click();

      await expect(page.getByText(/a password reset link has been sent/i)).toBeVisible();

      const token = await latestResetToken(userId);
      expect(token).toBeTruthy();
    });
  });

  test.describe('AC-AUTH-003.2: A missing token is reported on the reset page', () => {
    test('opening the reset page without a token shows an error', async ({ page }) => {
      await page.goto('/reset-password');
      await expect(page.getByText(/invalid or missing reset token/i)).toBeVisible();
    });
  });

  test.describe('AC-AUTH-003.3: Choosing a new password rotates the credentials', () => {
    test('after reset, the new password works and the old one is rejected', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.getByLabel('Email').fill(EMAIL);
      await page.getByRole('button', { name: 'Send Reset Link' }).click();
      await expect(page.getByText(/a password reset link has been sent/i)).toBeVisible();

      const token = await latestResetToken(userId);
      expect(token).toBeTruthy();

      await page.goto(`/reset-password?token=${token}`);
      await page.getByLabel('New Password', { exact: true }).fill(NEW_PASSWORD);
      await page.getByLabel('Confirm New Password').fill(NEW_PASSWORD);
      await page.getByRole('button', { name: 'Reset Password' }).click();
      await expect(page.getByText(/your password has been reset successfully/i)).toBeVisible();

      // The new password signs in.
      await page.goto('/login');
      await page.getByLabel('Email').fill(EMAIL);
      await page.getByLabel('Password').fill(NEW_PASSWORD);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL(/\/dashboard/);

      // The old password no longer works.
      await page.goto('/logout');
      await page.waitForURL(/\/login/);
      await page.getByLabel('Email').fill(EMAIL);
      await page.getByLabel('Password').fill(OLD_PASSWORD);
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/session/login') && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: 'Sign In' }).click(),
      ]);
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });
});
