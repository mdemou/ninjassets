"""Knowledge route — trigger a full reindex (SPEC §10.3).

Mirrors the `python -m ai_service.jobs.reindex` CLI for ops that prefer HTTP.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ai_service.config import Settings
from ai_service.domain import indexer
from ai_service.infrastructure.adapters.qdrant_store import QdrantStore
from ai_service.infrastructure.deps import get_store, require_internal_key, settings_dep
from ai_service.infrastructure.schemas import ReindexResponse

router = APIRouter(
    prefix="/knowledge", tags=["knowledge"], dependencies=[Depends(require_internal_key)]
)


@router.post("/reindex", response_model=ReindexResponse, status_code=201)
def reindex(
    store: Annotated[QdrantStore, Depends(get_store)],
    settings: Annotated[Settings, Depends(settings_dep)],
) -> ReindexResponse:
    count = indexer.reindex(store=store, settings=settings)
    return ReindexResponse(chunks=count)
