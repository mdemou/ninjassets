# ninjasset aiagent

RAG service for the **admin AI assistant** — see [`docs/spec-ai-assistant.md`](../docs/spec-ai-assistant.md)
(SPEC-AI-ASSISTANT-001). Stateless: the backend owns conversations and proxies to this service.

## Architecture

Lightly-layered (not full hexagonal — §6.4): `domain/` for logic, `infrastructure/{routes,adapters}`
for I/O, concrete adapters wired in `composition.py`. No ports, no DI container, no LangGraph.

```
src/ai_service/
  main.py                  FastAPI app + startup auto-bootstrap
  composition.py           build adapters + RagService from settings
  config.py                pydantic-settings
  domain/
    rag.py                 embed(query:) → search → anonymize → stream LLM → deanonymize
    indexer.py             sources → chunk → embed(passage:) → wipe + upsert
    sources.py             specs + docs-pages + OpenAPI → documents
    chunking.py            RecursiveCharacterTextSplitter (1000/200)
  infrastructure/
    routes/{rag,knowledge,health}.py
    adapters/{embedder,qdrant_store,llm,anonymizer}.py
    schemas.py  deps.py
  jobs/reindex.py          CLI: python -m ai_service.jobs.reindex
tests/                     pytest with fake store + fake LLM
```

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/chat/rag` | **SSE** stream: `delta` tokens → final `sources` → `[DONE]` (or `empty`) |
| `POST` | `/knowledge/reindex` | Full wipe & recreate from sources |
| `GET`  | `/health` | Liveness + Qdrant readiness |

All non-health routes require the `X-Internal-Key` header when `AI_AGENT_API_KEY` is set.

## Run locally

```bash
uv sync
cp .env.example .env          # set GROK_API_KEY (+ QDRANT_URL if not localhost)
uv run uvicorn ai_service.main:app --reload   # http://localhost:8000/docs
```

First run downloads the models (see below). Qdrant must be reachable (`docker compose -f
../docker-compose-ai.yml up qdrant`).

## Models (downloaded locally, no data leaves for embeddings/PII)

| Model | Purpose | Size | Where |
|-------|---------|------|-------|
| `intfloat/multilingual-e5-base` | embeddings (768-dim) | ~1.1 GB | `$HF_HOME` (default `~/.cache/huggingface`) |
| `en_core_web_sm` / `es_core_news_md` | Presidio NER | ~12 MB / ~40 MB | site-packages |

The HF model auto-downloads on first use. spaCy models:

```bash
uv run python -m spacy download en_core_web_sm
uv run python -m spacy download es_core_news_md
```

**e5 requires prefixes** — the embedder adds `query: ` / `passage: ` automatically
(`adapters/embedder.py`). The Dockerfile bakes all models so containers start offline (§14.4).

## Reindex

Full wipe & recreate (§8.4). Run after editing specs/docs/the API:

```bash
uv run python -m ai_service.jobs.reindex
```

Sources are resolved relative to `CORPUS_ROOT` (default `..`, the repo root):
`docs/spec-*.md`, `frontend/app/data/docs-pages.ts`, and an exported `openapi.json`
(or fetched from `OPENAPI_URL`). On startup, if `AI_AUTO_INDEX_ON_START=true` and the
collection is empty, it self-populates.

## PII

Queries + retrieved context are anonymized (Presidio + custom `ASSET_SERIAL` recognizer) **before**
the external LLM, and the streamed answer is deanonymized on the way back — so emails, serial
numbers, and names never reach the provider (§7.6). Disable in dev with `PII_ENABLED=false`.

## Tracing

Optional and **off by default** (§D16). Set `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` to enable.

## Tests

```bash
uv run pytest                 # unit + SSE e2e with fakes (no Qdrant/LLM/model)
uv run pytest -m integration  # opt-in: real ephemeral Qdrant
```
