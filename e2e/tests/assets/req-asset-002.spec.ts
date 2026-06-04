import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-ASSET-002: Asset image, QR code, and detail page
 *
 * "As an admin, I can attach an image to an asset, generate its QR label, and
 *  open a detail page that shows the asset and its history."
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-asset002-admin@test.com';
const SERIAL = 'E2E-A2-DETAIL';
const ASSET_NAME = 'E2E A2 Detailed Server';

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

async function seedAdmin(): Promise<void> {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(PASSWORD, salt);
  await withDb(async (client) => {
    const r = await client.query<{ id: number }>("SELECT id FROM role WHERE name = 'ADMIN' LIMIT 1");
    const roleId = r.rows[0]?.id;
    if (!roleId) throw new Error('ADMIN role not found');
    await client.query('DELETE FROM "user" WHERE email = $1', [ADMIN_EMAIL]);
    await client.query(
      `INSERT INTO "user" (email, display_name, hashed, salt, role_id, status)
       VALUES ($1, 'E2E Asset002 Admin', $2, $3, $4, 'ACTIVE')`,
      [ADMIN_EMAIL, hashed, salt, roleId],
    );
  });
}

async function seedAsset(): Promise<string> {
  return withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number = $1', [SERIAL]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status)
       VALUES ($1, 'Model X', $2, 'STOCK') RETURNING id`,
      [ASSET_NAME, SERIAL],
    );
    return res.rows[0].id;
  });
}

async function assetImageFilename(): Promise<string | null> {
  return withDb(async (client) => {
    const res = await client.query<{ image_filename: string | null }>(
      'SELECT image_filename FROM asset WHERE serial_number = $1',
      [SERIAL],
    );
    return res.rows[0]?.image_filename ?? null;
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number = $1', [SERIAL]);
    await client.query('DELETE FROM "user" WHERE email = $1', [ADMIN_EMAIL]);
  });
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/admin\/overview/);
}

test.describe('REQ-ASSET-002: Asset image, QR code, and detail page', () => {
  let assetId: string;

  test.beforeEach(async () => {
    await seedAdmin();
    assetId = await seedAsset();
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-ASSET-002.1: Uploading an asset image', () => {
    test('the uploaded image is stored and served back as webp', async ({ page }) => {
      await loginAdmin(page);

      const result = await page.evaluate(
        async ({ id, b64 }) => {
          const token = localStorage.getItem('auth_token');
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const upload = await fetch(`/api/p/assets/${id}/image`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
            body: bytes,
          });
          const get = await fetch(`/api/p/assets/${id}/image`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return {
            uploadStatus: upload.status,
            getStatus: get.status,
            contentType: get.headers.get('content-type'),
          };
        },
        { id: assetId, b64: PNG_BASE64 },
      );

      expect(result.uploadStatus).toBeLessThan(400);
      expect(result.getStatus).toBe(200);
      expect(result.contentType).toContain('image/webp');
      await expect.poll(async () => await assetImageFilename()).toBeTruthy();
    });
  });

  test.describe('AC-ASSET-002.2: Generating a QR label', () => {
    test('the QR endpoint returns a PNG image', async ({ page }) => {
      await loginAdmin(page);

      const result = await page.evaluate(async (id) => {
        const res = await fetch(`/api/p/assets/${id}/qr`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
        });
        const buf = await res.arrayBuffer();
        return {
          status: res.status,
          contentType: res.headers.get('content-type'),
          byteLength: buf.byteLength,
        };
      }, assetId);

      expect(result.status).toBe(200);
      expect(result.contentType).toContain('image/png');
      expect(result.byteLength).toBeGreaterThan(0);
    });
  });

  test.describe('AC-ASSET-002.3: Viewing the asset detail page', () => {
    test('the detail page shows the asset name, serial, and history', async ({ page }) => {
      await loginAdmin(page);
      await page.goto(`/admin/assets/${assetId}`);

      // The detail page renders the asset in editable fields.
      await expect(page.getByLabel('Name', { exact: true })).toHaveValue(ASSET_NAME);
      await expect(page.getByLabel('Serial Number')).toHaveValue(SERIAL);
      await page.getByRole('tab', { name: 'History' }).click();
      await expect(page.getByRole('heading', { name: 'Transaction history' })).toBeVisible();
    });
  });
});
