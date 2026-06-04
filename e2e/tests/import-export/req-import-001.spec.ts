import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_DB_NAME } from '../../config';

/**
 * REQ-IMPORT-001 / REQ-IMPORT-002: Bulk import/export hub (SPEC-IMPORT-001 §14).
 *
 * Admins upload CSV/XLSX/JSON, map columns, run a mandatory dry-run, then commit
 * asynchronously. Exports round-trip the UUID `id`. Feature is admin-only.
 */

const PASSWORD = 'Test1234!';
const ADMIN = 'e2e-import001-admin@test.com';
const USER = 'e2e-import001-user@test.com';
const SERIAL = 'E2E-IMPORT001-ASSET';

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
    await client.query('DELETE FROM import_job_row WHERE true');
    await client.query('DELETE FROM import_job WHERE true');
    await client.query('DELETE FROM export_job WHERE true');
    await client.query('DELETE FROM asset WHERE serial_number LIKE $1', [`${SERIAL}%`]);
    await client.query('DELETE FROM "user" WHERE email = ANY($1)', [[ADMIN, USER]]);
  });
}

async function login(page: Page, email: string): Promise<string> {
  await page.goto('/logout');
  await page.waitForURL(/\/login/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/(admin|dashboard)/);
  const t = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!t) throw new Error('Missing auth token');
  return t;
}

function auth(jwt: string): Record<string, string> {
  return { Authorization: `Bearer ${jwt}` };
}

/** Upload a CSV body and drive the job through dry-run; returns the job id + final status. */
async function uploadCsv(
  req: APIRequestContext,
  jwt: string,
  entityType: string,
  csv: string,
): Promise<string> {
  const res = await req.post(
    `/api/p/import-jobs?entityType=${entityType}&fileFormat=CSV&filename=test.csv`,
    { headers: { ...auth(jwt), 'Content-Type': 'text/csv' }, data: csv },
  );
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: { job: { id: string }; headers: string[] } };
  return body.data.job.id;
}

async function setIdentityMapping(
  req: APIRequestContext,
  jwt: string,
  jobId: string,
  headers: string[],
  options: Record<string, unknown> = {},
): Promise<void> {
  const columns: Record<string, string> = {};
  for (const h of headers) columns[h] = h;
  const res = await req.patch(`/api/p/import-jobs/${jobId}/mapping`, {
    headers: { ...auth(jwt), 'Content-Type': 'application/json' },
    data: { columns, options },
  });
  expect(res.ok()).toBeTruthy();
}

async function pollImport(req: APIRequestContext, jwt: string, jobId: string, until: string[]): Promise<string> {
  for (let i = 0; i < 30; i += 1) {
    const res = await req.get(`/api/p/import-jobs/${jobId}`, { headers: auth(jwt) });
    const body = (await res.json()) as { data: { job: { status: string } } };
    if (until.includes(body.data.job.status)) return body.data.job.status;
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error('Import job did not reach a terminal status in time');
}

test.describe('REQ-IMPORT-001: Asset import/export (MVP)', () => {
  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN, 'E2E Import Admin', 'ADMIN');
    await seedUser(USER, 'E2E Import User', 'USER');
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test('AC-001.1: asset template CSV contains canonical headers including id', async ({ page }) => {
    const jwt = await login(page, ADMIN);
    const res = await page.request.get('/api/p/import-templates/ASSET?format=csv', { headers: auth(jwt) });
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    const header = text.replace(/^﻿/, '').split('\n')[0];
    expect(header).toContain('id');
    expect(header).toContain('serial_number');
  });

  test('AC-001.2 / AC-001.3: upload → dry-run → commit creates STOCK asset; export contains id', async ({ page }) => {
    const jwt = await login(page, ADMIN);
    const req = page.request;
    const csv = `name,serial_number,status\nE2E Import Laptop,${SERIAL}-1,STOCK\n`;
    const jobId = await uploadCsv(req, jwt, 'ASSET', csv);
    await setIdentityMapping(req, jwt, jobId, ['name', 'serial_number', 'status'], {
      partialMode: 'ALL_OR_NOTHING',
    });

    await req.post(`/api/p/import-jobs/${jobId}/dry-run`, { headers: auth(jwt) });
    expect(await pollImport(req, jwt, jobId, ['DRY_RUN_SUCCEEDED', 'DRY_RUN_FAILED'])).toBe('DRY_RUN_SUCCEEDED');

    await req.post(`/api/p/import-jobs/${jobId}/commit`, { headers: auth(jwt) });
    expect(await pollImport(req, jwt, jobId, ['SUCCEEDED', 'PARTIAL_SUCCEEDED', 'FAILED'])).toBe('SUCCEEDED');

    const created = await withDb((c) =>
      c.query<{ status: string }>('SELECT status FROM asset WHERE serial_number = $1', [`${SERIAL}-1`]),
    );
    expect(created.rows[0]?.status).toBe('STOCK');

    // Export FULL → file includes the id column for every row.
    const exp = await req.post('/api/p/export-jobs', {
      headers: { ...auth(jwt), 'Content-Type': 'application/json' },
      data: { entityType: 'ASSET', fileFormat: 'CSV', scope: 'FULL', filter: null },
    });
    const expId = ((await exp.json()) as { data: { job: { id: string } } }).data.job.id;
    let downloadOk = false;
    for (let i = 0; i < 30; i += 1) {
      const s = await req.get(`/api/p/export-jobs/${expId}`, { headers: auth(jwt) });
      const status = ((await s.json()) as { data: { job: { status: string } } }).data.job.status;
      if (status === 'SUCCEEDED') {
        downloadOk = true;
        break;
      }
      expect(status).not.toBe('FAILED');
      await new Promise((r) => setTimeout(r, 700));
    }
    expect(downloadOk).toBeTruthy();
    const dl = await req.get(`/api/p/export-jobs/${expId}/download`, { headers: auth(jwt) });
    const text = await dl.text();
    expect(text.replace(/^﻿/, '').split('\n')[0]).toContain('id');
    expect(text).toContain(`${SERIAL}-1`);
  });

  test('AC-001.5: duplicate serial_number on create → dry-run row ERROR', async ({ page }) => {
    const jwt = await login(page, ADMIN);
    const req = page.request;
    // Seed an existing asset with the serial.
    await withDb((c) =>
      c.query(
        `INSERT INTO asset (name, model, serial_number, status) VALUES ('Existing', '', $1, 'STOCK')`,
        [`${SERIAL}-DUP`],
      ),
    );
    const csv = `name,serial_number,status\nDup Laptop,${SERIAL}-DUP,STOCK\n`;
    const jobId = await uploadCsv(req, jwt, 'ASSET', csv);
    await setIdentityMapping(req, jwt, jobId, ['name', 'serial_number', 'status']);
    await req.post(`/api/p/import-jobs/${jobId}/dry-run`, { headers: auth(jwt) });
    expect(await pollImport(req, jwt, jobId, ['DRY_RUN_SUCCEEDED', 'DRY_RUN_FAILED'])).toBe('DRY_RUN_FAILED');

    const rows = await req.get(`/api/p/import-jobs/${jobId}/rows?severity=ERROR`, { headers: auth(jwt) });
    const body = (await rows.json()) as { data: { rows: { messages: { field: string | null }[] }[] } };
    expect(body.data.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(body.data.rows)).toContain('serial_number');
  });

  test('AC-001.10: USER role cannot create an import job', async ({ page }) => {
    const jwt = await login(page, USER);
    const res = await page.request.post(
      '/api/p/import-jobs?entityType=ASSET&fileFormat=CSV&filename=x.csv',
      { headers: { ...auth(jwt), 'Content-Type': 'text/csv' }, data: 'name,serial_number\nA,B\n' },
    );
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
