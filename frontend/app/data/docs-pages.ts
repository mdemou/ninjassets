export interface DocPage {
  section: string;
  page: string;
  title: string;
  content: string;
}

export interface DocSection {
  id: string;
  label: string;
  pages: { id: string; label: string }[];
}

/** Public GitHub repository (header/footer links on landing and docs). */
export const GITHUB_REPO_URL = 'https://github.com/mdemou/ninjassets';

export const docsSections: DocSection[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    pages: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'installation', label: 'Installation' },
      { id: 'self-hosting', label: 'Self-Hosting' },
    ],
  },
  {
    id: 'features',
    label: 'Features',
    pages: [
      { id: 'assets', label: 'Asset Management' },
      { id: 'handover', label: 'Handover & Custody' },
      { id: 'import-export', label: 'Import & Export' },
      { id: 'webhooks', label: 'Webhooks & Integrations' },
    ],
  },
  {
    id: 'api-reference',
    label: 'API Reference',
    pages: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'authentication', label: 'Authentication' },
      { id: 'endpoints', label: 'Endpoints' },
    ],
  },
];

const pages: DocPage[] = [
  // ─── Getting Started ───────────────────────────────────────────────────────

  {
    section: 'getting-started',
    page: 'introduction',
    title: 'Introduction',
    content: `
# Introduction

> The self-hosted IT Asset Management platform for teams who need control.

**NinjAsset** is an open-source ITAM tool you deploy on your own infrastructure. It gives your team a single place to track every hardware and software asset across its full lifecycle — from receiving it in stock, assigning it to a person, sending it for maintenance, and eventually retiring it.

## Why NinjAsset?

Most ITAM tools are SaaS products that store your inventory data on someone else's servers. NinjAsset flips this: you run it on your own server, your own rules, your own data.

| | NinjAsset | Typical SaaS |
|---|---|---|
| Data location | Your server | Vendor cloud |
| Pricing | Free (self-hosted) | Per-seat / per-month |
| Customisation | Full | Limited |
| Internet dependency | None after deploy | Required |

## Key features

- **Asset inventory** — Lifecycle states (Stock → Assigned → Maintenance → Archived), admin CRUD, and a read-only personal view for assignees.
- **Sites & maps** — Offices and data centers with interactive Leaflet maps. Assets inherit coordinates from their site.
- **Verified custody** — Email magic-link handovers that require the recipient to confirm online, plus printable checkout receipts with signature upload.
- **ITAM catalog** — Manufacturers, vendors, and asset categories with per-category custom fields (JSONB).
- **Media & QR** — Asset photos, auto-generated QR codes, and printable label sheets.
- **Data quality & alerts** — Computed hygiene rules that surface gaps (missing serial, no assignee, overdue warranty) with an admin notification bell.
- **Audit history** — Every mutation is logged. Admins see the full ledger; users see their own history.
- **API automation** — Bearer API keys for headless integrations and CI scripts.
- **Webhooks / Integrations** — Slack, Discord, and Telegram destinations that fire on domain events.
- **Bulk import/export** — Migrate from spreadsheets or other ITAM tools with a dry-run gate.

## Architecture overview

\`\`\`
Browser (React SPA :3000)
    │  /api proxy
    ▼
Hapi API (:3001)
    ├── PostgreSQL 16
    └── Redis 7  (webhooks · email · import/export jobs)
\`\`\`

The frontend and backend are separate Node.js packages. Both can run with \`npm run dev\` locally or as Docker images in production.

## Web UI entry points

| URL | Purpose |
|---|---|
| \`/\` | Public marketing landing (features, docs links, **Get started** / **Log in** CTAs) |
| \`/docs\` | This documentation (header includes **Sign in** → \`/login\`) |
| \`/login\` | Email/password sign-in; register link when signup is enabled |
| \`/register\` | Self-service registration (when \`SIGNUP_ENABLED\` is not \`false\`) |

## Next steps

- [Installation](/docs/getting-started/installation) — Get NinjAsset running in minutes.
- [Self-Hosting](/docs/getting-started/self-hosting) — Production deployment with Docker Compose.
- [API Reference](/docs/api-reference/introduction) — Automate NinjAsset from scripts or CI.
`,
  },

  {
    section: 'getting-started',
    page: 'installation',
    title: 'Installation',
    content: `
# Installation

NinjAsset requires **Node.js 20+**, **PostgreSQL 16**, and **Redis 7**. The fastest way to run PostgreSQL and Redis locally is with the included Docker Compose file.

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 or later |
| npm | 9 or later |
| Docker (optional) | 24 or later |
| PostgreSQL | 16 |
| Redis | 7 |

## Quick start

### 1. Clone the repository

\`\`\`bash
git clone https://github.com/mdemou/ninjassets.git
cd ninjasset
\`\`\`

### 2. Set up environment variables

\`\`\`bash
cp backend/.env.example backend/.env
# optional — defaults work for local dev
cp frontend/.env.example frontend/.env
\`\`\`

Open \`backend/.env\` and set at minimum:

\`\`\`dotenv
DATABASE_URL=postgres://ninjasset:ninjasset@localhost:5432/ninjasset
REDIS_HOST=localhost
JWT_ADMIN_SECRET_KEY=change-me-admin-secret
JWT_USER_SECRET_KEY=change-me-user-secret
FRONTEND_URL=http://localhost:3000
\`\`\`

### 3. Start infrastructure

\`\`\`bash
docker compose --env-file backend/.env up -d
\`\`\`

This starts **PostgreSQL** and **Redis** only. The app runs outside Docker during development.

### 4. Start the API

\`\`\`bash
cd backend
npm install
npm run migrate      # run all Knex migrations
npm run dev          # starts on :3001
\`\`\`

Optional — seed demo data:

\`\`\`bash
npm run seed         # minimal seed
npm run seed:demo    # rich demo data with assets, users, and handovers
\`\`\`

### 5. Start the frontend

Open a second terminal:

\`\`\`bash
cd frontend
npm install
npm run dev          # starts on :3000
\`\`\`

Open [http://localhost:3000](http://localhost:3000) and use **Log in** or **Get started** on the landing page, or go directly to [http://localhost:3000/login](http://localhost:3000/login). Sign in with the seeded admin credentials printed by \`npm run seed\`.

## Environment variables reference

Copy \`backend/.env.example\` to \`backend/.env\`. Values below are **application defaults** from \`backend/src/config/config.ts\` when a variable is unset. \`DATABASE_URL\` is used by Knex migrations and Docker Compose but is not read by the runtime config object (the app uses \`DB_*\` fields). E2E tests use a separate \`e2e/.env\` (PostgreSQL + Redis only); the frontend dev server optionally uses \`frontend/.env\` (\`PORT\`, \`API_URL\`).

### Database

| Variable | Purpose | Default |
|---|---|---|
| \`DATABASE_URL\` | PostgreSQL URL for Knex migrations / Compose (not used by runtime \`config.db\`) | — (see \`backend/.env.example\`) |
| \`DB_USER\` | PostgreSQL user | \`postgres\` |
| \`DB_PASSWORD\` | PostgreSQL password | \`postgres\` |
| \`DB_HOST\` | PostgreSQL host | \`localhost\` |
| \`DB_PORT\` | PostgreSQL port | \`5432\` |
| \`DB_NAME\` | PostgreSQL database name | \`ninjasset\` |

### Redis

| Variable | Purpose | Default |
|---|---|---|
| \`REDIS_HOST\` | Redis hostname | \`localhost\` |
| \`REDIS_PORT\` | Redis port | \`6379\` |
| \`REDIS_PASSWORD\` | Redis password (empty = no auth) | \`""\` |
| \`REDIS_DB\` | Redis logical database index | \`0\` |

**Hardcoded in \`config.ts\` (not environment variables):**

| Config path | Purpose | Value |
|---|---|---|
| \`config.db.redis.queues.notifications\` | Unified notification job queue (webhooks + email) | \`ninjasset:notifications\` |
| \`config.db.redis.queues.notificationsProcessing\` | In-flight list for BRPOPLPUSH at-least-once delivery | \`ninjasset:notifications:processing\` |
| \`config.db.redis.queues.importExportJobs\` | Import/export job wakeup queue | \`ninjasset:import-export\` |
| \`config.notifications.dedupKeyPrefix\` | Redis key prefix for delivery deduplication | \`ninjasset:notif:dedup:\` |
| \`config.maintenance.keyPrefix\` | Redis prefix for scheduler last-run timestamps and locks | \`ninjasset:sched:\` |

### Server

| Variable | Purpose | Default |
|---|---|---|
| \`PORT\` | API listen port | \`3001\` |
| \`HOST\` | API bind address | \`0.0.0.0\` |
| \`LOG_LEVEL\` | Application log level | \`info\` |
| \`ADMIN_PAGE_SIZE\` | Server-side page size for paginated list endpoints | \`20\` |

### Authentication & sessions

| Variable | Purpose | Default |
|---|---|---|
| \`JWT_ADMIN_SECRET_KEY\` | Signs admin JWT session tokens | \`admin-secret-dev\` |
| \`JWT_USER_SECRET_KEY\` | Signs user JWT session tokens | \`user-secret-dev\` |
| \`SIGNUP_ENABLED\` | Self-service registration (\`false\` disables API + register UI) | \`true\` |
| \`RECAPTCHA_SECRET_KEY\` | Google reCAPTCHA secret for registration | \`""\` |
| \`MOCK_CAPTCHA\` | Skip captcha validation (dev/test only) | \`false\` |
| \`EMAIL_VERIFICATION_EXPIRY_HOURS\` | Email verification token TTL | \`24\` |
| \`PASSWORD_RESET_EXPIRY_HOURS\` | Password reset token TTL | \`1\` |
| \`HANDOVER_TOKEN_EXPIRY_HOURS\` | Custody handover magic-link TTL | \`72\` |
| \`ACCOUNT_LOCKOUT_MAX_ATTEMPTS\` | Failed logins before lockout | \`5\` |
| \`ACCOUNT_LOCKOUT_DURATION_MS\` | Lockout duration in milliseconds | \`900000\` (15 min) |

### URLs

| Variable | Purpose | Default |
|---|---|---|
| \`FRONTEND_URL\` | Base URL for links in emails (verification, reset, handover) | \`http://localhost:3000\` |
| \`BACKEND_URL\` | Public API base URL (e.g. QR asset links) | \`http://localhost:3001\` |

### Email (SMTP)

| Variable | Purpose | Default |
|---|---|---|
| \`SMTP_HOST\` | SMTP server host (empty = log to console when not mocking) | \`""\` |
| \`SMTP_PORT\` | SMTP port | \`587\` |
| \`SMTP_SECURE\` | Use TLS (\`true\` / \`false\`) | \`false\` |
| \`SMTP_USER\` | SMTP username | \`""\` |
| \`SMTP_PASS\` | SMTP password | \`""\` |
| \`SMTP_FROM\` | Default From address | \`noreply@example.com\` |
| \`MOCK_EMAIL\` | Log outbound mail to console instead of SMTP | \`false\` |

### File uploads & storage paths

| Variable | Purpose | Default |
|---|---|---|
| \`AVATAR_STORAGE_PATH\` | User avatar files on disk | \`./uploads/avatars\` |
| \`ASSET_IMAGE_STORAGE_PATH\` | Asset image files on disk | \`./uploads/asset-images\` |
| \`MANUFACTURER_IMAGE_STORAGE_PATH\` | Manufacturer logo files | \`./uploads/manufacturer-images\` |
| \`VENDOR_IMAGE_STORAGE_PATH\` | Vendor logo files | \`./uploads/vendor-images\` |
| \`ASSET_QR_PNG_SIZE\` | PNG edge length for on-demand asset QR codes | \`512\` |

### Custody receipts

| Variable | Purpose | Default |
|---|---|---|
| \`CUSTODY_DOCUMENT_STORAGE_PATH\` | Signed custody PDF storage (raw bytes, no image pipeline) | \`./uploads/custody-documents\` |
| \`CUSTODY_DOCUMENT_MAX_BYTES\` | Max upload size for a signed custody PDF | \`10485760\` (10 MB) |
| \`CUSTODY_ORG_NAME\` | Organization name on generated receipt header | \`ninjasset\` |
| \`CUSTODY_ORG_LOGO_PATH\` | Optional logo image path on receipts (empty = omit) | \`""\` |

### API keys & machine access

| Variable | Purpose | Default |
|---|---|---|
| \`API_KEY_PREFIX\` | Visible prefix on new API key secrets | \`nsk_live_\` |
| \`API_KEY_DEFAULT_TTL_DAYS\` | Default expiry when creating keys (\`0\` = no expiry) | \`0\` |
| \`API_KEY_LAST_USED_THROTTLE_SEC\` | Throttle writes to \`last_used_at\` on hot keys | \`60\` |
| \`API_ACCESS_LOG_RETENTION_DAYS\` | Days to retain API access log entries | \`90\` |
| \`API_IDEMPOTENCY_TTL_HOURS\` | TTL for idempotency keys on mutating requests | \`24\` |

### Webhooks (Slack / Discord / Telegram)

| Variable | Purpose | Default |
|---|---|---|
| \`WEBHOOKS_ENABLED\` | Master switch for webhook dispatcher and alert scan | \`true\` |
| \`WEBHOOK_HTTP_TIMEOUT_MS\` | Outbound HTTP timeout per delivery | \`5000\` |
| \`WEBHOOK_ALLOWED_SLACK_HOSTS\` | Comma-separated SSRF allowlist for Slack | \`hooks.slack.com\` |
| \`WEBHOOK_ALLOWED_DISCORD_HOSTS\` | Comma-separated SSRF allowlist for Discord | \`discord.com,discordapp.com,ptb.discord.com,canary.discord.com\` |
| \`WEBHOOK_TELEGRAM_API_BASE\` | Telegram Bot API base URL | \`https://api.telegram.org\` |
| \`WEBHOOK_ALLOW_INSECURE_TARGETS\` | Allow \`http\` and loopback targets (dev/test only) | \`false\` |
| \`WEBHOOK_ALERT_SCAN_INTERVAL_MS\` | Interval for data-quality \`alert.raised\` scan | \`3600000\` (1 h) |

### Notifications pipeline

| Variable | Purpose | Default |
|---|---|---|
| \`NOTIFICATIONS_ENABLED\` | Consumer + reaper (independent of \`WEBHOOKS_ENABLED\`) | \`true\` |
| \`NOTIFICATIONS_DEDUP_TTL_SEC\` | Dedup key TTL in seconds | \`86400\` |
| \`NOTIFICATIONS_REAPER_INTERVAL_MS\` | How often stale in-flight jobs are reclaimed | \`15000\` |
| \`NOTIFICATIONS_VISIBILITY_TIMEOUT_MS\` | Processing visibility timeout | \`60000\` |
| \`NOTIFICATIONS_MAX_RETRIES\` | Max delivery attempts per job | \`5\` |
| \`NOTIFICATIONS_BLOCK_SECONDS\` | BRPOPLPUSH block time (shutdown responsiveness) | \`5\` |

### Bulk import / export

| Variable | Purpose | Default |
|---|---|---|
| \`IMPORT_EXPORT_ENABLED\` | In-process import/export worker | \`true\` |
| \`IMPORT_STORAGE_PATH\` | Uploads and generated artifacts on disk | \`./uploads/import-export\` |
| \`IMPORT_MAX_FILE_BYTES\` | Max upload size per import file | \`20971520\` (20 MB) |
| \`IMPORT_MAX_ROWS\` | Max rows processed per import job | \`50000\` |
| \`IMPORT_ARTIFACT_RETENTION_DAYS\` | Auto-delete artifacts after N days | \`7\` |
| \`IMPORT_WORKER_BLOCK_SECONDS\` | BLPOP block for event-driven worker | \`5\` |
| \`IMPORT_SAFETY_SWEEP_MS\` | DB sweep when Redis wakeup was missed | \`30000\` |
| \`IMPORT_EXPORT_NOTIFY_ON_COMPLETE\` | Email admin when a long job completes | \`false\` |

### Admin AI assistant

| Variable | Purpose | Default |
|---|---|---|
| \`AI_ASSISTANT_ENABLED\` | Feature flag — assistant is off unless \`true\` | \`false\` |
| \`MOCK_AI\` | Canned SSE from backend (no aiagent); E2E/dev only | \`false\` |
| \`AI_AGENT_URL\` | Base URL of the aiagent RAG service | \`http://localhost:8000\` |
| \`AI_AGENT_API_KEY\` | Shared secret sent as \`X-Internal-Key\` header | \`""\` |
| \`AI_TOP_K\` | Retrieval top-K for RAG context | \`5\` |
| \`AI_MESSAGE_MAX_LENGTH\` | Max user message length (characters) | \`2000\` |
| \`AI_MESSAGE_MIN_LENGTH\` | Min user message length (characters) | \`3\` |
| \`AI_HISTORY_MESSAGES\` | Last N messages sent to the LLM as context | \`6\` |
| \`AI_RATE_LIMIT_PER_HOUR\` | Messages per admin per hour (Redis fixed window) | \`30\` |
| \`AI_AGENT_TIMEOUT_MS\` | Upstream SSE request timeout | \`60000\` |

### Periodic maintenance (scheduler)

| Variable | Purpose | Default |
|---|---|---|
| \`MAINTENANCE_TICK_MS\` | Scheduler tick interval | \`5000\` |
| \`MAINTENANCE_LOCK_TTL_SEC\` | Redis lock TTL if a runner dies mid-job | \`300\` |
| \`TOKEN_CLEANUP_INTERVAL_MS\` | Expired session/token cleanup cadence | \`21600000\` (6 h) |
| \`API_RETENTION_PURGE_INTERVAL_MS\` | API access log purge cadence | \`21600000\` (6 h) |
| \`IMPORT_ARTIFACT_PURGE_INTERVAL_MS\` | Import artifact purge cadence | \`21600000\` (6 h) |

> **Production:** Change JWT secrets, database passwords, and \`API_KEY_PREFIX\` (\`nsk_live_\` vs \`nsk_test_\`). Never set \`MOCK_CAPTCHA\`, \`MOCK_EMAIL\`, \`MOCK_AI\`, or \`WEBHOOK_ALLOW_INSECURE_TARGETS\` in production.
`,
  },

  {
    section: 'getting-started',
    page: 'self-hosting',
    title: 'Self-Hosting',
    content: `
# Self-Hosting

This guide covers running NinjAsset in a production-like environment using Docker Compose.

## Production Docker Compose

A minimal \`docker-compose.yml\` for a single-server deployment:

\`\`\`yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: ninjasset
      POSTGRES_USER: ninjasset
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  backend:
    image: ninjasset-backend:latest
    env_file: backend/.env
    depends_on: [db, redis]
    ports:
      - "3001:3001"
    restart: unless-stopped

  frontend:
    image: ninjasset-frontend:latest
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  pgdata:
\`\`\`

## Building production images

\`\`\`bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm start
\`\`\`

Set \`NODE_ENV=production\` before building.

## Running database migrations

Run migrations once on first deploy, and again after each upgrade:

\`\`\`bash
cd backend && npm run migrate
\`\`\`

## Reverse proxy (nginx example)

Place NinjAsset behind nginx and terminate TLS there:

\`\`\`nginx
server {
    listen 443 ssl;
    server_name ninjasset.example.com;

    ssl_certificate     /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;

    # Frontend SPA
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }

    # API (proxied by the SPA dev server in dev; direct in prod)
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
\`\`\`

## Security checklist

- Set strong random values for \`JWT_ADMIN_SECRET_KEY\` and \`JWT_USER_SECRET_KEY\` (32+ chars).
- Never commit \`backend/.env\`, \`e2e/.env\`, or \`frontend/.env\` to version control.
- Use a dedicated PostgreSQL user with access only to the \`ninjasset\` database.
- Enable TLS on your reverse proxy.
- Consider setting \`SIGNUP_ENABLED=false\` after initial user creation.
- Rotate API keys periodically via **Admin → API Keys → Regenerate**.

## Health checks

The backend exposes two endpoints for liveness/readiness probes:

| Path | Purpose |
|---|---|
| \`GET /health/live\` | Process is alive (always 200 if running) |
| \`GET /health/ready\` | Database and Redis reachable |

Use these in Docker health checks or Kubernetes probes.

## Upgrading

1. Pull the new image or \`git pull\`.
2. Run \`npm run migrate\` (backend) — migrations are always additive and safe to replay.
3. Restart the services.
`,
  },

  // ─── Features ──────────────────────────────────────────────────────────────

  {
    section: 'features',
    page: 'assets',
    title: 'Asset Management',
    content: `
# Asset Management

Assets are the core of NinjAsset. Every piece of hardware or software you track is an asset record with a full lifecycle, catalog links, custom fields, and audit history.

## Asset lifecycle states

\`\`\`
STOCK ──► ASSIGNED ──► MAINTENANCE ──► ARCHIVED
  ▲            │              │
  └────────────┘◄─────────────┘
\`\`\`

| State | Meaning |
|---|---|
| \`STOCK\` | Available in inventory, not assigned |
| \`ASSIGNED\` | Checked out to a person |
| \`MAINTENANCE\` | Sent for repair or service |
| \`ARCHIVED\` | End-of-life, no longer active |

## Creating an asset

Navigate to **Admin → Assets → New asset**. Required fields:

- **Name** — Human-readable label (e.g. *MacBook Pro 16"*)
- **Serial number** — Must be unique across the inventory
- **State** — Starting lifecycle state (usually \`STOCK\`)

Optional fields include purchase date, warranty date, return date, notes, site, and any custom fields defined by the asset's category.

## Categories and custom fields

Every asset can belong to a **category** (e.g. *Laptops*, *Monitors*, *Network gear*). Categories define additional fields that appear on the asset form — for example a laptop category might add *RAM*, *Storage*, and *Operating System* fields.

Admins manage categories at **Admin → Categories**.

## Searching and filtering

The asset list supports real-time full-text search across name, serial, and notes. Use the filter panel to narrow by:

- Lifecycle state
- Site / location
- Category
- Assignee
- Warranty status (expiring, expired)

## Assigning assets

To check out an asset to a person, open the asset detail and use the **Handover** tab. NinjAsset sends the recipient an email with a magic link to confirm custody. See [Handover & Custody](/docs/features/handover) for details.

## Bulk operations

From the asset list, select multiple assets and use the bulk toolbar to:

- **Bulk checkout** — Assign multiple assets to the same person with a single handover flow.
- **Bulk check-in** — Return multiple assets at once.

## QR codes and labels

Every asset gets an auto-generated QR code. Print label sheets from **Admin → Assets → Print QR labels**. Scan a label to jump directly to the asset detail page.

## Media

Attach up to one photo per asset (JPEG or PNG). Photos are displayed in the asset list and detail view, and in the handover confirmation email.
`,
  },

  {
    section: 'features',
    page: 'handover',
    title: 'Handover & Custody',
    content: `
# Handover & Custody

NinjAsset uses a **verified handover** model: when you assign an asset to someone, they must confirm it via an email magic link before custody is recorded. This creates a tamper-proof chain of custody.

## How handovers work

1. **Admin initiates** — Open an asset, go to the Handover tab, select a recipient and optional notes.
2. **Email sent** — The recipient gets an email with a one-click confirmation link (valid for 72 hours by default).
3. **Recipient confirms** — Clicking the link marks the handover as accepted and records the timestamp.
4. **Asset state updates** — The asset moves to \`ASSIGNED\` and the assignee is set.

If the recipient does not confirm within the expiry window, the handover can be resent or cancelled from the admin panel.

## Custody receipts

After a handover is accepted, admins can generate a **printable custody receipt** — a PDF document showing:

- Asset details (name, serial, photo, QR code)
- Handover date and recipient
- Signature area for physical sign-off

Upload the signed PDF back to the asset record as a custody document for your audit trail.

## Bulk handovers

From the asset list, select multiple assets and use **Bulk checkout**. NinjAsset creates one handover flow covering all selected assets. The recipient receives a single email and confirms all assets at once. A single multi-asset custody receipt is generated.

## Returning assets

Use the **Return** action on an assigned asset to move it back to \`STOCK\`. A return handover is created; the previous assignee is notified by email.

## Magic link security

- Links expire after **72 hours** (configurable via \`HANDOVER_TOKEN_EXPIRY_HOURS\`).
- Each link is single-use — confirming or cancelling invalidates it.
- Links are signed with the backend JWT secret and cannot be forged.

## Audit trail

Every handover — initiation, confirmation, return, cancellation — is recorded in the audit log with timestamp, actor, and asset details. View the full history at **Admin → Overview → Audit log** or on the asset detail page.
`,
  },

  {
    section: 'features',
    page: 'import-export',
    title: 'Import & Export',
    content: `
# Import & Export

NinjAsset provides a bulk import/export hub at **Admin → Import & Export**. Use it to migrate from spreadsheets, export your inventory for reporting, or drive bulk updates.

## Supported formats

| Format | Import | Export |
|---|---|---|
| CSV | ✓ | ✓ |
| XLSX (Excel) | ✓ | ✓ |
| JSON | ✓ | ✓ |

## Supported entities

| Entity | Import | Export |
|---|---|---|
| Assets | ✓ | ✓ |
| Sites | ✓ | ✓ |
| Users | ✓ | ✓ |
| Manufacturers | ✓ | ✓ |
| Vendors | ✓ | ✓ |

## Import workflow

Imports always follow this five-step wizard:

1. **Upload** — Select your file (CSV, XLSX, or JSON).
2. **Map columns** — Match your source columns to NinjAsset fields. Save the mapping as a preset for reuse.
3. **Preview** — Review the first rows before processing.
4. **Dry run** — NinjAsset validates every row against domain rules (unique serials, valid states, referenced categories, etc.) without writing anything to the database. Fix errors before proceeding.
5. **Commit** — Apply the validated rows. The import runs asynchronously; you get a progress indicator and a final summary.

> **Tip:** The dry run is mandatory. NinjAsset blocks the commit button until the dry run succeeds with zero errors.

## Column mapping

Map your spreadsheet columns to NinjAsset fields using the visual mapper. For asset imports, the available target fields include:

| Field | Notes |
|---|---|
| \`name\` | Required |
| \`serial_number\` | Must be unique |
| \`state\` | \`STOCK\`, \`ASSIGNED\`, \`MAINTENANCE\`, or \`ARCHIVED\` |
| \`site_name\` | Resolved to site by name |
| \`category_name\` | Resolved to category by name |
| \`custom_fields\` | JSON string of category custom field values |
| \`purchase_date\` | ISO 8601 date |
| \`warranty_date\` | ISO 8601 date |
| \`notes\` | Free text |

## Export

Exports generate a file immediately (for small datasets) or as an async job. Use the same filters as the asset list to export a subset of your inventory.

## Via API

Both import and export are also available via the REST API. See [API Reference → Endpoints](/docs/api-reference/endpoints) for the \`/api/p/import-jobs\` and \`/api/p/export-jobs\` routes.

When a job completes, NinjAsset publishes a webhook event (\`import_job.completed\` / \`export_job.completed\`) if webhook destinations are configured.
`,
  },

  {
    section: 'features',
    page: 'webhooks',
    title: 'Webhooks & Integrations',
    content: `
# Webhooks & Integrations

NinjAsset can send real-time notifications to **Slack**, **Discord**, and **Telegram** when domain events happen — asset assigned, handover confirmed, import job completed, and more.

## Setting up a destination

Go to **Admin → Integrations** and click **Add destination**. Choose your platform and provide the webhook URL:

| Platform | URL format |
|---|---|
| Slack | Incoming Webhook URL from Slack App configuration |
| Discord | \`https://discord.com/api/webhooks/{id}/{token}\` |
| Telegram | \`https://api.telegram.org/bot{token}/sendMessage\` (plus a chat ID) |

## Subscribing to events

Each destination can subscribe to any combination of events. Toggle the events you care about in the destination settings.

## Available events

### Asset events
| Event | Fired when |
|---|---|
| \`asset.created\` | A new asset is created |
| \`asset.updated\` | An asset field is changed |
| \`asset.deleted\` | An asset is deleted |
| \`asset.state_changed\` | Lifecycle state changes (e.g. STOCK → ASSIGNED) |

### Handover events
| Event | Fired when |
|---|---|
| \`handover.initiated\` | An admin starts a handover |
| \`handover.accepted\` | The recipient confirms |
| \`handover.returned\` | An asset is checked back in |
| \`handover.cancelled\` | A pending handover is cancelled |

### User events
| Event | Fired when |
|---|---|
| \`user.created\` | A new user is registered |
| \`user.updated\` | User profile or role changes |

### Import & Export events
| Event | Fired when |
|---|---|
| \`import_job.completed\` | Bulk import finishes (success or failure) |
| \`export_job.completed\` | Bulk export finishes |

### Alert events
| Event | Fired when |
|---|---|
| \`alert.triggered\` | A data-quality alert fires |

## Payload format

All events share the same envelope:

\`\`\`json
{
  "event": "asset.state_changed",
  "timestamp": "2026-06-01T10:30:00Z",
  "data": {
    "id": "asset-uuid",
    "name": "MacBook Pro 16\\"",
    "previous_state": "STOCK",
    "new_state": "ASSIGNED"
  }
}
\`\`\`

## Delivery

Webhooks are delivered asynchronously via a Redis-backed job queue. Failed deliveries are retried with exponential back-off. You can inspect delivery history per destination in the Integrations admin panel.
`,
  },

  // ─── API Reference ─────────────────────────────────────────────────────────

  {
    section: 'api-reference',
    page: 'introduction',
    title: 'Introduction',
    content: `
# API Reference

> The NinjAsset REST API lets you automate inventory operations from scripts, CI pipelines, and external systems.

## Base URL

All API requests use the path prefix \`/api\`:

\`\`\`
https://ninjasset.example.com/api
\`\`\`

In a local development setup the API runs on port 3001:

\`\`\`
http://localhost:3001/api
\`\`\`

## Route namespaces

| Prefix | Access |
|---|---|
| \`/api/p/*\` | Admin endpoints (JWT session or API key) |
| \`/api/me/*\` | Personal workspace endpoints (JWT session only) |
| \`/api/session/*\` | Auth endpoints (no authentication required) |
| \`/api/public/*\` | Public endpoints (no authentication required) |

## Schema

All request and response bodies are **JSON**. Set the \`Content-Type: application/json\` header on requests with a body.

\`\`\`http
Content-Type: application/json
Accept: application/json
\`\`\`

Timestamps are returned in **ISO 8601** format (\`2026-06-01T10:30:00.000Z\`).

## Pagination

List endpoints support \`page\` and \`limit\` query parameters:

\`\`\`
GET /api/p/assets?page=1&limit=25
\`\`\`

Paginated responses include a \`meta\` object:

\`\`\`json
{
  "data": [...],
  "meta": {
    "total": 142,
    "page": 1,
    "limit": 25,
    "totalPages": 6
  }
}
\`\`\`

## Error responses

\`\`\`json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Serial number already exists"
}
\`\`\`

| Status | Meaning |
|---|---|
| \`400\` | Bad request — malformed body or missing required field |
| \`401\` | Unauthenticated — no or invalid credentials |
| \`403\` | Forbidden — authenticated but not authorised |
| \`404\` | Not found |
| \`409\` | Conflict — e.g. duplicate serial number |
| \`422\` | Unprocessable — validation error |
| \`500\` | Server error |

## Interactive explorer

The backend ships with **Swagger UI** at:

\`\`\`
http://localhost:3001/docs
\`\`\`

Use it to browse all endpoints, inspect schemas, and try requests directly from your browser.
`,
  },

  {
    section: 'api-reference',
    page: 'authentication',
    title: 'Authentication',
    content: `
# Authentication

NinjAsset supports two authentication methods depending on the use case.

## Session tokens (browser / human)

Browser sessions authenticate with **JWT access tokens** obtained from the login endpoint. These tokens are short-lived and intended for interactive use.

### Public config (signup gate)

The SPA loads runtime auth flags when the user opens \`/\`, \`/login\`, or \`/register\` (to show or hide signup CTAs):

\`\`\`http
GET /api/session/public-config
\`\`\`

\`\`\`json
{
  "signupEnabled": true
}
\`\`\`

When \`signupEnabled\` is \`false\` (set \`SIGNUP_ENABLED=false\` on the server), the register page redirects to login, the login page hides the sign-up link, and the landing page hides **Get started** / sign-up links.

### Login

\`\`\`http
POST /api/session/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your-password"
}
\`\`\`

Response:

\`\`\`json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "id": "...", "role": "ADMIN" }
}
\`\`\`

Pass the token in the \`Authorization\` header:

\`\`\`http
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
\`\`\`

> Session tokens are for interactive browser use. Use **API keys** for scripted or automated access.

## API keys (machine / automation)

API keys are long-lived secrets intended for scripts, CI pipelines, and third-party integrations. They authenticate all admin endpoints under \`/api/p/*\`.

### Creating an API key

1. Log in as an admin.
2. Go to **Admin → API Keys → New key**.
3. Give the key a name and an optional expiry date.
4. Copy the secret — it is shown **only once**.

Secrets have the format:

\`\`\`
nsk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

### Using an API key

Send the key in the \`Authorization\` header, exactly like a session token:

\`\`\`bash
curl -H "Authorization: Bearer nsk_live_xxxx..." \\
     https://ninjasset.example.com/api/p/assets
\`\`\`

### Key management

| Action | How |
|---|---|
| List keys | Admin → API Keys |
| Revoke a key | API Keys → Revoke — takes effect immediately |
| Regenerate secret | API Keys → Regenerate — keeps same key ID, mints a new secret |
| Set expiry | Provided at creation time |

### Access log

Every request authenticated with an API key is recorded in the **API access log** (visible in the key detail view). The log includes timestamp, method, path, and HTTP status.

## Personal endpoints (\`/api/me/*\`)

The \`/api/me/*\` namespace is for regular users (non-admin). It is accessible with **session tokens only** — API keys do not grant access to personal endpoints.
`,
  },

  {
    section: 'api-reference',
    page: 'endpoints',
    title: 'Endpoints',
    content: `
# Endpoints

All admin endpoints require an \`Authorization: Bearer <token-or-api-key>\` header.

> The full interactive API explorer is available at \`/docs\` on your NinjAsset instance (Swagger UI).

---

## Assets

| Method | Path | Description |
|---|---|---|
| \`GET\` | \`/api/p/assets\` | List assets (paginated, filterable) |
| \`POST\` | \`/api/p/assets\` | Create an asset |
| \`GET\` | \`/api/p/assets/:id\` | Get asset detail |
| \`PUT\` | \`/api/p/assets/:id\` | Update an asset |
| \`DELETE\` | \`/api/p/assets/:id\` | Delete an asset |
| \`GET\` | \`/api/p/assets/:id/history\` | Audit history for one asset |

### Query parameters (GET /api/p/assets)

| Parameter | Type | Description |
|---|---|---|
| \`page\` | number | Page number (default 1) |
| \`limit\` | number | Items per page (default 25, max 100) |
| \`search\` | string | Full-text search across name, serial, notes |
| \`state\` | string | Filter by lifecycle state |
| \`site_id\` | uuid | Filter by site |
| \`category_id\` | uuid | Filter by category |
| \`assigned_to\` | uuid | Filter by assignee user ID |

---

## Sites

| Method | Path | Description |
|---|---|---|
| \`GET\` | \`/api/p/sites\` | List sites |
| \`POST\` | \`/api/p/sites\` | Create a site |
| \`GET\` | \`/api/p/sites/:id\` | Get site detail |
| \`PUT\` | \`/api/p/sites/:id\` | Update a site |
| \`DELETE\` | \`/api/p/sites/:id\` | Delete a site |

---

## Users

| Method | Path | Description |
|---|---|---|
| \`GET\` | \`/api/p/users\` | List users |
| \`POST\` | \`/api/p/users\` | Create a user |
| \`GET\` | \`/api/p/users/:id\` | Get user detail |
| \`PUT\` | \`/api/p/users/:id\` | Update a user |
| \`DELETE\` | \`/api/p/users/:id\` | Delete a user |

---

## Catalog

| Method | Path | Description |
|---|---|---|
| \`GET\` | \`/api/p/manufacturers\` | List manufacturers |
| \`POST\` | \`/api/p/manufacturers\` | Create manufacturer |
| \`PUT\` | \`/api/p/manufacturers/:id\` | Update manufacturer |
| \`DELETE\` | \`/api/p/manufacturers/:id\` | Delete manufacturer |
| \`GET\` | \`/api/p/vendors\` | List vendors |
| \`POST\` | \`/api/p/vendors\` | Create vendor |
| \`GET\` | \`/api/p/categories\` | List categories |
| \`POST\` | \`/api/p/categories\` | Create category |

---

## API Keys

| Method | Path | Description |
|---|---|---|
| \`GET\` | \`/api/p/api-keys\` | List API keys |
| \`POST\` | \`/api/p/api-keys\` | Create an API key |
| \`DELETE\` | \`/api/p/api-keys/:id\` | Revoke a key |
| \`POST\` | \`/api/p/api-keys/:id/regenerate\` | Regenerate the secret |

---

## Import & Export

| Method | Path | Description |
|---|---|---|
| \`GET\` | \`/api/p/import-jobs\` | List import jobs |
| \`POST\` | \`/api/p/import-jobs\` | Submit an import job |
| \`GET\` | \`/api/p/import-jobs/:id\` | Get job status and result |
| \`GET\` | \`/api/p/export-jobs\` | List export jobs |
| \`POST\` | \`/api/p/export-jobs\` | Start an export |
| \`GET\` | \`/api/p/export-jobs/:id/download\` | Download completed export file |

### Submit an import job

\`\`\`bash
curl -X POST https://ninjasset.example.com/api/p/import-jobs \\
  -H "Authorization: Bearer nsk_live_xxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "entity": "assets",
    "format": "csv",
    "dry_run": true,
    "mapping": {
      "Name": "name",
      "Serial": "serial_number",
      "State": "state"
    },
    "file_url": "https://example.com/inventory.csv"
  }'
\`\`\`

---

## Webhooks

| Method | Path | Description |
|---|---|---|
| \`GET\` | \`/api/p/webhooks\` | List webhook destinations |
| \`POST\` | \`/api/p/webhooks\` | Create destination |
| \`PUT\` | \`/api/p/webhooks/:id\` | Update destination |
| \`DELETE\` | \`/api/p/webhooks/:id\` | Delete destination |

---

## Personal workspace

| Method | Path | Description |
|---|---|---|
| \`GET\` | \`/api/me/assets\` | My assigned assets |
| \`GET\` | \`/api/me/history\` | My audit history |
| \`GET\` | \`/api/me/profile\` | My profile |
| \`PUT\` | \`/api/me/profile\` | Update my profile |

---

## Health

| Method | Path | Description |
|---|---|---|
| \`GET\` | \`/health/live\` | Liveness probe |
| \`GET\` | \`/health/ready\` | Readiness probe (checks DB + Redis) |
`,
  },
];

export function getDocPage(section: string, page: string): DocPage | undefined {
  return pages.find((p) => p.section === section && p.page === page);
}
