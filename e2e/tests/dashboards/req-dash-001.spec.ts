import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-DASH-001: Dashboards and audit history
 *
 * "As an admin, I see a global analytics overview and the full transaction log;
 *  as any user, I see a personal dashboard with my own history."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-dash001-admin@test.com';
const USER_EMAIL = 'e2e-dash001-user@test.com';
const ASSET_NAME = 'E2E D1 Widget';

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

async function seedTransaction(actorId: string, targetId: string): Promise<void> {
  await withDb((client) =>
    client.query(
      `INSERT INTO transaction (action, asset_name, actor_user_id, actor_name, target_user_id, target_name, detail)
       VALUES ('CREATED', $1, $2, 'E2E Dash Admin', $3, 'E2E Dash User', 'Seeded for e2e')`,
      [ASSET_NAME, actorId, targetId],
    ),
  );
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM transaction WHERE asset_name = $1', [ASSET_NAME]);
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [[ADMIN_EMAIL, USER_EMAIL]]);
  });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test.describe('REQ-DASH-001: Dashboards and audit history', () => {
  test.beforeEach(async () => {
    await cleanup();
    const adminId = await seedUser(ADMIN_EMAIL, 'E2E Dash Admin', 'ADMIN');
    const userId = await seedUser(USER_EMAIL, 'E2E Dash User', 'USER');
    await seedTransaction(adminId, userId);
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-DASH-001.1: Admin analytics overview', () => {
    test('the overview shows KPI tiles, a status chart and the transactions log', async ({
      page,
    }) => {
      await login(page, ADMIN_EMAIL);
      await page.waitForURL(/\/admin\/overview/);

      await expect(page.getByText('Total Assets')).toBeVisible();
      await expect(page.getByText('Assets by Status')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Latest Transactions' })).toBeVisible();
    });
  });

  test.describe('AC-DASH-001.2: The admin transaction log lists events', () => {
    test('a recorded transaction appears in Latest Transactions', async ({ page }) => {
      await login(page, ADMIN_EMAIL);
      await page.waitForURL(/\/admin\/overview/);

      await expect(page.getByText(ASSET_NAME)).toBeVisible();
    });
  });

  test.describe('AC-DASH-001.3: Personal dashboard with own history', () => {
    test('a user sees their dashboard and only their own history', async ({ page }) => {
      await login(page, USER_EMAIL);
      await page.waitForURL(/\/dashboard/);

      await expect(page.getByText('My Assets').first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'My History' })).toBeVisible();
      await expect(page.getByText(ASSET_NAME)).toBeVisible();
    });
  });
});
