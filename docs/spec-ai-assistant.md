# Feature specification: Admin AI assistant (full RAG)

- **Document ID:** SPEC-AI-ASSISTANT-001
- **Status:** Implemented (v1) — see §6.4, §18
- **Last updated:** 2026-06-08
- **Related requirements (E2E):** REQ-AI-ASSISTANT-001 — `e2e/tests/ai-assistant/req-ai-001.spec.ts` (9 tests; aiagent mocked via `MOCK_AI`)
- **Depends on:** [spec-platform-access-model.md](spec-platform-access-model.md), [spec-internationalization.md](spec-internationalization.md), [spec-api-automation.md](spec-api-automation.md), [spec-health-operations.md](spec-health-operations.md)

> **v1 approach.** Admin-only chatbot using **full RAG**: every answer is grounded in chunks
> retrieved from Qdrant. The LLM never receives the full API or full documentation corpus.
> OpenAPI is indexed as documents like any other source — not fetched live at query time.
>
> **v2 approach (later).** Agent **actions** via backend API with validation and admin
> confirmation — specified in [§21](#21-future-agent-actions-v2--not-v1) but **out of v1 scope**.
>
> **Implementation basis (resolved 2026-06-07).** The AI service is a **lightly-layered**
> FastAPI app — `domain/` + `infrastructure/{routes,adapters}` scaffolding, **but not full
> hexagonal**: no port interfaces, no composition-root container, no LangGraph agent/checkpointer.
> It borrows `_python`'s **library choices** (`langchain-huggingface`, `langchain-qdrant`) rather
> than hand-rolled clients. Retrieval is **deterministic forced-RAG** (not an agentic
> retriever-tool). The service is **stateless** — the backend owns conversation memory and passes
> recent turns per call. Corpus setup is **auto-bootstrapped on startup**. Answers **stream** (SSE)
> and all **PII is anonymized before any external LLM call** (deanonymized on the way back). Tracing
> (Langfuse/LangSmith) is **optional**, off by default.
> See [§6.4](#64-ai-service-architecture-resolved) and [§18](#18-open-decisions).

---

## 1. Summary

Add an **admin-only AI assistant** embedded in the admin UI. Admins ask natural-language
questions about ninjasset: product features, workflows, configuration, and the HTTP API.

| Layer | Role |
|-------|------|
| **Frontend** | Chat panel in admin shell; bilingual UI (EN/ES) |
| **Backend** | Auth (`JWTAdmin`), proxy, conversations, rate limits, feature flag |
| **aiagent** | Embeddings, Qdrant search, LLM, PII anonymization, streaming, source citations (stateless) |
| **Qdrant** | Vector store for indexed documentation corpus |

Regular users (`USER` role) **cannot** access the assistant — no UI, no API.

The assistant is **bilingual** like the rest of the app: chat chrome uses `translations.ts`;
**answers** are generated in the admin’s **current UI language** (`en` | `es`), even though
the indexed corpus is primarily **English**.

| Phase | Scope |
|-------|-------|
| **v1** | RAG Q&A, **streaming answers**, conversation history, source citations, **PII anonymization**, EN/ES answers |
| **v2** | Proposed API actions with server-side validation and admin confirmation |

## 2. Goals

| ID | Goal |
|----|------|
| G1 | Help **admins** find answers in specs, public docs, and indexed OpenAPI. |
| G2 | Keep aiagent internal; frontend talks only to backend. |
| G3 | Reuse aiagent RAG stack (Qdrant + embeddings + LLM + `sources`). |
| G4 | Show citations so admins can verify against `/docs` and specs. |
| G5 | Persist multi-turn conversations per admin user. |
| G6 | Re-index corpus on deploy so answers track releases. |
| G7 | Support **EN and ES** for UI and answers (SPEC-I18N-001). |
| G8 | **Stream** answers token-by-token; persist each completed turn. |
| G9 | **Anonymize PII** (emails, serial numbers, names) before any external LLM call. |
| G10 (v2) | Execute admin operations via API only after validation (§21). |

## 3. Non-goals

### v1

| Item | Notes |
|------|-------|
| Regular user / assignee access | **Excluded** — admin only |
| Public or unauthenticated chat | No chat on `/`, `/login`, `/docs` |
| API keys authenticating the assistant | Session `JWTAdmin` only |
| Full-context LLM (entire API attached to prompt) | **RAG only** |
| Hybrid retrieval (live OpenAPI injection) | **Excluded** |
| Agent tool calling / API execution | Deferred to v2 (§21) |
| User PDF upload in production UI | Out |
| Separate Spanish document corpus | Out — multilingual retrieval + LLM translation |
| Per-user locale in database | Out — client `localStorage` only (SPEC-I18N-001) |
| Backend `Accept-Language` negotiation | Out |

### v2

| Item | Notes |
|------|-------|
| Unsupervised destructive mutations | Always require confirmation for writes |
| Bypassing domain layer | Actions go through existing domains |
| aiagent calling backend directly | Backend mediates all execution |

## 4. Glossary

| Term | Definition |
|------|------------|
| Admin assistant | Chat UI + API available only to `roleName === 'ADMIN'` |
| Corpus | All text indexed into Qdrant for this deployment |
| Chunk | Text segment (~1000 chars, 200 overlap) with metadata in Qdrant |
| RAG | Embed query → retrieve top-k chunks → LLM answer constrained to context |
| Reindex | Replace corpus vectors by re-ingesting all source documents |
| Source | Retrieved chunk returned to client (`documentName`, `excerpt`, `score`) |
| Locale | `en` or `es` — UI language and answer language for v1 |
| Action proposal (v2) | Structured intent from aiagent (e.g. `CREATE_ASSET`), not executed until validated |
| Validation gate (v2) | Backend checks auth, capabilities, payload, and confirmation before domain execution |

## 5. Personas and user stories

### 5.1 Admin (only persona in v1)

| ID | Story | Priority |
|----|-------|----------|
| US-A1 | As an admin, I open a chat panel in the admin shell and ask how a feature works. | Must |
| US-A2 | As an admin, I see source citations on each answer. | Must |
| US-A3 | As an admin, I can continue a previous conversation. | Should |
| US-A4 | As an admin, I get a clear message when no docs match my question. | Must |
| US-A5 | As an admin, answers and chat UI follow my EN/ES language setting. | Must |
| US-A6 | As an admin, I can ask in English or Spanish and still get an answer in my UI language. | Should |
| US-A7 | As an admin, the assistant is unavailable when `AI_ASSISTANT_ENABLED=false`. | Must |

### 5.2 Regular user — explicitly out of scope

| ID | Story | v1 |
|----|-------|-----|
| US-U1 | As a user, I use the AI assistant. | **Will not** — no UI; API returns 403 |

## 6. Architecture

### 6.1 v1 request flow

```
┌──────────────┐  JWTAdmin   ┌──────────────┐  internal   ┌──────────────┐
│ Admin UI     │ ──────────► │ Backend      │ ──────────► │ aiagent      │
│ ChatPanel    │  + locale   │ /api/p/ai/*  │  X-Int-Key  │ POST /chat/  │
└──────────────┘ ◄────────── └──────────────┘ ◄────────── │     rag      │
                                                            └──────┬───────┘
                                                                   │
                                                            embed + search
                                                                   ▼
                                                            ┌──────────────┐
                                                            │   Qdrant     │
                                                            └──────────────┘
```

**Per message:**

1. Admin submits message in `ChatPanel` (UI strings from `t(key)`).
2. Frontend `POST /api/p/ai/chat` with `{ message, conversationId?, locale }`.
3. Backend validates `JWTAdmin`, rate limit, feature flag; forwards to aiagent.
4. aiagent embeds message, searches Qdrant (`top_k`), anonymizes chunks, calls LLM with locale-driven prompt.
5. aiagent **anonymizes** the query + context (Presidio + serial recognizer) before the LLM, and **deanonymizes** the streamed answer on the way out (§7.6).
6. The answer **streams** (SSE) aiagent → backend → UI; the backend persists the completed turn once the stream ends (§9.5).
7. Frontend renders the streaming answer incrementally, then the source list.

### 6.2 Auth boundary

| Check | Where |
|-------|-------|
| `auth: 'JWTAdmin'` | Backend routes |
| `roleName === 'ADMIN'` | Frontend admin route guard |
| `X-Internal-Key` | Backend → aiagent only |

`USER` JWT on `/api/p/ai/*` → **403**. Unauthenticated → **401**.

### 6.3 Components

| Layer | Responsibility |
|-------|----------------|
| Frontend | Chat UI, i18n, sources, conversation list, error states |
| Backend | Auth, proxy, Postgres conversations, rate limit, feature flag |
| aiagent | Embeddings, Qdrant, LLM, Presidio, RAG prompts |
| Qdrant | Vector store (`docker-compose.yml` → `qdrant`) |
| Indexer | Offline job: corpus → chunk → embed → upsert Qdrant |

### 6.4 AI service architecture (resolved)

A **lightly-layered** FastAPI service: a `domain/` layer for business logic and an
`infrastructure/` layer for routes + adapters — **but not full hexagonal**. Adapters are
**concrete** (no port interfaces), wired directly via FastAPI `Depends`; **no** composition-root
container, **no** LangGraph agent, **no** checkpointer, **no** tracing port. We borrow `_python`'s
infra/domain *folder* scaffolding and its **library choices** (`langchain-qdrant`,
`langchain-huggingface`) while dropping the abstraction ceremony that makes full hexagonal painful.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layering | `domain/` + `infrastructure/{routes,adapters}`; **no ports, no DI container** | Clean folders without hexagonal pain |
| Codebase | **Fresh service**; discard `_python` (too abstract) and `aiagent` (hand-rolled); port only the chunker idea | Smallest clean surface |
| Retrieval | **Deterministic forced-RAG**: embed → `similarity_search` → answer-from-context | Guarantees grounding, structured `sources`, empty-retrieval short-circuit (§9.3) |
| Not agentic in v1 | No `create_react_agent` retriever-tool for Q&A | ReAct can skip retrieval and hides citations; revisit for v2 actions (§21) |
| Library over hand-rolled | `langchain-qdrant` `QdrantVectorStore`, `langchain-huggingface` embeddings | Avoids custom Qdrant point/ID/batch code |
| State | **Stateless** service | Backend owns `ai_conversation`/`ai_message`; passes last 6 messages per call (§9.2, D2) |
| Streaming | **SSE** end-to-end (aiagent → backend → UI); persist the turn on completion | Chat must render as the answer is produced (§9.5) |
| Auto-bootstrap on start | On startup create the collection if missing; if empty, run the indexer | "Do whatever has to be done if it isn't done" — no manual setup |
| PII (Presidio) | **v1: anonymize before the external LLM, deanonymize the answer** | Hide emails, serial numbers, names from the provider; custom serial recognizer (§7.6) |
| Tracing | Langfuse/LangSmith **optional**, env-gated, **no-op by default** | Not mandatory; remove the hardcoded Langfuse handler from legacy `aiagent` |

**Target layout** (`aiagent/`):

```
aiagent/
  src/ai_service/
    main.py                    # FastAPI app + startup auto-bootstrap
    config.py                  # pydantic-settings
    domain/
      rag.py                   # embed(query:) -> search -> anonymize -> stream LLM -> deanonymize
      indexer.py               # sources -> chunk -> embed(passage:) -> wipe + upsert
      sources.py               # md specs + docs-pages + OpenAPI -> documents
    infrastructure/
      routes/{rag,knowledge,health}.py   # rag streams SSE
      adapters/
        qdrant_store.py        # langchain-qdrant
        embedder.py            # langchain-huggingface + e5 prefixes
        llm.py                 # Grok / LLM client (streaming)
        anonymizer.py          # Presidio + custom serial-number recognizer
      schemas.py               # request/response DTOs
    jobs/reindex.py            # CLI: python -m ai_service.jobs.reindex
  tests/                       # pytest: RAG + indexer with fake embedder/LLM
  Dockerfile
  pyproject.toml
```

> **What "hand-rolled" meant.** `aiagent/` (current) implements its own Qdrant client wrapper,
> manual `PointStruct` building with random UUID ids, manual batching, and a bespoke chunk/embed
> pipeline — more code to own, and the cause of a real bug (random ids ⇒ duplicate chunks on
> reindex). Delegating that to libraries means far less to maintain. "Full hexagonal" (`_python/`)
> swings too far the other way: port interfaces + a DI container for a 6-file service. The layout
> above is the middle path.

## 7. Internationalization (EN / ES)

Follow **SPEC-I18N-001**.

### 7.1 UI language (chat chrome)

| Rule | Detail |
|------|--------|
| Source | `useLanguage()` → `language: 'en' \| 'es'` |
| Persistence | `localStorage.language` |
| Strings | `translations.ts` — type-safe `TranslationKey` |

**Required keys (minimum):**

`ai.title`, `ai.placeholder`, `ai.send`, `ai.stop`, `ai.sources`, `ai.viewSource`,
`ai.noRelevantDocs`, `ai.errorUnavailable`, `ai.rateLimited`, `ai.newConversation`,
`ai.conversations`, `ai.deleteConversation`, `ai.loading`, `ai.examplePrompt1`,
`ai.examplePrompt2`, `ai.examplePrompt3`

### 7.2 Answer language (LLM output)

| Rule | Detail |
|------|--------|
| Driver | **`locale` from frontend** (UI language), not auto-detect from question |
| Corpus | English specs + docs + OpenAPI (v1) |
| Cross-lingual | Admin may ask in EN or ES; retrieval uses query embedding; **answer in UI locale** |

**Examples:**

- UI = `es`, question = "How do API keys work?" → EN chunks retrieved → answer in Spanish.
- UI = `en`, question = "¿Cómo funcionan los handovers?" → EN chunks → answer in English.

### 7.3 aiagent locale-driven system prompt

Replace hardcoded Spanish RAG prompt. Template per `locale`:

**`en`:**

> You are a helpful admin assistant for ninjasset. Answer in **English**, clearly and concisely.
> Answer **only** from DOCUMENT CONTEXT below. If context is insufficient, say so explicitly.
> Do not invent endpoints, fields, or behavior. Prefer citing spec IDs (SPEC-*) when present.

**`es`:**

> Eres un asistente útil para administradores de ninjasset. Responde en **español**, de forma
> clara y concisa. Responde **solo** a partir del CONTEXTO DE DOCUMENTOS. Si no hay contexto
> suficiente, indícalo. No inventes endpoints, campos ni comportamientos. Cita IDs de spec
> (SPEC-*) cuando aparezcan en el contexto.

`DOCUMENT CONTEXT` / `CONTEXTO DE DOCUMENTOS` = retrieved English chunks.

### 7.4 Retrieval across languages

| Piece | v1 |
|-------|-----|
| Embedder | `intfloat/multilingual-e5-base` — 768-dim, cosine |
| **e5 prefixes (required)** | Prepend `query: ` to queries and `passage: ` to chunks before embedding — mandatory for e5; omitting them degrades recall |
| Spanish questions | Expected to retrieve relevant EN chunks |
| Tuning | If recall is poor, raise `top_k` to 8 before adding ES corpus |

### 7.5 Source citations in UI

| Field | Language |
|-------|----------|
| `documentName` | As indexed (English) |
| `excerpt` | English (raw chunk) |
| Link / label | Translated via `t('ai.viewSource')` |

### 7.6 Presidio (PII anonymization)

| Aspect | v1 behavior |
|--------|-------------|
| When | **Always anonymize before any external LLM call.** Replace PII in the query + retrieved context with placeholders, call the LLM, then **deanonymize** the answer so the admin sees real values but the provider never does. |
| Entities | Emails, person names, phone numbers, locations (Presidio built-ins) **+ custom recognizers for asset serial numbers** and other domain identifiers. |
| Languages | spaCy NER per locale (`en_core_web_sm` + `es_core_news_md`); downloaded at container start (§14.4). |
| Streaming | Deanonymize the **token stream**, buffering across chunk boundaries so a placeholder split between two SSE chunks is still restored (§9.5, §22). |
| P2 | Tune recognizers; add more domain identifiers; optional reversible-mapping store if needed. |

### 7.7 Fixed messages (not LLM-generated)

Return from backend or frontend `t(key)`:

- `ai.noRelevantDocs` — empty Qdrant results
- `ai.errorUnavailable` — aiagent down / feature disabled
- `ai.rateLimited` — 429

## 8. Knowledge corpus (full RAG)

All sources ingested into **one Qdrant collection** (default: `documents`).

### 8.1 Source documents (v1)

| Source ID | Origin | `doc_type` |
|-----------|--------|------------|
| `spec-*` | `docs/spec-*.md` | `spec` |
| `user-docs` | `frontend/app/data/docs-pages.ts` (extract `content` at index time) | `user-doc` |
| `openapi` | `docs/openapi.json` — generated **offline** by `npm run export:openapi` (in-memory hapi-swagger dump; no running server/DB) | `openapi` |

**Not live-fetched, ever.** OpenAPI is a static `docs/openapi.json` regenerated only when the
API changes (`backend/scripts/export-openapi.ts`, run via `npm run export:openapi`). The backend
needs to be **up neither at query time nor at index time** — only the file is read.

### 8.2 Chunking

| Setting | Value |
|---------|-------|
| `chunk_size` | 1000 characters |
| `chunk_overlap` | 200 characters |
| Splitter | `RecursiveCharacterTextSplitter` (via `langchain-text-splitters`) |

**Embedding prefix:** each chunk is embedded as `passage: <chunk_text>` (e5 requirement, §7.4).

**OpenAPI pre-processing:** convert JSON to markdown-like sections per tag or route group
(e.g. `## GET /api/p/assets`) before chunking so params and bodies stay together.

### 8.3 Chunk metadata (Qdrant payload)

```json
{
  "document_id": "spec-handover-magic-link",
  "document_name": "spec-handover-magic-link.md",
  "doc_type": "spec | user-doc | openapi",
  "spec_id": "SPEC-HANDOVER-001",
  "section": "handovers",
  "chunk_index": 3,
  "chunk_text": "...",
  "source_path": "docs/spec-handover-magic-link.md",
  "indexed_at": "2026-06-07T12:00:00Z"
}
```

### 8.4 Reindex

| Trigger | Action |
|---------|--------|
| Startup | Service auto-creates the collection if missing; if empty, runs the indexer (no manual step) |
| Release / deploy | CI runs the reindex CLI after the backend image build |
| Manual | `python -m ai_service.jobs.reindex` (full wipe & recreate) |
| Strategy (v1) | **Full wipe & recreate**: drop + recreate the collection, then re-ingest all sources. Corpus is small (seconds); guarantees no stale/duplicate chunks. |

## 9. RAG behavior

### 9.1 Parameters

| Param | Default | Range | Controlled by |
|-------|---------|-------|---------------|
| `top_k` | 5 | 1–20 | Backend (not client in v1) |
| `min_score` | TBD in tuning | 0–1 | aiagent / backend |
| `locale` | `en` | `en` \| `es` | Frontend (required) |

### 9.2 Conversation history

| Setting | Value |
|---------|-------|
| Retrieval | **Current message only** (full RAG — not history-augmented search) |
| LLM context | Last 6 messages (3 turns) appended after retrieval |
| Storage | Backend Postgres (`ai_conversation`, `ai_message`) |

### 9.3 Empty retrieval

If Qdrant returns zero chunks (or all below `min_score`):

- **Do not** call LLM.
- Return 200 with `ai.noRelevantDocs` (localized) and `sources: []`.

### 9.4 PII

**v1 (required):** the query and retrieved chunks are anonymized (Presidio + custom serial-number
recognizer) before the external LLM call; the streamed answer is deanonymized on the way back
(§7.6). The external provider never receives real emails, serial numbers, or names.

### 9.5 Streaming

| Setting | Value |
|---------|-------|
| Transport | **SSE** (`text/event-stream`) aiagent → backend → frontend |
| Token events | `data: {"delta": "..."}` — appended in the UI as they arrive |
| Final event | `data: {"sources": [...], "conversationId": "..."}` then `data: [DONE]` |
| Empty retrieval | Single SSE event `{"empty": true, "sources": []}` then `[DONE]`; UI shows `ai.noRelevantDocs` (one content-type per endpoint) (§9.3) |
| Persistence | Backend buffers the full assistant text while streaming; writes `ai_message` on `[DONE]` (or on client disconnect, with what was received) |
| Deanonymization | Applied to the stream before it reaches the client (§7.6) |
| Errors mid-stream | Emit a terminal `data: {"error": "..."}` event; UI shows `ai.errorUnavailable` |

## 10. API specification

### 10.1 Routes — `/api/p/ai/*`

All routes: `auth: 'JWTAdmin'`. Optional `app.capability: 'ai:assistant'` (MVP admins have `["*"]`).

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/p/ai/chat` | Send message; **streaming** (SSE) RAG reply |
| `GET` | `/api/p/ai/conversations` | List current admin's conversations |
| `GET` | `/api/p/ai/conversations/{id}` | Message history (owner only) |
| `DELETE` | `/api/p/ai/conversations/{id}` | Delete own conversation |

#### `POST /api/p/ai/chat`

**Request**

```json
{
  "message": "How do I create an API key?",
  "conversationId": "uuid-optional",
  "locale": "en"
}
```

| Field | Rules |
|-------|-------|
| `message` | 3–2000 characters |
| `conversationId` | Optional; omit to start new |
| `locale` | Required: `en` \| `es` |

**Response** — `text/event-stream` (SSE, §9.5). Token events carry `delta`; a final event carries
`sources` + `conversationId`, then `[DONE]`. Empty retrieval is the SSE event `{"empty": true}` (§9.3).

```
data: {"delta": "To create an API key, "}
data: {"delta": "go to Settings → API keys…"}
data: {"sources": [
  { "documentName": "spec-api-automation.md", "documentId": "spec-api-automation", "excerpt": "…", "score": 0.91 }
], "conversationId": "uuid"}
data: [DONE]
```

**Errors**

| Status | Code | When |
|--------|------|------|
| 400 | `AI4001` | Validation (message length, etc.) |
| 400 | `AI4002` | Invalid `locale` |
| 401 | — | No session |
| 403 | — | Valid user JWT but not admin |
| 429 | `AI4290` | Rate limit |
| 503 | `AI5030` | aiagent unreachable or `AI_ASSISTANT_ENABLED=false` |

### 10.2 Backend → aiagent proxy

| Env var | Purpose |
|---------|---------|
| `AI_AGENT_URL` | e.g. `http://aiagent:8000` |
| `AI_AGENT_API_KEY` | Shared secret → header `X-Internal-Key` |
| `AI_ASSISTANT_ENABLED` | `true` / `false` |

Maps to aiagent `POST /chat/rag`:

```json
{
  "query": "<message>",
  "top_k": 5,
  "locale": "en",
  "history": [{ "role": "user", "content": "…" }]
}
```

The backend **streams** the aiagent SSE response straight through to the client, while teeing it
into a buffer so it can persist the final `ai_message` once `[DONE]` arrives (§9.5).

### 10.3 AI service responsibilities (v1)

Fresh lightly-layered service (§6.4). Endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /chat/rag` | Deterministic RAG: embed (`query:` prefix) → `similarity_search(top_k)` → anonymize → **stream** answer-from-context in `locale` → deanonymize; final event carries `sources[]` |
| `POST /knowledge/reindex` *(or CLI)* | Full wipe & recreate from bundled sources |
| `GET /health` | Liveness + Qdrant readiness for the backend health gate |

| Item | Detail |
|------|--------|
| `RAGRequest.locale` | `Literal["en", "es"]` |
| System prompt | Locale-driven (§7.3) |
| Retrieval | Deterministic; **no** ReAct retriever-tool in v1 |
| Empty retrieval | Short-circuit before LLM (§9.3) |
| Streaming | `/chat/rag` returns an SSE token stream; final event includes `sources` (§9.5) |
| PII | Presidio anonymize query+context pre-LLM; **deanonymize the stream** post-LLM (§7.6) |
| Tracing | Langfuse/LangSmith optional, env-gated, **no-op by default** (not mandatory) |
| Stateless | No conversation storage; backend passes recent turns (`history`) in the request |
| Ingestion | Markdown specs, docs-pages extract, OpenAPI→markdown (not PDF) |
| Internal auth | Validate `X-Internal-Key` on every route |
| Embeddings | `multilingual-e5-base`, `passage:`/`query:` prefixes, 768-dim cosine |
| Indexer CLI | `python -m ai_service.jobs.reindex` |

Legacy reference to port from: `aiagent/app/domain/chat/use_cases.py` (`rag()`) and
`aiagent/app/domain/documents/ingestion/` (chunker).

## 11. Frontend UI

### 11.1 Placement

| Location | Behavior |
|----------|----------|
| Admin shell (`/admin/*`) | **Sidebar nav item** ("AI Assistant", `t('ai.title')`) → chat view/drawer |
| Personal routes (`/dashboard`, `/assets`, etc.) | **Hidden** |
| Public routes (`/`, `/login`, `/docs`) | **Hidden** |

The entry is a regular item in the existing admin sidebar (alongside Assets, Sites, etc.), gated by
the admin route guard and the feature flag — **not** a floating button.

### 11.2 Chat panel

- Message list, input, send (Enter / Shift+Enter).
- **Streaming:** render the assistant reply incrementally as SSE `delta` tokens arrive; typing
  indicator until the first token; disable input while streaming; allow **stop**.
- **Conversation list:** create, switch, delete; titles from the first message; persisted per admin.
- Collapsible **sources** under assistant messages (shown when the final event arrives).
- Empty state with localized example prompts.
- Error states: 503, 429, network, mid-stream `error` event.
- Pass `locale: language` from `useLanguage()` on every request.
- Store `locale` on each message row (backend) for debugging.

### 11.3 Feature flag UX

When `AI_ASSISTANT_ENABLED=false` or the health check fails: hide the sidebar item (or show it
disabled) with `t('ai.errorUnavailable')`.

## 12. Data model (backend)

### 12.1 `ai_conversation`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | Admin owner |
| `title` | varchar(120) | First message truncated |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | Soft delete |

### 12.2 `ai_message`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `conversation_id` | uuid FK | |
| `role` | enum `user`, `assistant` | |
| `content` | text | |
| `locale` | varchar(2) | `en` \| `es` at time of message |
| `sources` | jsonb nullable | Snapshot for assistant messages |
| `created_at` | timestamptz | |

## 13. Security and limits

| Control | v1 value |
|---------|----------|
| Audience | `ADMIN` only |
| Auth | `JWTAdmin` session only |
| Rate limit | 30 messages / admin / hour (Redis) |
| Message length | 2000 chars |
| aiagent network | Internal Docker network; not public |
| System prompt | Never echo API keys or passwords |
| PII to provider | Query + context anonymized before any external LLM call (§7.6) |
| Tracing | Optional; no data leaves the service unless Langfuse/LangSmith is explicitly configured |

## 14. Configuration and operations

### 14.1 Docker Compose

Root `docker-compose.yml` includes:

| Service | Notes |
|---------|-------|
| `qdrant` | Vector store; named volume for persistence |
| `aiagent` | Image `ghcr.io/<owner>/ninjasset-aiagent`; depends on `qdrant`; `HF_HOME` bind-mount or named volume |
| `backend` | `AI_AGENT_URL=http://aiagent:8000`; depends on healthy aiagent |
| `frontend` | Unchanged |
| Indexer | `POST /knowledge/reindex` or `AI_AUTO_INDEX_ON_START=true` (corpus must be reachable in container) |

### 14.2 Environment variables

| Var | Service |
|-----|---------|
| `AI_ASSISTANT_ENABLED` | backend |
| `AI_AGENT_URL` | backend |
| `AI_AGENT_API_KEY` | backend, aiagent |
| `QDRANT_URL`, `QDRANT_COLLECTION` | aiagent |
| `GROK_API_KEY` (or equivalent) | aiagent |
| `EMBEDDING_MODEL_HF` (`intfloat/multilingual-e5-base`) | aiagent |
| `HF_HOME` (HF cache path; mount as a volume) | aiagent |
| `AI_AUTO_INDEX_ON_START` (`true`/`false`) | aiagent |
| `PRESIDIO_SPACY_MODEL_EN`, `PRESIDIO_SPACY_MODEL_ES` | aiagent |
| `LANGFUSE_*` / `LANGSMITH_*` (optional; **tracing off if unset**) | aiagent |
| `MOCK_AI` (`true` in e2e → backend returns canned SSE, no aiagent) | backend |

### 14.3 Health

Optional: backend pings aiagent `/health` + Qdrant `/readyz`. Degraded → disable chat entry.

### 14.4 Embedding model in Docker

| Concern | Approach |
|---------|----------|
| Image size | ~2 GB: Python deps + **CPU-only** PyTorch (`--extra-index-url https://download.pytorch.org/whl/cpu`). CUDA wheels and `nvidia-*` packages are not installed. |
| HF weights (~1.1 GB) | **Not** in the image. `entrypoint.sh` loads `EMBEDDING_MODEL_HF` into `HF_HOME` on start. |
| Cache reuse | Bind-mount host `~/.cache/huggingface` → `/models/hf` (`HF_CACHE_DIR` in Compose), or use a named volume. |
| Dimension lock | Collection created `size=768, distance=Cosine`; changing the model requires a full reindex (§8.4) |
| spaCy NER models | Downloaded by `entrypoint.sh` on first start (~50 MB); not baked into the image |

## 15. Acceptance criteria — REQ-AI-ASSISTANT-001

| AC | Given / When / Then |
|----|---------------------|
| AC-001.1 | Admin logged in → open chat in `/admin` → ask about API keys → answer references keys + ≥1 source. |
| AC-001.2 | Regular user logged in → no chat UI on personal routes. |
| AC-001.3 | User JWT → `POST /api/p/ai/chat` → 401 (JWTAdmin session required; consistent with all `/api/p/*` admin routes). |
| AC-001.4 | Off-corpus question (e.g. "weather today") → `noRelevantDocs`; empty sources. |
| AC-001.5 | `AI_ASSISTANT_ENABLED=false` → 503; chat hidden or disabled. |
| AC-001.6 | Second message with same `conversationId` → history visible; both stored. |
| AC-001.7 | UI **English** → ask any question → reply in English. |
| AC-001.8 | UI **Spanish** → same question → reply in Spanish. |
| AC-001.9 | UI Spanish + question in English → reply still Spanish. |
| AC-001.10 | Chat labels (title, placeholder, send) match UI language. |
| AC-001.11 | Reload after language change in Settings → chrome + new answers use persisted locale. |
| AC-001.12 | Assistant messages show source document names. |
| AC-001.13 | Assistant reply **streams** — partial text is visible before completion; final text + sources settle. |
| AC-001.14 | Admin opens the assistant from the **admin sidebar item**; it is absent for non-admins. |
| AC-001.15 | Admin sees their **conversation list**, switches between two, and deletes one (gone after reload). |
| AC-001.16 | A chunk containing an email/serial is retrieved → the **external LLM payload contains placeholders**, the admin-visible answer shows real values (PII never sent upstream). |

### 15.1 E2E strategy

**Both — split by boundary.** The Python service owns its own tests; the user-facing chat flow
goes in the shared Playwright suite. Neither replaces the other.

| Layer | Where | Owns | Approach |
|-------|-------|------|----------|
| **aiagent (pytest)** | `aiagent/tests/` | RAG logic, e5 prefixes, **PII anonymize/deanonymize**, **streaming**, indexer, sources, empty-retrieval | **Fake embedder + fake LLM** (the `_python` `tests/fakes/` pattern); one optional integration test against an ephemeral Qdrant. No browser, no network. |
| **Playwright (full stack)** | `e2e/tests/ai-assistant/` | Sidebar entry, admin-only access (403/401), streaming render, conversation list/persistence, rate limit, feature-flag 503, locale | **Mock aiagent at the backend** via `MOCK_AI` (mirrors `MOCK_EMAIL`/`MOCK_CAPTCHA`): backend emits canned SSE — no Qdrant/LLM/model download in CI. |

Why split: aiagent internals (embedding prefixes, Presidio placeholders, SSE buffering) are Python
unit concerns that a browser test can't see; the chat UX, auth, and persistence are full-stack
concerns the browser must drive. The `MOCK_AI` backend flag returns canned SSE per scenario —
including empty-retrieval (`AC-001.4`), a Spanish-locale answer (`AC-001.8/.9`), and a PII payload
(`AC-001.16`). Each AC in §15 maps to at least one spec; reuse existing admin-login fixtures.

> **Gotcha (from CI conventions):** assert on stable `data-testid`s, not translated text — chat
> chrome switches EN/ES. See the PublicAlert text-selector note in `docs/e2e-testing.md`.

## 16. Implementation phases

| Phase | Scope |
|-------|-------|
| **P1** | Corpus indexer (md + docs-pages + OpenAPI export → Qdrant); reindex CLI; CI hook |
| **P2** | Fresh lightly-layered AI service: deterministic RAG, `locale`, locale prompts, e5 prefixes, **SSE streaming**, **PII anonymize/deanonymize (Presidio + serial recognizer)**, internal auth, auto-bootstrap |
| **P3** | Backend: `/api/p/ai/*` (SSE passthrough + persist on `[DONE]`), proxy, migrations, rate limit, feature flag, `MOCK_AI` |
| **P4** | Frontend: admin **sidebar item** + ChatPanel with **streaming render** + conversation list, `translations.ts` EN/ES, sources UI |
| **P5** | E2E REQ-AI-ASSISTANT-001 (Playwright + aiagent pytest, §15.1); all docs in §19 (specs, READMEs, `docs-pages.ts`, Swagger) |
| **P6 (optional)** | Audit log of questions; PII recognizer tuning; optional tracing dashboards |
| **P7 (v2)** | Agent actions (§21) |

## 17. Backend layering

Follow `backend/docs/backend-layering.md`:

| Piece | Location |
|-------|----------|
| Domain | `backend/src/domain/aiAssistant/aiAssistant.domain.ts` |
| Repository | `aiConversationDb.*`, `aiMessageDb.*` |
| HTTP client | `backend/src/services/aiAgent/aiAgent.service.ts` |
| Routes | `backend/src/infrastructure/routes/admin/ai/` |
| Migration | `create_ai_conversation_and_message` |
| Swagger | `*.doc.ts` per `backend/docs/api-documentation.md` |

Domain: validate message/locale, rate limit, call aiagent, **stream the SSE response through to the
client while buffering it**, persist the user + assistant messages (assistant on `[DONE]`), map the
final event → sources DTO.

## 18. Open decisions

| # | Question | Decision |
|---|----------|----------|
| D1 | Audience | **Admin only** |
| D2 | Conversation DB owner | **Backend** (not aiagent) |
| D3 | Answer language | **UI `locale`** (not question auto-detect) |
| D4 | Spanish corpus duplicate | **No** in v1 |
| D5 | `top_k` default | **5**; tune to 8 if ES recall weak |
| D6 | History in embedding | **No** — query-only retrieval |
| D7 | E2E LLM | **Stub aiagent** in Playwright |
| D8 | Capability tag | `ai:assistant` optional; MVP `*` covers admins |
| D9 | AI service base | **Fresh lightly-layered** service (domain + infra/adapters, **no ports/DI**); library adapters |
| D10 | v1 retrieval | **Forced-RAG**, not an agentic retriever-tool |
| D11 | aiagent state | **Stateless**; no LangGraph checkpointer in v1 |
| D12 | Reindex | **Full wipe & recreate** CLI + auto-bootstrap on startup |
| D13 | Embeddings | `multilingual-e5-base`, `query:`/`passage:` prefixes, runtime download to `HF_HOME` volume |
| D14 | Presidio (PII) | **v1 required**: anonymize emails/serials/names pre-LLM, deanonymize after; custom serial recognizer |
| D15 | Streaming | **SSE in v1**; persist the turn on `[DONE]`; empty-retrieval is non-stream |
| D16 | Tracing | Langfuse/LangSmith **optional**, off by default (no-op unless env set) |
| D17 | UI placement | **Admin sidebar item** (not a floating button) |
| D18 | Tests | aiagent owns pytest; chat UX in shared Playwright via backend `MOCK_AI` |
| D19 | OpenAPI source | Static `docs/openapi.json`, generated **offline** (`npm run export:openapi`); auto-regenerated + committed by CI on route changes. Backend never needs to be up; no `OPENAPI_URL` |

## 19. Documentation updates (post-implementation)

### 19.1 Internal specs / dev docs

- `docs/spec-index.md` — register SPEC-AI-ASSISTANT-001
- `docs/e2e-testing.md` — document the `ai-assistant/` folder + aiagent-mock pattern
- `CONTRIBUTING.md` — "reindex the corpus after editing specs/docs" note (OpenAPI auto-regenerates via `.github/workflows/openapi.yml`)

### 19.2 README files

- `README.md` (root) — AI assistant overview, `AI_*` env vars, `docker-compose.yml` (qdrant + aiagent), reindex command
- `aiagent/README.md` — layout (§6.4), `uv` run, Docker image + `HF_HOME` volume (§14.4), e5 prefixes, reindex CLI, tests
- `backend/README.md` — `/api/p/ai/*` routes, proxy env vars, rate limit, feature flag
- `e2e/README.md` — how the aiagent mock works for `ai-assistant/` specs

### 19.3 Public product docs (`frontend/app/data/docs-pages.ts`)

The public `/docs` site is **data-driven** (route `docs.$section.$page.tsx` renders entries from
`docs-pages.ts`; `docs.tsx` is only the layout — no new route file needed).

- Add `{ id: 'ai-assistant', label: 'AI Assistant' }` to the **Features** section in `docsSections`.
- Add a matching `DocPage` (`section: 'features'`, `page: 'ai-assistant'`) describing the admin-only
  assistant, what it can answer, citations, and EN/ES support. Bilingual content per SPEC-I18N-001.

### 19.4 Swagger

- `/api/p/ai/*` routes documented via `*.doc.ts` (per `backend/docs/api-documentation.md`).

## 20. Reference touchpoints

| Area | Location |
|------|----------|
| RAG route | `aiagent/src/ai_service/infrastructure/routes/rag.py` |
| RAG domain | `aiagent/src/ai_service/domain/rag.py` |
| Vector store adapter | `aiagent/src/ai_service/infrastructure/adapters/qdrant_store.py` (`langchain-qdrant`) |
| Embedder adapter | `aiagent/src/ai_service/infrastructure/adapters/embedder.py` (e5 prefixes) |
| Indexer + sources | `aiagent/src/ai_service/domain/{indexer,sources}.py`, `jobs/reindex.py` |
| Qdrant + aiagent compose | `docker-compose.yml` |
| Specs | `docs/spec-*.md` |
| Public docs | `frontend/app/data/docs-pages.ts` |
| OpenAPI export | `backend/scripts/export-openapi.ts` (`npm run export:openapi`) → `docs/openapi.json` |
| OpenAPI auto-regen (CI) | `.github/workflows/openapi.yml` (regenerates + commits on route changes) |
| Admin auth | `spec-platform-access-model.md` — `JWTAdmin`, `/api/p/*` |
| i18n | `spec-internationalization.md` — `LanguageProvider`, `translations.ts` |

## 21. Future: agent actions via API (v2 — not v1)

> **Intent.** The assistant can **perform** admin operations (create assets, list sites, start
> handovers) through the same domains as REST — only after **validation** and **admin
> confirmation**. aiagent proposes; backend executes.

### 21.1 Principles

| # | Principle |
|---|-----------|
| P1 | aiagent **never** holds admin JWT or calls `/api/p/*` directly. |
| P2 | Backend is the **sole executor**. |
| P3 | Mutations use **existing domain modules** (`assets.domain`, etc.). |
| P4 | **Human confirmation** for every write (and sensitive reads if needed). |
| P5 | Reuse **capability catalog** per proposed action. |
| P6 | Executed actions are **audited** (transaction / API access log). |
| P7 | Confirmation UI strings in **UI locale** (§7). |

### 21.2 Flow

```
Admin: "Create a laptop in Madrid office"
        │
        ▼
aiagent (RAG + planner) ──► ActionProposal JSON
        │
        ▼
Backend validation gate (schema, capabilities, domain preflight)
        │
        ▼
Admin UI confirmation card (localized summary)
        │
        ▼
POST /api/p/ai/actions/{id}/confirm ──► domain.execute(admin as Requester)
```

### 21.3 Action proposal (draft schema)

```json
{
  "type": "CREATE_ASSET",
  "confidence": 0.85,
  "parameters": {
    "name": "Laptop",
    "siteName": "Madrid",
    "state": "STOCK"
  },
  "rationale": "User asked to create a laptop in Madrid office",
  "sources": ["spec-asset-management.md"]
}
```

Backend resolves `siteName` → `site_id`, validates schema, returns preview DTO for UI.

### 21.4 Validation gate checks

| Check | Example |
|-------|---------|
| Action allowlist | Only registered types |
| Capability | `assets:write` for create |
| Schema validation | Per action type |
| Domain preflight | Ambiguous site name → 409 with choices |
| Rate limit | Max N confirmed actions / hour |
| Idempotency | Reuse API automation idempotency pattern for writes |

### 21.5 Rollout stages

| Stage | Actions |
|-------|---------|
| v2a | Read-only: `LIST_ASSETS`, `GET_ASSET`, `LIST_SITES` |
| v2b | Low-risk writes: `CREATE_ASSET` with confirm |
| v2c | Higher risk: handovers, users, API keys, delete |

### 21.6 v2 non-goals

- Multi-step chains without per-step confirm
- Bulk operations without dedicated design
- API key auth for agent execution

## 22. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| ES question, poor EN chunk retrieval | multilingual-e5; tune `top_k`; ES question eval set |
| LLM hallucination despite RAG | Strict prompt; sources UI; empty-retrieval short-circuit |
| Stale corpus | Mandatory reindex on release |
| Conflicting spec vs docs-pages | Prefer `spec` in prompt; long-term single doc source |
| aiagent Spanish-only prompt today | Locale-driven prompts (§7.3) |
| **PII sent to external LLM** | Presidio anonymize query+context pre-LLM; **custom serial-number recognizer**; deanonymize after (§7.6) |
| **Placeholder split across SSE chunks** | Buffer partial placeholders in the deanonymizer until the token is complete before flushing (§9.5) |
| **Presidio over/under-redaction** | EN+ES spaCy models; eval set of emails/serials; recognizers tunable in P6 |
| **Stream interrupted / client disconnect** | Persist partial assistant text; terminal `error` event → `ai.errorUnavailable` |
| **Mandatory tracing vendor lock-in** | Langfuse/LangSmith optional, no-op by default (D16) |
| Cost / abuse | Rate limits; feature flag |
| Regular user access | Admin-only routes + UI guard |

---

*End of specification.*
