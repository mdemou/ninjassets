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
      { id: 'ai-assistant', label: 'AI Assistant' },
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

> Self-hosted IT asset management for teams who need control of their data.

**NinjAsset** is an open-source ITAM platform you deploy on your own infrastructure: inventory lifecycle, sites and maps, verified custody, bulk assign and import/export, data-quality alerts, audit history, API keys and webhooks, and an optional admin AI assistant.

## Why NinjAsset?

Most ITAM tools are SaaS products that store your inventory on someone else's servers. NinjAsset runs on your server — your rules, your data.

| | NinjAsset | Typical SaaS |
|---|---|---|
| Data location | Your server | Vendor cloud |
| Pricing | Free (self-hosted) | Per-seat / per-month |
| Customisation | Full | Limited |
| Internet dependency | None after deploy | Required |

## Key features

- **Asset inventory** — Lifecycle states (\`STOCK\`, \`ASSIGNED\`, \`MAINTENANCE\`, \`ARCHIVED\`), admin CRUD, and a personal read-only view for assignees.
- **Sites & maps** — Offices and data centers with Leaflet (OpenStreetMap); assets inherit or override coordinates.
- **Verified custody** — Email magic-link handovers and printable checkout/check-in receipts (generate PDF, collect signatures, upload scanned copy).
- **ITAM catalog** — Manufacturers, vendors, and categories with per-category custom fields.
- **Media & QR** — Asset images, QR codes, and label printing.
- **Data quality & alerts** — Computed hygiene rules, reports, an admin notification bell, and dismissals (discard/undo without editing assets).
- **Bulk assign** — Multi-asset checkout/return from the assets list, with optional verified handover per asset and batch custody PDF.
- **Audit history** — Admin-wide transaction log and per-user “My History”.
- **Dashboards** — Admin overview (KPIs, charts, map) and a personal workspace.
- **API automation** — Bearer API keys for machine access to admin endpoints.
- **Webhooks / Integrations** — Slack, Discord, and Telegram on domain events.
- **Bulk import/export** — Admin hub at \`/admin/import-export\` with column mapping, mandatory dry-run, and async jobs.
- **AI assistant** — Admin-only RAG chat at \`/admin/ai\` with streamed answers and source citations (EN/ES UI).
- **Auth & profile** — Registration, email verification, password reset, lockout, settings; admins can reset passwords from the user directory.

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, React Router 7 (SPA), Tailwind CSS v4, Leaflet, Recharts |
| Backend | Node.js, Hapi, Knex, PostgreSQL |
| AI assistant | Python FastAPI (\`aiagent\`), Qdrant, CPU embeddings (\`multilingual-e5-base\`), configurable LLM |
| Jobs | Redis queues (webhooks, email, import/export) plus a Redis-backed periodic scheduler |

Admin routes use \`/api/p/*\`; personal routes use \`/api/me/*\`.

## Web UI entry points

| URL | Purpose |
|---|---|
| \`/\` | Public marketing landing (no API calls, no login/signup links) |
| \`/docs\` | This documentation (header includes **Sign in** → \`/login\`) |
| \`/login\` | Email/password sign-in; register link when signup is enabled |
| \`/register\` | Self-service registration (when \`SIGNUP_ENABLED\` is not \`false\`) |

## Next steps

- [Installation](/docs/getting-started/installation) — Start the full stack with Docker Compose.
- [Self-Hosting](/docs/getting-started/self-hosting) — Images, volumes, upgrades, and production checklist.
- [AI Assistant](/docs/features/ai-assistant) — Enable RAG chat and populate Qdrant.
- [API Reference](/docs/api-reference/introduction) — Automate NinjAsset from scripts or CI.
`,
  },

  {
    section: 'getting-started',
    page: 'installation',
    title: 'Installation',
    content: `
# Installation

## Prerequisites

- **Docker** and Docker Compose

## Quick start

1. Copy the example env files (backend **and** aiagent) and edit values as needed:

\`\`\`bash
cp backend/.env.example backend/.env
cp aiagent/.env.example aiagent/.env
\`\`\`

At minimum, set strong \`JWT_ADMIN_SECRET_KEY\` and \`JWT_USER_SECRET_KEY\` in \`backend/.env\`. Keep \`REDIS_PASSWORD\` in sync with \`docker-compose.yml\` (default \`your_secure_password\`). For the AI assistant, set \`AI_ASSISTANT_ENABLED=true\`, \`GROK_API_KEY\`, and matching \`AI_AGENT_API_KEY\` in both env files — see [Self-Hosting](/docs/getting-started/self-hosting) for details.

2. Start the stack:

\`\`\`bash
docker compose -f docker-compose.yml up
\`\`\`

- **App:** [http://localhost:3000](http://localhost:3000)
- **API (direct):** [http://localhost:3001](http://localhost:3001)

The backend image runs migrations on startup. Add \`-d\` to run detached.

3. If you enabled the AI assistant, populate Qdrant from this repo checkout (once, or after editing specs/docs/API):

\`\`\`bash
cd aiagent
uv sync
uv run python -m ai_service.jobs.reindex
\`\`\`

\`aiagent/.env\` should use \`QDRANT_URL=http://localhost:6333\` (the default in \`.env.example\`). See [AI Assistant](/docs/features/ai-assistant) for more.
`,
  },

  {
    section: 'getting-started',
    page: 'self-hosting',
    title: 'Self-Hosting',
    content: `
# Self-Hosting

Full stack from published images: PostgreSQL, Redis, Qdrant, **aiagent** (AI RAG service), backend API, and nginx frontend.

## Services

| Service | Image | Notes |
| --- | --- | --- |
| \`postgres\`, \`redis-server\` | Official images | Data store and job queues |
| \`qdrant\` | \`qdrant/qdrant\` | Vector store for the assistant |
| \`aiagent\` | \`ghcr.io/<owner>/ninjasset-aiagent\` | ~2 GB image (deps only); embedding model via volume |
| \`backend\`, \`frontend\` | \`ghcr.io/<owner>/ninjasset-{backend,frontend}\` | API + SPA |

Compose overrides container networking — you do **not** need to set these manually in \`backend/.env\`:

| Variable | Value inside Compose |
| --- | --- |
| \`DB_HOST\` | \`postgres\` |
| \`REDIS_HOST\` | \`redis-server\` |
| \`DATABASE_URL\` | \`postgres://<DB_USER>:<DB_PASSWORD>@postgres:5432/<DB_NAME>\` |
| \`AI_AGENT_URL\` | \`http://aiagent:8000\` |
| \`QDRANT_URL\` (aiagent) | \`http://qdrant:6333\` |

## Embedding model volume

The aiagent image does not include the ~1.1 GB Hugging Face weights (\`intfloat/multilingual-e5-base\`). Compose bind-mounts a host cache into the container (\`HF_HOME=/models/hf\`); default host path is \`~/.cache/huggingface\`. Override with \`HF_CACHE_DIR\` in a root \`.env\` file.

Pre-download on the host (optional — same path the container uses, faster first start):

\`\`\`bash
cd aiagent
uv sync
uv run python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-base')"
\`\`\`

If the cache directory is missing or empty, \`entrypoint.sh\` downloads the model on first container start (several minutes; healthcheck \`start_period\` allows up to 5 minutes). Later starts reuse the mounted cache.

Named volumes persist PostgreSQL data, Qdrant vectors, and backend uploads.

## Upgrading

After a new release (version tag on GitHub), refresh images:

\`\`\`bash
docker compose -f docker-compose.yml pull
docker compose -f docker-compose.yml up -d
\`\`\`

Images (\`ninjasset-backend\`, \`ninjasset-frontend\`, \`ninjasset-aiagent\`) are published to GitHub Container Registry on version tags (\`v*\`). If the packages are private, log in first: \`docker login ghcr.io\`.
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

## Bulk assign

From the asset list, select multiple assets and use the bulk toolbar to:

- **Bulk checkout** — Assign multiple assets to the same person (direct assignment or verified handover per asset).
- **Bulk check-in** — Return multiple assets at once.
- **Batch custody PDF** — Generate a single printable receipt covering the selection.

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

Admins can generate **printable checkout/check-in receipts** — PDF documents showing asset details (name, serial, photo, QR code), dates, and signature areas for physical sign-off.

Collect signatures offline, then upload the scanned PDF back to the asset record as a custody document for your audit trail.

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
| \`alert.raised\` | A new data-quality issue is detected (periodic scan) |

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

  {
    section: 'features',
    page: 'ai-assistant',
    title: 'AI Assistant',
    content: `
# AI Assistant

Admin-only RAG chat at **Admin → AI** (\`/admin/ai\`). The backend owns conversations and proxies to the stateless **aiagent** service (FastAPI + Qdrant + local embeddings + external LLM). Answers stream over SSE with source citations; UI is available in English and Spanish.

## Enable the assistant

1. In \`backend/.env\`: \`AI_ASSISTANT_ENABLED=true\` and \`AI_AGENT_API_KEY\` (shared secret).
2. In \`aiagent/.env\`: \`GROK_API_KEY\` (or your configured LLM provider) and the same \`AI_AGENT_API_KEY\`.
3. Start the full stack with Docker Compose (includes Qdrant and aiagent).

Compose sets \`AI_AGENT_URL=http://aiagent:8000\` and \`QDRANT_URL=http://qdrant:6333\` inside containers — you do not need to change those for the default stack.

## Populate Qdrant (required)

The assistant cannot answer until the corpus is indexed. Run from your **repo checkout** (the published aiagent image does not bundle specs or docs):

\`\`\`bash
cd aiagent
uv sync
uv run python -m ai_service.jobs.reindex
\`\`\`

Use \`QDRANT_URL=http://localhost:6333\` in \`aiagent/.env\` while Qdrant is exposed by Compose.

Re-run after editing feature specs (\`docs/spec-*.md\`), this documentation (\`frontend/app/data/docs-pages.ts\`), or the exported API schema (\`docs/openapi.json\`).

### Alternative triggers

- **HTTP** (when aiagent runs locally with corpus access): \`POST /knowledge/reindex\` with header \`X-Internal-Key: <AI_AGENT_API_KEY>\`.
- **Auto-index** — \`AI_AUTO_INDEX_ON_START=true\` indexes when the collection is empty, but only when corpus files are visible to the process (local \`uvicorn\`, not the default Compose aiagent container).

## Embedding model

Weights for \`intfloat/multilingual-e5-base\` (~1.1 GB) are not baked into the Docker image. Compose bind-mounts \`~/.cache/huggingface\` by default. Pre-download on the host for a faster first start — see [Self-Hosting](/docs/getting-started/self-hosting).

On first container start with an empty cache, \`entrypoint.sh\` downloads the model automatically (allow several minutes). See [Self-Hosting](/docs/getting-started/self-hosting) for the Hugging Face cache volume.

## Privacy

Queries and retrieved context are anonymized (Presidio) **before** the external LLM; streamed answers are deanonymized on the way back. Disable in dev with \`PII_ENABLED=false\` in \`aiagent/.env\`.

## What is indexed

Sources (relative to \`CORPUS_ROOT\`, default repo root):

- \`docs/spec-*.md\` — feature specifications
- \`frontend/app/data/docs-pages.ts\` — this in-app documentation
- \`docs/openapi.json\` — HTTP API schema (generated offline from the backend)
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
