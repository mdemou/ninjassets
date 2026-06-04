import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-API-001: API automation (machine access) — MVP (SPEC-API-001 §14).
 *
 * Long-lived `nsk_live_*` bearer keys authenticate the admin API the same way a JWT
 * does, are deployment-wide manageable, revocable, regenerable, access-logged, and
 * pass through a permission seam that is a no-op for full-admin keys in MVP.
 */

const PASSWORD = 'Test1234!';
const ADMIN_A = 'e2e-api001-admin-a@test.com';
const ADMIN_B = 'e2e-api001-admin-b@test.com';
const USER_EMAIL = 'e2e-api001-user@test.com';
const ASSET_SERIAL = 'E2E-API001-ASSET';
const KEY_NAME_PREFIX = 'e2e-api001';

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: TEST_DB_NAME,
};

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
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

async function seedAsset(): Promise<string> {
  return withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number = $1', [ASSET_SERIAL]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id)
       VALUES ('E2E API001 Asset', '', $1, 'STOCK', NULL) RETURNING id`,
      [ASSET_SERIAL],
    );
    return res.rows[0].id;
  });
}

/** Seed a key row directly (used for the expired-key case the API won't create). */
async function seedRawApiKey(ownerId: string, opts: { expiresAt?: Date | null }): Promise<string> {
  const secret = `nsk_live_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = secret.slice(0, 'nsk_live_'.length + 8);
  await withDb(async (client) => {
    await client.query(
      `INSERT INTO api_key (user_id, name, prefix, secret_hash, capabilities, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ownerId, `${KEY_NAME_PREFIX}-expired`, prefix, sha256Hex(secret), JSON.stringify(['*']), opts.expiresAt ?? null],
    );
  });
  return secret;
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM api_access_log WHERE path LIKE $1', ['/api/p/%']);
    await client.query('DELETE FROM idempotency_record WHERE true');
    await client.query('DELETE FROM api_key WHERE name LIKE $1', [`${KEY_NAME_PREFIX}%`]);
    await client.query('DELETE FROM asset WHERE serial_number = $1', [ASSET_SERIAL]);
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [[ADMIN_A, ADMIN_B, USER_EMAIL]]);
  });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/logout');
  await page.waitForURL(/\/login/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function token(page: Page): Promise<string> {
  const t = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!t) throw new Error('Missing auth token');
  return t;
}

/** Create a key via the real API as the currently logged-in admin. Returns the secret + id. */
async function createKey(page: Page, name: string): Promise<{ id: string; secret: string; prefix: string }> {
  const jwt = await token(page);
  const res = await page.request.post('/api/p/api-keys', {
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    data: { name },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { data: { apiKey: { id: string; secret: string; prefix: string } } };
  return body.data.apiKey;
}

test.describe('REQ-API-001: API automation (MVP)', () => {
  let adminAId: string;

  test.beforeEach(async () => {
    await cleanup();
    adminAId = await seedUser(ADMIN_A, 'E2E API001 Admin A', 'ADMIN');
    await seedUser(ADMIN_B, 'E2E API001 Admin B', 'ADMIN');
    await seedUser(USER_EMAIL, 'E2E API001 User', 'USER');
    await seedAsset();
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test('AC-001.1: create returns the secret once and stores only a hash', async ({ page }) => {
    await login(page, ADMIN_A);
    await page.waitForURL(/\/admin\/overview/);
    const key = await createKey(page, `${KEY_NAME_PREFIX}-create`);

    expect(key.secret.startsWith('nsk_live_')).toBeTruthy();
    expect(key.secret.startsWith(key.prefix)).toBeTruthy();

    const stored = await withDb(async (client) => {
      const r = await client.query<{ secret_hash: string }>('SELECT secret_hash FROM api_key WHERE id = $1', [key.id]);
      return r.rows[0]?.secret_hash;
    });
    expect(stored).toBe(sha256Hex(key.secret));
    expect(stored).not.toBe(key.secret);
  });

  test('AC-001.2 + AC-001.8: a key authenticates /api/p/assets and is access-logged', async ({ page }) => {
    await login(page, ADMIN_A);
    await page.waitForURL(/\/admin\/overview/);
    const key = await createKey(page, `${KEY_NAME_PREFIX}-use`);

    const res = await page.request.get('/api/p/assets', {
      headers: { Authorization: `Bearer ${key.secret}` },
    });
    expect(res.status()).toBe(200);

    await expect
      .poll(() =>
        withDb(async (client) => {
          const r = await client.query<{ count: string }>(
            `SELECT COUNT(*) FROM api_access_log WHERE api_key_id = $1 AND path = '/api/p/assets' AND method = 'GET'`,
            [key.id],
          );
          return Number(r.rows[0]?.count ?? 0);
        }),
      )
      .toBeGreaterThan(0);
  });

  test('AC-001.3: a revoked key is rejected', async ({ page }) => {
    await login(page, ADMIN_A);
    await page.waitForURL(/\/admin\/overview/);
    const key = await createKey(page, `${KEY_NAME_PREFIX}-revoke`);
    const jwt = await token(page);

    const del = await page.request.delete(`/api/p/api-keys/${key.id}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(del.status()).toBe(200);

    const res = await page.request.get('/api/p/assets', {
      headers: { Authorization: `Bearer ${key.secret}` },
    });
    expect(res.status()).toBe(401);
  });

  test('AC-001.4: USER cannot create API keys', async ({ page }) => {
    await login(page, USER_EMAIL);
    await page.waitForURL(/\/dashboard/);
    const jwt = await token(page);
    const res = await page.request.post('/api/p/api-keys', {
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      data: { name: `${KEY_NAME_PREFIX}-user` },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('AC-001.5: API keys are rejected on /api/me/* routes', async ({ page }) => {
    await login(page, ADMIN_A);
    await page.waitForURL(/\/admin\/overview/);
    const key = await createKey(page, `${KEY_NAME_PREFIX}-me`);
    const res = await page.request.get('/api/me/assets', {
      headers: { Authorization: `Bearer ${key.secret}` },
    });
    expect(res.status()).toBe(401);
  });

  test('AC-001.6: USER JWT cannot list API keys', async ({ page }) => {
    await login(page, USER_EMAIL);
    await page.waitForURL(/\/dashboard/);
    const jwt = await token(page);
    const res = await page.request.get('/api/p/api-keys', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('AC-001.7: an expired key is rejected', async ({ page }) => {
    const expiredSecret = await seedRawApiKey(adminAId, { expiresAt: new Date(Date.now() - 60_000) });
    await login(page, ADMIN_A);
    await page.waitForURL(/\/admin\/overview/);
    const res = await page.request.get('/api/p/assets', {
      headers: { Authorization: `Bearer ${expiredSecret}` },
    });
    expect(res.status()).toBe(401);
  });

  test('AC-001.9: any admin sees and can revoke another admin\'s key', async ({ page }) => {
    await login(page, ADMIN_A);
    await page.waitForURL(/\/admin\/overview/);
    const key = await createKey(page, `${KEY_NAME_PREFIX}-cross`);

    await login(page, ADMIN_B);
    await page.waitForURL(/\/admin\/overview/);
    const jwtB = await token(page);

    const listRes = await page.request.get('/api/p/api-keys', {
      headers: { Authorization: `Bearer ${jwtB}` },
    });
    expect(listRes.status()).toBe(200);
    const list = (await listRes.json()) as { data: { apiKeys: { id: string; ownerEmail: string }[] } };
    const seen = list.data.apiKeys.find((k) => k.id === key.id);
    expect(seen).toBeTruthy();
    expect(seen?.ownerEmail).toBe(ADMIN_A);

    const del = await page.request.delete(`/api/p/api-keys/${key.id}`, {
      headers: { Authorization: `Bearer ${jwtB}` },
    });
    expect(del.status()).toBe(200);

    const res = await page.request.get('/api/p/assets', {
      headers: { Authorization: `Bearer ${key.secret}` },
    });
    expect(res.status()).toBe(401);
  });

  test('AC-001.10: a key cannot reach the key-management routes', async ({ page }) => {
    await login(page, ADMIN_A);
    await page.waitForURL(/\/admin\/overview/);
    const key = await createKey(page, `${KEY_NAME_PREFIX}-mgmt`);
    const res = await page.request.get('/api/p/api-keys', {
      headers: { Authorization: `Bearer ${key.secret}` },
    });
    expect(res.status()).toBe(401);
  });

  test('AC-001.11: regenerate rotates the secret, old fails, new works', async ({ page }) => {
    await login(page, ADMIN_A);
    await page.waitForURL(/\/admin\/overview/);
    const key = await createKey(page, `${KEY_NAME_PREFIX}-regen`);
    const jwt = await token(page);

    const regen = await page.request.post(`/api/p/api-keys/${key.id}/regenerate`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(regen.status()).toBe(200);
    const newSecret = ((await regen.json()) as { data: { apiKey: { id: string; secret: string } } }).data.apiKey;
    expect(newSecret.id).toBe(key.id);
    expect(newSecret.secret).not.toBe(key.secret);

    const oldRes = await page.request.get('/api/p/assets', {
      headers: { Authorization: `Bearer ${key.secret}` },
    });
    expect(oldRes.status()).toBe(401);

    const newRes = await page.request.get('/api/p/assets', {
      headers: { Authorization: `Bearer ${newSecret.secret}` },
    });
    expect(newRes.status()).toBe(200);
  });

  test('AC-001.12: Idempotency-Key replays a result and 409s on body mismatch', async ({ page }) => {
    await login(page, ADMIN_A);
    await page.waitForURL(/\/admin\/overview/);
    const jwt = await token(page);
    const headers = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'e2e-api001-idem' };

    const first = await page.request.post('/api/p/api-keys', {
      headers,
      data: { name: `${KEY_NAME_PREFIX}-idem` },
    });
    expect(first.status()).toBe(201);
    const firstSecret = ((await first.json()) as { data: { apiKey: { secret: string } } }).data.apiKey.secret;

    // Same key + same body → replay the exact first response (no second key created).
    const replay = await page.request.post('/api/p/api-keys', {
      headers,
      data: { name: `${KEY_NAME_PREFIX}-idem` },
    });
    expect(replay.status()).toBe(201);
    const replaySecret = ((await replay.json()) as { data: { apiKey: { secret: string } } }).data.apiKey.secret;
    expect(replaySecret).toBe(firstSecret);

    const count = await withDb(async (client) => {
      const r = await client.query<{ count: string }>('SELECT COUNT(*) FROM api_key WHERE name = $1', [
        `${KEY_NAME_PREFIX}-idem`,
      ]);
      return Number(r.rows[0]?.count ?? 0);
    });
    expect(count).toBe(1);

    // Same key + different body → 409.
    const conflict = await page.request.post('/api/p/api-keys', {
      headers,
      data: { name: `${KEY_NAME_PREFIX}-idem-changed` },
    });
    expect(conflict.status()).toBe(409);
  });

  test('AC-001.13: a full-admin key passes the seam across every admin area', async ({ page }) => {
    await login(page, ADMIN_A);
    await page.waitForURL(/\/admin\/overview/);
    const key = await createKey(page, `${KEY_NAME_PREFIX}-full`);
    const auth = { Authorization: `Bearer ${key.secret}` };

    for (const path of [
      '/api/p/assets',
      '/api/p/sites',
      '/api/p/users',
      '/api/p/manufacturers',
      '/api/p/vendors',
      '/api/p/stats/overview',
    ]) {
      const res = await page.request.get(path, { headers: auth });
      expect(res.status(), `GET ${path}`).toBe(200);
    }

    // Write path: assets:write is satisfied by the full-admin key.
    const created = await page.request.post('/api/p/assets', {
      headers: { ...auth, 'Content-Type': 'application/json' },
      data: { name: 'E2E API001 KeyAsset', serialNumber: `${ASSET_SERIAL}-KEY` },
    });
    expect([200, 201]).toContain(created.status());
    await withDb((client) => client.query('DELETE FROM asset WHERE serial_number = $1', [`${ASSET_SERIAL}-KEY`]));
  });

  test('US-API5: admin creates a key through the UI and sees the secret once', async ({ page }) => {
    await login(page, ADMIN_A);
    await page.waitForURL(/\/admin\/overview/);
    await page.goto('/admin/api-keys');

    await expect(page.getByRole('heading', { name: 'API keys' })).toBeVisible();
    await page.getByTestId('create-api-key').click();
    await page.getByTestId('api-key-name').fill(`${KEY_NAME_PREFIX}-ui`);
    await page.getByTestId('api-key-submit').click();

    const secretField = page.getByTestId('api-key-secret');
    await expect(secretField).toBeVisible();
    await expect(secretField).toHaveValue(/^nsk_live_/);

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('api-keys-table')).toContainText(`${KEY_NAME_PREFIX}-ui`);
  });
});
