import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-PERSONAL-001: Personal "My Assets" view
 *
 * "As a regular user, I get a read-only list of the assets assigned to me, and an
 *  empty state when I have none."
 */

const PASSWORD = 'Test1234!';
const USER_EMAIL = 'e2e-personal-user@test.com';
const SERIAL_PREFIX = 'E2E-P1-';

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
    const r = await client.query<{ id: number }>("SELECT id FROM role WHERE name = 'USER' LIMIT 1");
    const roleId = r.rows[0]?.id;
    if (!roleId) throw new Error('USER role not found');
    await client.query('DELETE FROM "user" WHERE email = $1', [USER_EMAIL]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO "user" (email, display_name, hashed, salt, role_id, status)
       VALUES ($1, 'E2E Personal User', $2, $3, $4, 'ACTIVE') RETURNING id`,
      [USER_EMAIL, hashed, salt, roleId],
    );
    return res.rows[0].id;
  });
}

async function seedAssignedAsset(name: string, serial: string, userId: string): Promise<void> {
  await withDb((client) =>
    client.query(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id)
       VALUES ($1, 'Model P', $2, 'ASSIGNED', $3)`,
      [name, serial, userId],
    ),
  );
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number LIKE $1', [`${SERIAL_PREFIX}%`]);
    await client.query('DELETE FROM "user" WHERE email = $1', [USER_EMAIL]);
  });
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe('REQ-PERSONAL-001: Personal "My Assets" view', () => {
  let userId: string;

  test.beforeEach(async () => {
    await cleanup();
    userId = await seedUser();
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-PERSONAL-001.1: Assigned assets are listed', () => {
    test('the user sees an asset assigned to them', async ({ page }) => {
      const name = 'E2E P1 My Laptop';
      const serial = `${SERIAL_PREFIX}MINE`;
      await seedAssignedAsset(name, serial, userId);

      await login(page);
      await page.goto('/assets');

      await expect(page.getByRole('heading', { name: 'My Assets' })).toBeVisible();
      await expect(page.getByText(name)).toBeVisible();
      await expect(page.getByText(serial)).toBeVisible();
    });
  });

  test.describe('AC-PERSONAL-001.2: Empty state when nothing is assigned', () => {
    test('a user with no assets sees the empty message', async ({ page }) => {
      await login(page);
      await page.goto('/assets');

      await expect(page.getByText('You have no assets assigned to you.')).toBeVisible();
    });
  });
});
