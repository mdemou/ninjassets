import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-ALERT-003: Dismissing (discarding) computed data-quality rows
 *
 * "As an admin, I can discard a row so it stops showing on the overview panel and the
 *  notification bell — without editing the asset. Dismissals are signature-based, so any
 *  change to the underlying issue resurfaces the alert. Tiles and the reports page are
 *  never filtered."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-alert003-admin@test.com';
const ADMIN2_EMAIL = 'e2e-alert003-admin2@test.com';
const USER_EMAIL = 'e2e-alert003-user@test.com';
const SERIAL_PREFIX = 'E2E-AL3-';

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: TEST_DB_NAME,
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

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

async function seedAsset(opts: {
  name: string;
  serial: string;
  assignedUserId: string;
  expectedReturnDate: string;
}): Promise<string> {
  return withDb(async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id, expected_return_date)
       VALUES ($1, '', $2, 'ASSIGNED', $3, $4) RETURNING id`,
      [opts.name, opts.serial, opts.assignedUserId, opts.expectedReturnDate],
    );
    return res.rows[0].id;
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    // Deleting the asset cascades to data_quality_dismissal.
    await client.query('DELETE FROM asset WHERE serial_number LIKE $1', [`${SERIAL_PREFIX}%`]);
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [
      [ADMIN_EMAIL, ADMIN2_EMAIL, USER_EMAIL],
    ]);
  });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function loginAdmin(page: Page, email = ADMIN_EMAIL): Promise<void> {
  await login(page, email);
  await page.waitForURL(/\/admin\/overview/);
}

async function adminAuthHeader(page: Page): Promise<{ Authorization: string }> {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!token) throw new Error('Missing auth token');
  return { Authorization: `Bearer ${token}` };
}

function serialsOf(payload: { data?: { alerts?: { serialNumber: string }[]; rows?: { serialNumber: string }[] } }): string[] {
  const items = payload.data?.alerts ?? payload.data?.rows ?? [];
  return items.map((i) => i.serialNumber);
}

test.describe('REQ-ALERT-003: Dismiss data-quality rows', () => {
  let overdueAssetId: string;
  const overdueSerial = `${SERIAL_PREFIX}OVERDUE`;
  const issue = 'RETURN_OVERDUE';

  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'E2E Alert3 Admin', 'ADMIN');
    await seedUser(ADMIN2_EMAIL, 'E2E Alert3 Admin2', 'ADMIN');
    const assigneeId = await seedUser(USER_EMAIL, 'E2E Alert3 User', 'USER');
    overdueAssetId = await seedAsset({
      name: 'E2E AL3 Overdue',
      serial: overdueSerial,
      assignedUserId: assigneeId,
      expectedReturnDate: daysAgoIso(1),
    });
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-ALERT-003.1 / .2: Discard hides from lists; undo restores', () => {
    test('discard removes the overview row and Undo brings it back', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/overview');

      const row = page.locator(`[data-testid="attention-row-${overdueAssetId}"]`);
      await expect(row).toBeVisible();

      await page.locator(`[data-testid="attention-dismiss-${issue}-${overdueAssetId}"]`).click();
      await expect(page.locator(`[data-testid="attention-row-${overdueAssetId}"]`)).toHaveCount(0);

      // Undo from the toast restores the row.
      await page.getByRole('button', { name: 'Undo' }).click();
      await expect(page.locator(`[data-testid="attention-row-${overdueAssetId}"]`)).toBeVisible();
    });
  });

  test.describe('AC-ALERT-003.1 / .5: Scope — alerts/bell hidden, reports/tiles unchanged, global', () => {
    test('dismissal hides from excludeDismissed alerts but not reports', async ({ page }) => {
      await loginAdmin(page);
      const headers = await adminAuthHeader(page);
      const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

      const dismiss = await page.request.post('/api/p/reports/data-quality/dismiss', {
        headers: jsonHeaders,
        data: { assetId: overdueAssetId, issue },
      });
      expect(dismiss.ok()).toBeTruthy();

      // Overview + bell (excludeDismissed=true) hide it…
      const filtered = await page.request.get('/api/p/alerts?limit=15&excludeDismissed=true', { headers });
      expect(serialsOf(await filtered.json())).not.toContain(overdueSerial);

      // …but the unfiltered alerts and the reports page still show it.
      const unfiltered = await page.request.get('/api/p/alerts?limit=15', { headers });
      expect(serialsOf(await unfiltered.json())).toContain(overdueSerial);

      const reports = await page.request.get(`/api/p/reports/data-quality?issue=${issue}`, { headers });
      expect(serialsOf(await reports.json())).toContain(overdueSerial);
    });

    test('dismissal is global — a second admin also stops seeing it', async ({ page }) => {
      // Admin 1 dismisses.
      await loginAdmin(page);
      const headers1 = await adminAuthHeader(page);
      await page.request.post('/api/p/reports/data-quality/dismiss', {
        headers: { ...headers1, 'Content-Type': 'application/json' },
        data: { assetId: overdueAssetId, issue },
      });

      // Drop admin 1's session, then log in as a different admin.
      await page.evaluate(() => localStorage.clear());
      await loginAdmin(page, ADMIN2_EMAIL);
      await page.goto('/admin/overview');
      await expect(page.locator(`[data-testid="attention-row-${overdueAssetId}"]`)).toHaveCount(0);
    });
  });

  test.describe('AC-ALERT-003.3: Changing the underlying value resurfaces the alert', () => {
    test('editing expected_return_date invalidates the dismissal', async ({ page }) => {
      await loginAdmin(page);
      const headers = await adminAuthHeader(page);
      const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

      await page.request.post('/api/p/reports/data-quality/dismiss', {
        headers: jsonHeaders,
        data: { assetId: overdueAssetId, issue },
      });

      // Still overdue, but a different date → different signature.
      await page.request.patch(`/api/p/assets/${overdueAssetId}`, {
        headers: jsonHeaders,
        data: { expectedReturnDate: daysAgoIso(5) },
      });

      const res = await page.request.get('/api/p/alerts?limit=15&excludeDismissed=true', { headers });
      expect(serialsOf(await res.json())).toContain(overdueSerial);
    });
  });

  test.describe('AC-ALERT-003.7: Bell badge syncs live after a discard', () => {
    test('discarding on the overview updates the bell badge without a reload', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/overview');

      // The single seeded overdue asset is the only alert → badge shows 1.
      const badge = page.locator('[data-testid="notification-bell-badge"]');
      await expect(badge).toHaveText('1');

      await page.locator(`[data-testid="attention-dismiss-${issue}-${overdueAssetId}"]`).click();
      await expect(page.locator(`[data-testid="attention-row-${overdueAssetId}"]`)).toHaveCount(0);

      // No navigation/reload: the badge drops to 0 (hidden) from the live signal alone.
      await expect(badge).toHaveCount(0);
    });
  });

  test.describe('AC-ALERT-003.6: Dismissing an absent issue returns 409', () => {
    test('issue not present for the asset is rejected', async ({ page }) => {
      await loginAdmin(page);
      const headers = await adminAuthHeader(page);

      // The overdue asset has RETURN_OVERDUE but no warranty issue.
      const res = await page.request.post('/api/p/reports/data-quality/dismiss', {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: { assetId: overdueAssetId, issue: 'WARRANTY_EXPIRED' },
      });
      expect(res.status()).toBe(409);
    });
  });
});
