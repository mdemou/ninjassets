import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-BULK-ASSIGN-001: Bulk asset assignment + multi-asset custody PDF
 *
 * "As an admin, I can check out (or return) many assets for one user in a single
 *  action, with per-asset success/failure reported, and download one custody
 *  receipt PDF covering the whole batch." (SPEC-BULK-ASSIGN-001)
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-basg001-admin@test.com';
const USER_EMAIL = 'e2e-basg001-user@test.com';
const USER_NAME = 'E2E BASG001 Assignee';
const ASSET_NAME = 'E2E BASG001 Asset';
const SERIAL_PREFIX = 'E2E-BASG1-';

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

async function seedAsset(serial: string, status: string, assignedUserId: string | null): Promise<string> {
  return withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number = $1', [serial]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id)
       VALUES ($1, '', $2, $3, $4) RETURNING id`,
      [`${ASSET_NAME} ${serial}`, serial, status, assignedUserId],
    );
    return res.rows[0].id;
  });
}

async function readAssetStatus(serial: string): Promise<{ status: string; assignedUserId: string | null } | null> {
  return withDb(async (client) => {
    const res = await client.query<{ status: string; assigned_user_id: string | null }>(
      'SELECT status, assigned_user_id FROM asset WHERE serial_number = $1',
      [serial],
    );
    const row = res.rows[0];
    return row ? { status: row.status, assignedUserId: row.assigned_user_id } : null;
  });
}

async function countOpenHandovers(serials: string[]): Promise<number> {
  return withDb(async (client) => {
    const res = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM handover h
       INNER JOIN asset a ON a.id = h.asset_id
       WHERE a.serial_number = ANY($1) AND h.status = 'OPEN'`,
      [serials],
    );
    return parseInt(res.rows[0]?.n ?? '0', 10);
  });
}

async function readActions(serials: string[]): Promise<string[]> {
  return withDb(async (client) => {
    const res = await client.query<{ action: string }>(
      `SELECT t.action FROM transaction t
       INNER JOIN asset a ON a.id = t.asset_id
       WHERE a.serial_number = ANY($1) ORDER BY t.date_created`,
      [serials],
    );
    return res.rows.map((r) => r.action);
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query(
      `DELETE FROM handover WHERE asset_id IN (SELECT id FROM asset WHERE serial_number LIKE $1)`,
      [`${SERIAL_PREFIX}%`],
    );
    await client.query(
      `DELETE FROM transaction WHERE asset_id IN (SELECT id FROM asset WHERE serial_number LIKE $1)`,
      [`${SERIAL_PREFIX}%`],
    );
    await client.query('DELETE FROM asset WHERE serial_number LIKE $1', [`${SERIAL_PREFIX}%`]);
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [[ADMIN_EMAIL, USER_EMAIL]]);
  });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/logout');
  await page.waitForURL(/\/login/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!token) throw new Error('Missing auth token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

test.describe('REQ-BULK-ASSIGN-001: Bulk assignment + batch custody PDF', () => {
  let assigneeId: string;
  const serialA = `${SERIAL_PREFIX}A`;
  const serialB = `${SERIAL_PREFIX}B`;
  const serialArchived = `${SERIAL_PREFIX}ARCH`;

  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'E2E BASG001 Admin', 'ADMIN');
    assigneeId = await seedUser(USER_EMAIL, USER_NAME, 'USER');
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test('AC-001.1: bulk direct checkout assigns every STOCK asset', async ({ page }) => {
    const idA = await seedAsset(serialA, 'STOCK', null);
    const idB = await seedAsset(serialB, 'STOCK', null);
    await login(page, ADMIN_EMAIL);
    await page.waitForURL(/\/admin\/overview/);
    const headers = await authHeaders(page);

    const res = await page.request.post('/api/p/asset-assignments/bulk', {
      headers,
      data: { type: 'CHECK_OUT', mode: 'direct', targetUserId: assigneeId, assetIds: [idA, idB] },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      data: { succeeded: { assetId: string }[]; failed: { assetId: string }[] };
    };
    expect(body.data.succeeded.map((s) => s.assetId).sort()).toEqual([idA, idB].sort());
    expect(body.data.failed).toHaveLength(0);

    expect(await readAssetStatus(serialA)).toEqual({ status: 'ASSIGNED', assignedUserId: assigneeId });
    expect(await readAssetStatus(serialB)).toEqual({ status: 'ASSIGNED', assignedUserId: assigneeId });
    await expect.poll(() => readActions([serialA, serialB])).toContain('ASSIGNED');
  });

  test('AC-001.2: an ineligible (ARCHIVED) asset is reported as failed, others still succeed', async ({ page }) => {
    const idA = await seedAsset(serialA, 'STOCK', null);
    const idArch = await seedAsset(serialArchived, 'ARCHIVED', null);
    await login(page, ADMIN_EMAIL);
    await page.waitForURL(/\/admin\/overview/);
    const headers = await authHeaders(page);

    const res = await page.request.post('/api/p/asset-assignments/bulk', {
      headers,
      data: { type: 'CHECK_OUT', mode: 'direct', targetUserId: assigneeId, assetIds: [idA, idArch] },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      data: { succeeded: { assetId: string }[]; failed: { assetId: string }[] };
    };
    expect(body.data.succeeded.map((s) => s.assetId)).toEqual([idA]);
    expect(body.data.failed.map((f) => f.assetId)).toEqual([idArch]);

    expect((await readAssetStatus(serialArchived))?.status).toBe('ARCHIVED');
  });

  test('AC-001.3: bulk verify checkout opens one handover per asset', async ({ page }) => {
    const idA = await seedAsset(serialA, 'STOCK', null);
    const idB = await seedAsset(serialB, 'STOCK', null);
    await login(page, ADMIN_EMAIL);
    await page.waitForURL(/\/admin\/overview/);
    const headers = await authHeaders(page);

    const res = await page.request.post('/api/p/asset-assignments/bulk', {
      headers,
      data: { type: 'CHECK_OUT', mode: 'verify', targetUserId: assigneeId, assetIds: [idA, idB] },
    });
    expect(res.ok()).toBeTruthy();

    // Verify does not assign yet — assets stay in stock until each user accepts.
    expect((await readAssetStatus(serialA))?.status).toBe('STOCK');
    await expect.poll(() => countOpenHandovers([serialA, serialB])).toBe(2);
  });

  test('AC-001.4: generate-batch returns one PDF covering the selected assets', async ({ page }) => {
    const idA = await seedAsset(serialA, 'STOCK', null);
    const idB = await seedAsset(serialB, 'STOCK', null);
    await login(page, ADMIN_EMAIL);
    await page.waitForURL(/\/admin\/overview/);
    const headers = await authHeaders(page);

    const res = await page.request.post('/api/p/custody-documents/generate-batch?lang=en', {
      headers,
      data: { type: 'CHECK_OUT', assetIds: [idA, idB], targetUserId: assigneeId },
    });
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('application/pdf');
    const pdf = await res.body();
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
