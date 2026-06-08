"""RAG route — streaming SSE (SPEC §9.5, §10.3).

POST /chat/rag → text/event-stream:
    data: {"delta": "..."}            answer tokens
    data: {"empty": true, "sources": []}   no relevant docs (no LLM call)
    data: {"sources": [...]}          final citations
    data: [DONE]
"""

from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ai_service.domain.rag import RagService
from ai_service.infrastructure.deps import get_rag, require_internal_key
from ai_service.infrastructure.schemas import RAGRequest
from ai_service.logging import logger

router = APIRouter(prefix="/chat", tags=["chat"], dependencies=[Depends(require_internal_key)])


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/rag")
async def rag(body: RAGRequest, service: Annotated[RagService, Depends(get_rag)]) -> StreamingResponse:
    history = [m.model_dump() for m in body.history]

    async def event_stream():
        try:
            async for event in service.stream(
                query=body.query, locale=body.locale, top_k=body.top_k, history=history
            ):
                yield _sse(event)
        except Exception as exc:  # surface as a terminal error event (§9.5)
            logger.exception("rag stream failed")
            yield _sse({"error": str(exc)})
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
