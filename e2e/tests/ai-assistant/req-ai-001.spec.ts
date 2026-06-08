import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { TEST_BACKEND_PORT, TEST_DB_NAME } from '../../config';

const BACKEND_URL = `http://localhost:${TEST_BACKEND_PORT}`;

/**
 * REQ-AI-ASSISTANT-001: Admin AI assistant (RAG)
 *
 * "As an admin, I open a chat in the admin shell, ask questions about ninjasset, see
 *  streamed answers with source citations, in my UI language, and keep conversations."
 *
 * The aiagent is mocked at the backend via MOCK_AI=true (playwright.config.ts) — canned
 * SSE, no Qdrant/LLM/model. PII (AC-001.16) is covered by the aiagent pytest suite.
 */

const PASSWORD = 'Test1234!';
const ADMIN_EMAIL = 'e2e-ai001-admin@test.com';
const USER_EMAIL = 'e2e-ai001-user@test.com';
const EMAIL_PREFIX = 'e2e-ai001-';

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
  // ai_conversation has ON DELETE CASCADE → messages go with the owner.
  await withDb((client) => client.query('DELETE FROM "user" WHERE email LIKE $1', [`${EMAIL_PREFIX}%`]));
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/admin\/overview/);
}

async function loginUser(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function ask(page: Page, text: string): Promise<void> {
  await page.getByTestId('ai-input').fill(text);
  await page.getByTestId('ai-send').click();
}

test.describe('REQ-AI-ASSISTANT-001: Admin AI assistant', () => {
  test.beforeEach(async () => {
    await cleanup();
    await seedUser(ADMIN_EMAIL, 'E2E AI Admin', 'ADMIN');
    await seedUser(USER_EMAIL, 'E2E AI User', 'USER');
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test.describe('AC-001.1 / .12 / .13: ask, stream, cite', () => {
    test('admin asks and gets a streamed answer with a source citation', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/ai');

      await ask(page, 'How do I create an API key?');

      // streamed assistant answer settles with content (AC-001.1 / .13)
      const answer = page.getByTestId('ai-message-assistant').last();
      await expect(answer).toContainText('API keys are created', { timeout: 15_000 });

      // user turn is echoed
      await expect(page.getByTestId('ai-message-user').last()).toContainText('How do I create an API key?');

      // source citation shows the document name (AC-001.12)
      const sources = page.getByTestId('ai-sources');
      await expect(sources).toContainText('spec-api-automation.md');
    });
  });

  test.describe('AC-001.4: off-corpus question', () => {
    test('a weather question returns the no-relevant-docs message and no sources', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/ai');

      await ask(page, 'what is the weather today?');

      await expect(page.getByTestId('ai-message-assistant').last()).toContainText(
        'No relevant documentation',
        { timeout: 15_000 },
      );
      await expect(page.getByTestId('ai-sources')).toHaveCount(0);
    });
  });

  test.describe('AC-001.6: multi-turn conversation persists', () => {
    test('two turns are stored and reload restores the history', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/ai');

      await ask(page, 'How do I create an API key?');
      await expect(page.getByTestId('ai-message-assistant').last()).toContainText('API keys are created', {
        timeout: 15_000,
      });

      await ask(page, 'And how do I revoke it?');
      await expect(page.getByTestId('ai-message-assistant')).toHaveCount(2, { timeout: 15_000 });
      await expect(page.getByTestId('ai-message-user')).toHaveCount(2);

      // Reload, then re-open the conversation from the list → both turns are back.
      await page.reload();
      await page.getByTestId('ai-conversation-item').first().click();
      await expect(page.getByTestId('ai-message-user')).toHaveCount(2, { timeout: 15_000 });
      await expect(page.getByTestId('ai-message-assistant')).toHaveCount(2);
    });
  });

  test.describe('AC-001.7 / .8 / .9 / .10 / .11: language', () => {
    test('English UI yields an English answer', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/ai');
      await ask(page, 'How do I create an API key?');
      await expect(page.getByTestId('ai-message-assistant').last()).toContainText('API keys are created', {
        timeout: 15_000,
      });
    });

    test('Spanish UI yields a Spanish answer and Spanish labels, persisted across reload', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/ai');
      // Persist Spanish, reload → chrome + answers use the persisted locale (AC-001.11).
      await page.evaluate(() => localStorage.setItem('language', 'es'));
      await page.reload();

      // Chrome is Spanish (AC-001.10)
      await expect(page.getByTestId('ai-send')).toHaveText('Enviar');
      await expect(page.getByTestId('ai-input')).toHaveAttribute('placeholder', 'Escribe tu pregunta…');

      // Question typed in English, UI = Spanish → answer in Spanish (AC-001.8 / .9)
      await ask(page, 'How do I create an API key?');
      await expect(page.getByTestId('ai-message-assistant').last()).toContainText('claves de API se crean', {
        timeout: 15_000,
      });
    });
  });

  test.describe('AC-001.15: conversation list', () => {
    test('admin creates, switches, and deletes conversations', async ({ page }) => {
      await loginAdmin(page);
      await page.goto('/admin/ai');

      await ask(page, 'How do I create an API key?');
      await expect(page.getByTestId('ai-message-assistant').last()).toContainText('API keys are created', {
        timeout: 15_000,
      });

      await page.getByTestId('ai-new-conversation').click();
      await expect(page.getByTestId('ai-message-assistant')).toHaveCount(0);
      await ask(page, 'How do verified handovers work?');
      await expect(page.getByTestId('ai-message-assistant').last()).toContainText('API keys are created', {
        timeout: 15_000,
      });

      // Two conversations now exist; delete one and confirm the count drops.
      await expect(page.getByTestId('ai-conversation-item')).toHaveCount(2, { timeout: 15_000 });
      await page
        .getByTestId('ai-conversation-item')
        .first()
        .locator('xpath=following-sibling::button')
        .click();
      const modal = page.locator('div.z-200');
      await modal.getByRole('button', { name: 'Delete conversation' }).click();
      await expect(page.getByTestId('ai-conversation-item')).toHaveCount(1, { timeout: 15_000 });
    });
  });

  test.describe('AC-001.2 / .14: regular users excluded', () => {
    test('no AI sidebar item and /admin/ai redirects away', async ({ page }) => {
      await loginUser(page);
      await expect(page.getByRole('link', { name: 'AI Assistant' })).toHaveCount(0);

      await page.goto('/admin/ai');
      await page.waitForURL((url) => !url.pathname.startsWith('/admin/ai'));
    });
  });

  test.describe('AC-001.3: user JWT is rejected by the API', () => {
    test('POST /api/p/ai/chat with a user token returns 401', async ({ request }) => {
      const login = await request.post(`${BACKEND_URL}/api/session/login`, {
        data: { email: USER_EMAIL, password: PASSWORD, captchaToken: '', platform: 'web' },
      });
      expect(login.ok()).toBeTruthy();
      const token = (await login.json()).data.token as string;

      const chat = await request.post(`${BACKEND_URL}/api/p/ai/chat`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { message: 'hello there', locale: 'en' },
      });
      expect(chat.status()).toBe(401);
    });
  });

  test.describe('AC-001.5: disabled feature flag', () => {
    test('a non-interactive overlay covers the assistant when AI is disabled', async ({ page }) => {
      // Force the feature flag off for this test by rewriting public-config.
      await page.route('**/api/session/public-config', async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        if (body.data) body.data.aiEnabled = false;
        await route.fulfill({ response, json: body });
      });

      await loginAdmin(page);
      await page.goto('/admin/ai');

      await expect(page.getByTestId('ai-disabled-overlay')).toBeVisible();
      await expect(page.getByTestId('ai-input')).toBeDisabled();
    });
  });
});
