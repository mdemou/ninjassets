import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-PROFILE-001: Account self-service in Settings
 *
 * "As a signed-in user, I can update my display name, change my password, switch
 *  language, manage my avatar, and delete my own account."
 */

const PASSWORD = 'Test1234!';
const NEW_PASSWORD = 'Changed5678!';
const EMAIL = 'e2e-profile001@test.com';

// 1x1 PNG — enough for the sharp pipeline to produce a stored webp avatar.
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

async function seedUser(): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(PASSWORD, salt);
  return withDb(async (client) => {
    const role = await client.query<{ id: number }>("SELECT id FROM role WHERE name = 'USER' LIMIT 1");
    const roleId = role.rows[0]?.id;
    if (!roleId) throw new Error('USER role not found');
    await client.query('DELETE FROM "user" WHERE email = $1', [EMAIL]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO "user" (email, display_name, hashed, salt, role_id, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE') RETURNING id`,
      [EMAIL, 'E2E Profile User', hashed, salt, roleId],
    );
    return res.rows[0].id;
  });
}

async function readUser(): Promise<{
  displayName: string;
  avatarFilename: string | null;
  status: string;
} | null> {
  return withDb(async (client) => {
    const res = await client.query<{
      display_name: string;
      avatar_filename: string | null;
      status: string;
    }>('SELECT display_name, avatar_filename, status FROM "user" WHERE email = $1', [EMAIL]);
    const row = res.rows[0];
    return row
      ? { displayName: row.display_name, avatarFilename: row.avatar_filename, status: row.status }
      : null;
  });
}

async function deleteUser(): Promise<void> {
  await withDb((client) => client.query('DELETE FROM "user" WHERE email = $1', [EMAIL]));
}

async function login(page: Page, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/dashboard/);
}

/** The "Save Changes" button inside a specific Settings panel (titles repeat the label). */
function panelButton(page: Page, panelTitle: string, buttonName: string) {
  return page
    .locator('div.bg-surface', { has: page.getByRole('heading', { name: panelTitle }) })
    .getByRole('button', { name: buttonName });
}

test.describe('REQ-PROFILE-001: Account self-service in Settings', () => {
  test.beforeEach(async () => {
    await seedUser();
  });

  test.afterEach(async () => {
    await deleteUser();
  });

  test.describe('AC-PROFILE-001.1: Updating the display name persists', () => {
    test('a new display name is saved and survives a reload', async ({ page }) => {
      await login(page);
      await page.goto('/settings');

      const nameField = page.getByLabel('Display Name');
      await expect(nameField).toHaveValue('E2E Profile User');
      await nameField.fill('Renamed Profile User');
      await panelButton(page, 'Update Profile', 'Save Changes').click();

      await expect.poll(async () => (await readUser())?.displayName).toBe('Renamed Profile User');

      await page.reload();
      await expect(page.getByLabel('Display Name')).toHaveValue('Renamed Profile User');
    });
  });

  test.describe('AC-PROFILE-001.2: Changing the password rotates credentials', () => {
    test('the new password works after a change', async ({ page }) => {
      await login(page);
      await page.goto('/settings');

      await page.getByLabel('Current Password').fill(PASSWORD);
      await page.getByLabel('New Password', { exact: true }).fill(NEW_PASSWORD);
      await page.getByLabel('Confirm New Password').fill(NEW_PASSWORD);
      await page.getByRole('button', { name: 'Update Password' }).click();

      // Toast success then re-login with the new password.
      await page.goto('/logout');
      await page.waitForURL(/\/login/);
      await login(page, NEW_PASSWORD);
    });
  });

  test.describe('AC-PROFILE-001.3: Switching language updates the UI', () => {
    test('selecting Spanish translates the settings page', async ({ page }) => {
      await login(page);
      await page.goto('/settings');

      await page.getByRole('radio', { name: 'Spanish' }).click();
      await panelButton(page, 'Language', 'Save Changes').click();

      await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
    });
  });

  test.describe('AC-PROFILE-001.4: Uploading an avatar stores an image', () => {
    test('the upload endpoint stores the avatar filename', async ({ page }) => {
      await login(page);

      const status = await page.evaluate(async (b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const res = await fetch('/api/user/avatar', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'image/png',
          },
          body: bytes,
        });
        return res.status;
      }, PNG_BASE64);

      expect(status).toBeLessThan(400);
      await expect.poll(async () => (await readUser())?.avatarFilename).toBeTruthy();
    });
  });

  test.describe('AC-PROFILE-001.5: Deleting the account deactivates it', () => {
    test('confirming deletion with the password deactivates the account and signs out', async ({
      page,
    }) => {
      await login(page);
      await page.goto('/settings');

      await page.getByRole('button', { name: 'Delete My Account' }).click();
      // Confirm inside the modal (scoped to the overlay; the panel button repeats the label).
      const modal = page.locator('div.z-200');
      await modal.getByLabel('Password').fill(PASSWORD);
      await modal.getByRole('button', { name: 'Delete My Account' }).click();

      await page.waitForURL(/\/login/);
      // Account deletion is a soft delete: the user is deactivated, not removed.
      await expect.poll(async () => (await readUser())?.status).toBe('INACTIVE');

      // A deactivated account can no longer sign in.
      await page.getByLabel('Email').fill(EMAIL);
      await page.getByLabel('Password').fill(PASSWORD);
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
