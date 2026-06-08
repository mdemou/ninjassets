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
Dockerfile                 CPU-only PyTorch; models loaded at runtime (not baked in)
entrypoint.sh              Pre-download embedding + spaCy models before uvicorn
```

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/chat/rag` | **SSE** stream: `delta` tokens → final `sources` → `[DONE]` (or `empty`) |
| `POST` | `/knowledge/reindex` | Full wipe & recreate from sources |
| `GET`  | `/health` | Liveness + Qdrant readiness |

All non-health routes require the `X-Internal-Key` header when `AI_AGENT_API_KEY` is set.

## Run locally

**Prerequisites:** [uv](https://docs.astral.sh/uv/) (manages the virtualenv — no manual `venv`
needed) and Python **3.12–3.13** (3.14 is not supported by spaCy yet). VS Code launch/tasks live
in the repo root `.vscode/`.

```bash
uv sync                       # creates aiagent/.venv
cp .env.example .env          # set GROK_API_KEY (+ QDRANT_URL if not localhost)
uv run uvicorn ai_service.main:app --reload   # http://localhost:8000/docs
```

First run downloads the models (see below). Qdrant must be reachable:

```bash
docker compose up -d qdrant   # from repo root
```

## Models (downloaded at runtime, not baked into the image)

| Model | Purpose | Size | Where |
|-------|---------|------|-------|
| `intfloat/multilingual-e5-base` | embeddings (768-dim) | ~1.1 GB | `$HF_HOME` (default `~/.cache/huggingface`) |
| `en_core_web_sm` / `es_core_news_md` | Presidio NER | ~12 MB / ~40 MB | site-packages (downloaded on first start in Docker) |

The HF model auto-downloads on first use. spaCy models for local dev:

```bash
uv run python -m spacy download en_core_web_sm
uv run python -m spacy download es_core_news_md
```

**e5 requires prefixes** — the embedder adds `query: ` / `passage: ` automatically
(`adapters/embedder.py`).

### Docker image

The published image (`ghcr.io/<owner>/ninjasset-aiagent`) is ~**2 GB** — Python deps and
**CPU-only** PyTorch only. The ~1.1 GB embedding weights are **not** in the image; mount a host
or named volume at `HF_HOME` (`/models/hf` in the container).

```bash
docker build -t ninjasset-aiagent aiagent/
```

`entrypoint.sh` loads the embedding model from `HF_HOME` and downloads spaCy models before
uvicorn starts. First boot with an empty volume downloads ~1.1 GB (allow several minutes).

In the root `docker-compose.yml`, the HF cache is bind-mounted from the host by default:

```yaml
volumes:
  - ${HF_CACHE_DIR:-${HOME}/.cache/huggingface}:/models/hf
```

Override with `HF_CACHE_DIR` in a `.env` next to `docker-compose.yml` if your cache lives
elsewhere.

## Reindex

Full wipe & recreate (§8.4). Run after editing specs/docs/the API:

```bash
uv run python -m ai_service.jobs.reindex
```

Sources are resolved relative to `CORPUS_ROOT` (default `..`, the repo root):
`docs/spec-*.md`, `frontend/app/data/docs-pages.ts`, and `docs/openapi.json`. On startup,
if `AI_AUTO_INDEX_ON_START=true` and the collection is empty, it self-populates.

**OpenAPI is a static file**, generated offline from the backend (no running server, no
DB connection — it builds the hapi app in memory and dumps hapi-swagger's `/docs.json`):

```bash
cd ../backend && npm run export:openapi   # writes docs/openapi.json
```

You don't normally run this by hand: **CI regenerates and commits `docs/openapi.json`
automatically** when backend routes change (`.github/workflows/openapi.yml`). The command above
is just for refreshing it locally. The backend never has to be **up** for the assistant to work —
not at query time and not at index time.

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
