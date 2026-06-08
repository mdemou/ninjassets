"""Health route — liveness + Qdrant readiness for the backend health gate (§14.3)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ai_service.infrastructure.adapters.qdrant_store import QdrantStore
from ai_service.infrastructure.deps import get_store
from ai_service.infrastructure.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(store: Annotated[QdrantStore, Depends(get_store)]) -> HealthResponse:
    qdrant_ok = store.readyz()
    return HealthResponse(status="ok" if qdrant_ok else "degraded", qdrant=qdrant_ok)
