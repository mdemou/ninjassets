import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import http from 'http';
import { AddressInfo } from 'net';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-WEBHOOK-001: Webhooks + domain event catalog (SPEC-WEBHOOK-001 §14).
 *
 * "As an admin I register Slack/Discord/Telegram destinations, choose which
 *  events each receives, and trust that a broken destination never affects the
 *  triggering operation or user emails."
 *
 * Delivery is asserted against a local mock receiver (the backend runs with
 * WEBHOOK_ALLOW_INSECURE_TARGETS=true so loopback http targets are accepted).
 */

const PASSWORD = 'Test1234!';
const ADMIN = 'e2e-webhook001-admin@test.com';
const USER = 'e2e-webhook001-user@test.com';
const NAME_PREFIX = 'e2e-webhook001';
const ASSET_SERIAL = 'E2E-WEBHOOK001-ASSET';

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

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM webhook_destination WHERE name LIKE $1', [`${NAME_PREFIX}%`]);
    await client.query('DELETE FROM asset WHERE serial_number = $1', [ASSET_SERIAL]);
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [[ADMIN, USER]]);
  });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/logout');
  await page.waitForURL(/\/login/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function token(page: Page): Promise<string> {
  const t = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!t) throw new Error('Missing auth token');
  return t;
}

// --- local mock receiver -------------------------------------------------

interface Received {
  path: string;
  body: unknown;
}

let server: http.Server;
let received: Received[] = [];
let baseUrl = '';

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let body: unknown = raw;
      try {
        body = JSON.parse(raw);
      } catch {
        /* keep raw */
      }
      received.push({ path: req.url ?? '', body });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

function authHeaders(jwt: string) {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

async function createDestination(
  page: Page,
  jwt: string,
  data: Record<string, unknown>,
): Promise<{ status: number; id?: string; targetHint?: string }> {
  const res = await page.request.post('/api/p/webhooks/destinations', {
    headers: authHeaders(jwt),
    data,
  });
  if (res.status() !== 201) return { status: res.status() };
  const body = (await res.json()) as { data: { destination: { id: string; targetHint: string } } };
  return { status: 201, id: body.data.destination.id, targetHint: body.data.destination.targetHint };
}

test.beforeEach(async () => {
  received = [];
  await cleanup();
});

test.afterEach(async () => {
  await cleanup();
});

test.describe('REQ-WEBHOOK-001: Webhooks + domain event catalog', () => {
  test.describe('AC-WEBHOOK-001.7: event catalog completeness (drift guard)', () => {
    test('every catalog event has a non-empty EN and ES label', async ({ page }) => {
      await seedUser(ADMIN, `${NAME_PREFIX} admin`, 'ADMIN');
      await login(page, ADMIN);
      const jwt = await token(page);

      const res = await page.request.get('/api/p/webhooks/events', { headers: authHeaders(jwt) });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        data: { events: { type: string; category: string; labelEn: string; labelEs: string }[] };
      };
      const events = body.data.events;
      expect(events.length).toBeGreaterThan(0);
      for (const e of events) {
        expect(e.labelEn.trim().length).toBeGreaterThan(0);
        expect(e.labelEs.trim().length).toBeGreaterThan(0);
        expect(e.category.length).toBeGreaterThan(0);
      }
      expect(events.map((e) => e.type)).toContain('asset.assigned');
    });
  });

  test.describe('AC-WEBHOOK-001.1: create + masked target', () => {
    test('destination is created and the target is masked on read', async ({ page }) => {
      await seedUser(ADMIN, `${NAME_PREFIX} admin`, 'ADMIN');
      await login(page, ADMIN);
      const jwt = await token(page);

      const created = await createDestination(page, jwt, {
        name: `${NAME_PREFIX}-slack`,
        platform: 'slack',
        target: { url: `${baseUrl}/secret-hook-path` },
        subscribedEvents: ['asset.assigned'],
      });
      expect(created.status).toBe(201);
      // Masked: host only, never the secret path.
      expect(created.targetHint).not.toContain('secret-hook-path');
      expect(created.targetHint).toContain('127.0.0.1');

      const list = await page.request.get('/api/p/webhooks/destinations', { headers: authHeaders(jwt) });
      expect(list.status()).toBe(200);
      const body = (await list.json()) as {
        data: { destinations: { id: string; targetHint: string }[] };
      };
      expect(body.data.destinations.some((d) => d.id === created.id)).toBe(true);
      expect(JSON.stringify(body.data)).not.toContain('secret-hook-path');
    });
  });

  test.describe('AC-WEBHOOK-001.2: unknown event rejected', () => {
    test('creating with an event outside the catalog returns 400', async ({ page }) => {
      await seedUser(ADMIN, `${NAME_PREFIX} admin`, 'ADMIN');
      await login(page, ADMIN);
      const jwt = await token(page);

      const created = await createDestination(page, jwt, {
        name: `${NAME_PREFIX}-bad`,
        platform: 'slack',
        target: { url: `${baseUrl}/x` },
        subscribedEvents: ['asset.not_a_real_event'],
      });
      expect(created.status).toBe(400);
    });
  });

  test.describe('AC-WEBHOOK-001.8: access control', () => {
    test('a non-admin cannot list destinations', async ({ page }) => {
      await seedUser(USER, `${NAME_PREFIX} user`, 'USER');
      await login(page, USER);
      const jwt = await token(page);

      const res = await page.request.get('/api/p/webhooks/destinations', { headers: authHeaders(jwt) });
      expect([401, 403]).toContain(res.status());
    });
  });

  test.describe('AC-WEBHOOK-001.3/4/6: filtering, disabled, and failure isolation', () => {
    test('an event delivers only to subscribed+enabled destinations and never breaks the operation', async ({
      page,
    }) => {
      await seedUser(ADMIN, `${NAME_PREFIX} admin`, 'ADMIN');
      const assigneeId = await seedUser(USER, `${NAME_PREFIX} user`, 'USER');
      await login(page, ADMIN);
      const jwt = await token(page);

      // A: subscribed to asset.assigned, enabled  → should receive
      await createDestination(page, jwt, {
        name: `${NAME_PREFIX}-A`,
        platform: 'slack',
        enabled: true,
        target: { url: `${baseUrl}/hookA` },
        subscribedEvents: ['asset.assigned'],
      });
      // B: subscribed to a different event       → should NOT receive
      await createDestination(page, jwt, {
        name: `${NAME_PREFIX}-B`,
        platform: 'discord',
        enabled: true,
        target: { url: `${baseUrl}/hookB` },
        subscribedEvents: ['asset.deleted'],
      });
      // C: subscribed to asset.assigned but DISABLED → should NOT receive
      await createDestination(page, jwt, {
        name: `${NAME_PREFIX}-C`,
        platform: 'slack',
        enabled: false,
        target: { url: `${baseUrl}/hookC` },
        subscribedEvents: ['asset.assigned'],
      });
      // D: subscribed to asset.assigned but UNREACHABLE → failure must be isolated
      await createDestination(page, jwt, {
        name: `${NAME_PREFIX}-D`,
        platform: 'slack',
        enabled: true,
        target: { url: 'http://127.0.0.1:1/dead' },
        subscribedEvents: ['asset.assigned'],
      });

      // Trigger asset.assigned by creating an asset already assigned to a user.
      const createAsset = await page.request.post('/api/p/assets', {
        headers: authHeaders(jwt),
        data: {
          name: `${NAME_PREFIX} Asset`,
          serialNumber: ASSET_SERIAL,
          status: 'ASSIGNED',
          assignedUserId: assigneeId,
        },
      });
      // AC-6: the operation succeeds despite destination D being unreachable.
      expect([200, 201]).toContain(createAsset.status());

      // AC-4: A received a Slack-shaped payload.
      await waitFor(() => received.some((r) => r.path === '/hookA'));
      const hookA = received.find((r) => r.path === '/hookA');
      expect(hookA).toBeTruthy();
      expect(JSON.stringify(hookA?.body)).toContain('blocks');

      // Give any stray deliveries time to arrive, then assert none did.
      await new Promise((r) => setTimeout(r, 1000));
      // AC-4: B (different event) did not receive.
      expect(received.some((r) => r.path === '/hookB')).toBe(false);
      // AC-3: C (disabled) did not receive.
      expect(received.some((r) => r.path === '/hookC')).toBe(false);
    });
  });
});
