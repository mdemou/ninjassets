"""FastAPI dependencies — read the singletons assembled in `main.lifespan`.

No DI container: the lifespan wires concrete adapters into `app.state`, and these
helpers hand them to routes. Internal auth validates the `X-Internal-Key` header.
"""

from __future__ import annotations

from fastapi import Header, HTTPException, Request, status

from ai_service.config import Settings, get_settings
from ai_service.domain.rag import RagService
from ai_service.infrastructure.adapters.qdrant_store import QdrantStore


def get_rag(request: Request) -> RagService:
    return request.app.state.rag


def get_store(request: Request) -> QdrantStore:
    return request.app.state.store


def settings_dep() -> Settings:
    return get_settings()


def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if settings.internal_auth_required and x_internal_key != settings.ai_agent_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid internal key"
        )
