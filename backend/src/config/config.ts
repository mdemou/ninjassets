const configDefinition = {
  appName: 'ninjasset',
  /** Self-service registration (POST /api/session/register). Defaults to enabled. */
  signupEnabled: process.env.SIGNUP_ENABLED !== 'false',
  mockCaptcha: process.env.MOCK_CAPTCHA === 'true',
  mockEmail: process.env.MOCK_EMAIL === 'true',
  // Admin AI assistant (SPEC-AI-ASSISTANT-001). MOCK_AI returns canned SSE from the
  // backend (no aiagent/Qdrant/LLM) — mirrors MOCK_EMAIL/MOCK_CAPTCHA for E2E (D18).
  mockAi: process.env.MOCK_AI === 'true',
  /** Password must be at least 8 chars with one uppercase, one lowercase, and one digit */
  passwordRegex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  logLevel: process.env.LOG_LEVEL || 'info',
  server: {
    port: Number(process.env.PORT) || 3001,
    host: process.env.HOST || '0.0.0.0',
  },
  // Server-owned page size for paginated list endpoints. The client never decides this.
  pagination: {
    pageSize: Number(process.env.ADMIN_PAGE_SIZE) || 20,
  },
  uploads: {
    // Shared upload rules for avatars and asset images.
    imageMaxBytes: 1_048_576, // 1 MB — enforced at route level
    imageSize: 512, // square edge (px) after cover resize
    avatarPath: process.env.AVATAR_STORAGE_PATH || './uploads/avatars',
    assetImagePath: process.env.ASSET_IMAGE_STORAGE_PATH || './uploads/asset-images',
    manufacturerImagePath: process.env.MANUFACTURER_IMAGE_STORAGE_PATH || './uploads/manufacturer-images',
    vendorImagePath: process.env.VENDOR_IMAGE_STORAGE_PATH || './uploads/vendor-images',
    /** PNG edge length for on-demand asset QR codes (GET /api/p/assets/{id}/qr). */
    qrPngSize: Number(process.env.ASSET_QR_PNG_SIZE) || 512,
    // Signed custody-receipt PDFs (SPEC-CUSTODY-DOC-001). Stored as raw bytes
    // (no Sharp pipeline), separate from image uploads.
    custodyDocumentPath: process.env.CUSTODY_DOCUMENT_STORAGE_PATH || './uploads/custody-documents',
    custodyDocumentMaxBytes: Number(process.env.CUSTODY_DOCUMENT_MAX_BYTES) || 10_485_760, // 10 MB
  },
  // Custody receipt PDF generation (SPEC-CUSTODY-DOC-001).
  custody: {
    // Organization name printed on the receipt header. Falls back to the app name.
    orgName: process.env.CUSTODY_ORG_NAME || 'ninjasset',
    // Optional logo image path for the receipt header.
    orgLogoPath: process.env.CUSTODY_ORG_LOGO_PATH || '',
  },
  // Database connection - individual fields for programmatic access
  db: {
    postgres: {
      connection: {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'ninjasset',
      },
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || '',
      db: Number(process.env.REDIS_DB) || 0,
      // Redis list keys used as job queues consumed by queueConsumer.
      queues: {
        notifications: 'ninjasset:notifications',
        // In-flight list for the reliable BRPOPLPUSH protocol (§7, at-least-once).
        notificationsProcessing: 'ninjasset:notifications:processing',
        // Import/export job queue (SPEC-IMPORT-001 D-IMPORT-2). The worker prefers
        // this Redis list and falls back to DB-status polling when Redis is down.
        importExportJobs: 'ninjasset:import-export',
      },
    },
  },
  jwt: {
    admin: { secretKey: process.env.JWT_ADMIN_SECRET_KEY || 'admin-secret-dev' },
    user: { secretKey: process.env.JWT_USER_SECRET_KEY || 'user-secret-dev' },
  },
  captcha: {
    secretKey: process.env.RECAPTCHA_SECRET_KEY || '',
  },
  email: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@example.com',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
  tokenExpiry: {
    emailVerificationHours: Number(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS) || 24,
    passwordResetHours: Number(process.env.PASSWORD_RESET_EXPIRY_HOURS) || 1,
    handoverHours: Number(process.env.HANDOVER_TOKEN_EXPIRY_HOURS) || 72,
  },
  accountLockout: {
    maxAttempts: Number(process.env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS) || 5,
    durationMs: Number(process.env.ACCOUNT_LOCKOUT_DURATION_MS) || 900_000,
  },
  // Machine access — long-lived API keys (SPEC-API-001).
  apiKey: {
    // One prefix per deployment (label only): nsk_live_ in prod, nsk_test_ in dev/test.
    prefix: process.env.API_KEY_PREFIX || 'nsk_live_',
    // 0 = no default expiry. When > 0, create applies it unless caller passes expiresAt.
    defaultTtlDays: Number(process.env.API_KEY_DEFAULT_TTL_DAYS) || 0,
    // last_used_at write throttle to reduce write load on hot keys.
    lastUsedThrottleSec: Number(process.env.API_KEY_LAST_USED_THROTTLE_SEC) || 60,
  },
  apiAccessLog: {
    retentionDays: Number(process.env.API_ACCESS_LOG_RETENTION_DAYS) || 90,
  },
  apiIdempotency: {
    ttlHours: Number(process.env.API_IDEMPOTENCY_TTL_HOURS) || 24,
  },
  // Admin AI assistant (SPEC-AI-ASSISTANT-001). Backend proxies to the stateless
  // aiagent RAG service and owns conversation history + rate limiting + feature flag.
  ai: {
    // Feature flag — off unless explicitly enabled (or running in MOCK_AI mode).
    enabled: process.env.AI_ASSISTANT_ENABLED === 'true',
    agentUrl: process.env.AI_AGENT_URL || 'http://localhost:8000',
    agentApiKey: process.env.AI_AGENT_API_KEY || '',
    topK: Number(process.env.AI_TOP_K) || 5,
    messageMaxLength: Number(process.env.AI_MESSAGE_MAX_LENGTH) || 2000,
    messageMinLength: Number(process.env.AI_MESSAGE_MIN_LENGTH) || 3,
    // Last N messages (≈3 turns) sent to the LLM as context (§9.2).
    historyMessages: Number(process.env.AI_HISTORY_MESSAGES) || 6,
    // Rate limit: messages per admin per hour (Redis fixed window).
    rateLimitPerHour: Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 30,
    // Upstream request timeout for the aiagent SSE call.
    agentTimeoutMs: Number(process.env.AI_AGENT_TIMEOUT_MS) || 60_000,
  },
  // Outbound webhooks to Slack/Discord/Telegram (SPEC-WEBHOOK-001).
  webhooks: {
    // Master kill-switch for the dispatcher and the data-quality alert scan.
    enabled: process.env.WEBHOOKS_ENABLED !== 'false',
    httpTimeoutMs: Number(process.env.WEBHOOK_HTTP_TIMEOUT_MS) || 5000,
    // SSRF allowlists per platform (hostnames). Telegram uses a fixed API base.
    allowedHosts: {
      slack: (process.env.WEBHOOK_ALLOWED_SLACK_HOSTS || 'hooks.slack.com').split(','),
      discord: (
        process.env.WEBHOOK_ALLOWED_DISCORD_HOSTS || 'discord.com,discordapp.com,ptb.discord.com,canary.discord.com'
      ).split(','),
    },
    // E2E/dev only: accept http + arbitrary/loopback targets (local mock receiver).
    allowInsecureTargets: process.env.WEBHOOK_ALLOW_INSECURE_TARGETS === 'true',
    telegramApiBase: process.env.WEBHOOK_TELEGRAM_API_BASE || 'https://api.telegram.org',
    // Interval for the periodic data-quality alert scan (§9.3).
    alertScanIntervalMs: Number(process.env.WEBHOOK_ALERT_SCAN_INTERVAL_MS) || 60 * 60 * 1000,
  },
  // Admin bulk import/export hub (SPEC-IMPORT-001). One-time migration + bulk ops.
  importExport: {
    // Master switch for the import/export worker (consumer + DB-poll fallback).
    enabled: process.env.IMPORT_EXPORT_ENABLED !== 'false',
    // Disk root for uploaded source files and generated artifacts (error reports,
    // export files). Opaque {uuid} names; the raw path is never exposed.
    storagePath: process.env.IMPORT_STORAGE_PATH || './uploads/import-export',
    // Upload cap and row cap per job (§12 security limits).
    maxFileBytes: Number(process.env.IMPORT_MAX_FILE_BYTES) || 20_971_520, // 20 MB
    maxRows: Number(process.env.IMPORT_MAX_ROWS) || 50_000,
    // Artifacts auto-delete after this window (§13).
    artifactRetentionDays: Number(process.env.IMPORT_ARTIFACT_RETENTION_DAYS) || 7,
    // BLPOP block (seconds) for the event-driven worker so it observes shutdown.
    workerBlockSeconds: Number(process.env.IMPORT_WORKER_BLOCK_SECONDS) || 5,
    // Low-frequency DB safety sweep (ms): catches jobs enqueued while Redis was
    // down (the rpush wakeup never landed). Replaces the old 3s busy-poll.
    safetySweepMs: Number(process.env.IMPORT_SAFETY_SWEEP_MS) || 30_000,
    // Optional admin email when a long job completes (§10). Default off in dev.
    notifyOnComplete: process.env.IMPORT_EXPORT_NOTIFY_ON_COMPLETE === 'true',
  },
  // Unified notification pipeline (SPEC-WEBHOOK-001 §7): one reliable Redis queue
  // for webhook + email jobs, at-least-once via processing list + reaper + dedup.
  notifications: {
    // Master switch for the consumer + reaper. Must stay independent of webhooks.enabled
    // so disabling webhooks never stops mandatory emails.
    enabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
    dedupKeyPrefix: 'ninjasset:notif:dedup:',
    dedupTtlSec: Number(process.env.NOTIFICATIONS_DEDUP_TTL_SEC) || 24 * 60 * 60,
    reaperIntervalMs: Number(process.env.NOTIFICATIONS_REAPER_INTERVAL_MS) || 15_000,
    visibilityTimeoutMs: Number(process.env.NOTIFICATIONS_VISIBILITY_TIMEOUT_MS) || 60_000,
    maxRetries: Number(process.env.NOTIFICATIONS_MAX_RETRIES) || 5,
    // BRPOPLPUSH block (seconds) so the consumer loop observes shutdown.
    blockSeconds: Number(process.env.NOTIFICATIONS_BLOCK_SECONDS) || 5,
  },
  // Periodic maintenance jobs run via the Redis-backed scheduler (scheduler.ts).
  // Cadences live here; the scheduler persists each job's lastRunAt in Redis so a
  // restart does not reset the clock, and a SETNX lock keeps it single-runner.
  maintenance: {
    // One ticker drives all jobs; keep it short enough for the 15s reaper.
    tickMs: Number(process.env.MAINTENANCE_TICK_MS) || 5_000,
    // Lock TTL (s): backstop release if a runner dies mid-job. > longest job runtime.
    lockTtlSec: Number(process.env.MAINTENANCE_LOCK_TTL_SEC) || 300,
    // Redis key prefix for lastRunAt + lock keys.
    keyPrefix: 'ninjasset:sched:',
    // Per-job cadences (ms).
    tokenCleanupMs: Number(process.env.TOKEN_CLEANUP_INTERVAL_MS) || 6 * 60 * 60 * 1000,
    apiRetentionPurgeMs: Number(process.env.API_RETENTION_PURGE_INTERVAL_MS) || 6 * 60 * 60 * 1000,
    importArtifactPurgeMs: Number(process.env.IMPORT_ARTIFACT_PURGE_INTERVAL_MS) || 6 * 60 * 60 * 1000,
  },
};

export type AppConfig = typeof configDefinition;

export interface NotificationsConfig {
  enabled: boolean;
  dedupKeyPrefix: string;
  dedupTtlSec: number;
  reaperIntervalMs: number;
  visibilityTimeoutMs: number;
  maxRetries: number;
  blockSeconds: number;
}

/** Typed slice for notification pipeline bootstrapping (avoids opaque config inference in consumers). */
export const notificationsConfig: NotificationsConfig = configDefinition.notifications;

const config: AppConfig = configDefinition;

export default config;
