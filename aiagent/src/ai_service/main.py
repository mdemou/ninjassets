"""FastAPI app + startup auto-bootstrap (SPEC §6.4, §8.4).

On startup: build the container, ensure the Qdrant collection exists, and — if it
is empty and AI_AUTO_INDEX_ON_START is set — run the indexer. No manual setup.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_service.composition import Container, build_container
from ai_service.config import get_settings
from ai_service.domain import indexer
from ai_service.infrastructure.routes import health, knowledge, rag
from ai_service.logging import configure_logging, logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)

    # Tests wire app.state + dependency overrides themselves; skip heavy bootstrap.
    if settings.app_env == "test":
        yield
        return

    container: Container = build_container(settings)
    container.store.ensure_collection()

    if settings.ai_auto_index_on_start and container.store.is_empty():
        logger.info("collection empty + auto-index on → reindexing corpus")
        indexer.reindex(store=container.store, settings=settings)

    app.state.settings = settings
    app.state.store = container.store
    app.state.rag = container.rag
    logger.info("aiagent ready (tracing=%s, pii=%s)", settings.tracing_enabled, settings.pii_enabled)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="ninjasset aiagent", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(rag.router)
    app.include_router(knowledge.router)
    return app


app = create_app()
