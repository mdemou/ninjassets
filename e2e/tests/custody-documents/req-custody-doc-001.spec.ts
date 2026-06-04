import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-CUSTODY-DOC-001: Printable custody receipt + signed PDF upload
 *
 * "As an admin, I can generate a printable custody receipt PDF, upload the signed
 *  copy, preview it on the asset, and delete it — each tracked in the audit log."
 *  (SPEC-CUSTODY-DOC-001)
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-cdoc001-admin@test.com';
const USER_EMAIL = 'e2e-cdoc001-user@test.com';
const USER_NAME = 'E2E CDOC001 Assignee';
const ASSET_NAME = 'E2E CDOC001 Laptop';
const SERIAL = 'E2E-CDOC1-001';

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: TEST_DB_NAME,
};

// A minimal but structurally valid PDF (starts with the %PDF- signature).
const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

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

async function seedAsset(status: string, assignedUserId: string | null): Promise<string> {
  return withDb(async (client) => {
    await client.query('DELETE FROM asset WHERE serial_number = $1', [SERIAL]);
    const res = await client.query<{ id: string }>(
      `INSERT INTO asset (name, model, serial_number, status, assigned_user_id)
       VALUES ($1, '', $2, $3, $4) RETURNING id`,
      [ASSET_NAME, SERIAL, status, assignedUserId],
    );
    return res.rows[0].id;
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (client) => {
    await client.query('DELETE FROM transaction WHERE asset_name = $1', [ASSET_NAME]);
    // asset_custody_document rows cascade when the asset is removed.
    await client.query('DELETE FROM asset WHERE serial_number = $1', [SERIAL]);
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
  return { Authorization: `Bearer ${token}` };
}

async function readTransactionActions(): Promise<string[]> {
  return withDb(async (client) => {
    const res = await client.query<{ action: string }>(
      'SELECT action FROM transaction WHERE asset_name = $1 ORDER BY date_created',
      [ASSET_NAME],
    );
    return res.rows.map((r) => r.action);
  });
}

test.describe('REQ-CUSTODY-DOC-001: Custody receipt + signed upload', () => {
  let assigneeId: string;
  let assetId: string;

  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'E2E CDOC001 Admin', 'ADMIN');
    assigneeId = await seedUser(USER_EMAIL, USER_NAME, 'USER');
    assetId = await seedAsset('STOCK', null);
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test('AC-001.1: generate a CHECK_OUT receipt PDF for a STOCK asset', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.waitForURL(/\/admin\/overview/);
    const headers = await authHeaders(page);

    const res = await page.request.post(
      `/api/p/assets/${assetId}/custody-documents/generate?lang=en`,
      {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: { type: 'CHECK_OUT', targetUserId: assigneeId },
      },
    );
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('application/pdf');
    const body = await res.body();
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(500);
  });

  test('AC-001.6: generating a CHECK_IN for a STOCK asset is rejected', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.waitForURL(/\/admin\/overview/);
    const headers = await authHeaders(page);

    const res = await page.request.post(
      `/api/p/assets/${assetId}/custody-documents/generate`,
      {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: { type: 'CHECK_IN' },
      },
    );
    expect(res.status()).toBe(400);
  });

  test('AC-001.2 / AC-001.3 / AC-001.4: upload, preview and delete a signed PDF', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.waitForURL(/\/admin\/overview/);
    const headers = await authHeaders(page);

    // AC-001.2: upload the signed PDF.
    const uploadRes = await page.request.post(
      `/api/p/assets/${assetId}/custody-documents/upload?type=CHECK_OUT&filename=signed.pdf`,
      { headers: { ...headers, 'Content-Type': 'application/pdf' }, data: PDF_BYTES },
    );
    expect(uploadRes.ok()).toBeTruthy();
    const uploaded = (await uploadRes.json()) as { data: { document: { id: string } } };
    const documentId = uploaded.data.document.id;
    expect(documentId).toBeTruthy();

    // Listed on the asset.
    const listRes = await page.request.get(`/api/p/assets/${assetId}/custody-documents`, { headers });
    expect(listRes.ok()).toBeTruthy();
    const list = (await listRes.json()) as { data: { documents: Array<{ id: string }> } };
    expect(list.data.documents.map((d) => d.id)).toContain(documentId);

    // Audit logged.
    await expect.poll(readTransactionActions).toContain('CUSTODY_DOCUMENT_UPLOADED');

    // AC-001.3: preview streams the PDF inline.
    const fileRes = await page.request.get(
      `/api/p/assets/${assetId}/custody-documents/${documentId}/file`,
      { headers },
    );
    expect(fileRes.ok()).toBeTruthy();
    expect(fileRes.headers()['content-type']).toContain('application/pdf');

    // AC-001.4: delete removes it and audits the deletion.
    const delRes = await page.request.delete(
      `/api/p/assets/${assetId}/custody-documents/${documentId}`,
      { headers },
    );
    expect(delRes.ok()).toBeTruthy();

    const afterList = await page.request.get(`/api/p/assets/${assetId}/custody-documents`, { headers });
    const after = (await afterList.json()) as { data: { documents: Array<{ id: string }> } };
    expect(after.data.documents).toHaveLength(0);
    await expect.poll(readTransactionActions).toContain('CUSTODY_DOCUMENT_DELETED');
  });

  test('AC-001.5: uploading a non-PDF body is rejected with 400', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.waitForURL(/\/admin\/overview/);
    const headers = await authHeaders(page);

    const res = await page.request.post(
      `/api/p/assets/${assetId}/custody-documents/upload?type=CHECK_OUT&filename=fake.pdf`,
      {
        // Declared as PDF (passes the route allow-list) but the bytes are not a PDF,
        // so the domain's %PDF- magic-byte check rejects it.
        headers: { ...headers, 'Content-Type': 'application/pdf' },
        data: Buffer.from('this is definitely not a pdf'),
      },
    );
    expect(res.status()).toBe(400);
  });
});
