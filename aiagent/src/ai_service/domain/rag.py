"""Deterministic forced-RAG, streaming (SPEC §9).

embed(query:) → similarity_search(top_k) → [empty? short-circuit] → anonymize
→ stream LLM answer-from-context → deanonymize stream → final `sources` event.

`stream()` yields plain dict events the route renders as SSE:
  {"empty": True, "sources": []}   — no relevant chunks (no LLM call, §9.3)
  {"delta": "..."}                  — answer tokens
  {"sources": [...]}                — final citations
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from ai_service.config import Settings
from ai_service.infrastructure.adapters.anonymizer import Anonymizer
from ai_service.infrastructure.adapters.llm import GrokLLM
from ai_service.infrastructure.adapters.qdrant_store import QdrantStore
from ai_service.logging import logger

_PROMPTS: dict[str, str] = {
    "en": (
        "You are a helpful admin assistant for ninjasset. Answer in English, clearly and "
        "concisely. Answer ONLY from the DOCUMENT CONTEXT below. If the context is insufficient, "
        "say so explicitly. Do not invent endpoints, fields, or behavior. Prefer citing spec IDs "
        "(SPEC-*) when present.\n\nDOCUMENT CONTEXT:\n{context}"
    ),
    "es": (
        "Eres un asistente útil para administradores de ninjasset. Responde en español, de forma "
        "clara y concisa. Responde SOLO a partir del CONTEXTO DE DOCUMENTOS. Si no hay contexto "
        "suficiente, indícalo. No inventes endpoints, campos ni comportamientos. Cita IDs de spec "
        "(SPEC-*) cuando aparezcan.\n\nCONTEXTO DE DOCUMENTOS:\n{context}"
    ),
}


class RagService:
    def __init__(
        self,
        *,
        store: QdrantStore,
        llm: GrokLLM,
        anonymizer: Anonymizer | None,
        settings: Settings,
    ) -> None:
        self._store = store
        self._llm = llm
        self._anonymizer = anonymizer
        self._settings = settings

    async def stream(
        self,
        *,
        query: str,
        locale: str = "en",
        top_k: int | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> AsyncIterator[dict]:
        k = top_k or self._settings.top_k
        hits = [
            (doc, score)
            for doc, score in self._store.search(query, k=k)
            if score >= self._settings.min_score
        ]

        if not hits:
            logger.info("rag: no relevant chunks for query")
            yield {"empty": True, "sources": []}
            return

        sources = [
            {
                "documentName": doc.metadata.get("document_name", ""),
                "documentId": doc.metadata.get("document_id", ""),
                "excerpt": doc.page_content[:500],
                "score": round(float(score), 4),
            }
            for doc, score in hits
        ]
        context = "\n\n---\n\n".join(doc.page_content for doc, _ in hits)

        # PII: anonymize context + query (+ history) under one shared mapping.
        session = self._anonymizer.session() if self._anonymizer else None
        if session is not None:
            context = session.anonymize(context, language="en")
            query = session.anonymize(query, language=locale)
            history = [
                {**h, "content": session.anonymize(h.get("content", ""), language=locale)}
                for h in (history or [])
            ]

        system_prompt = _PROMPTS.get(locale, _PROMPTS["en"]).format(context=context)

        deanon = session.stream_deanonymizer() if session is not None else None
        async for token in self._llm.astream(
            system_prompt=system_prompt, user_message=query, history=history
        ):
            out = deanon.push(token) if deanon else token
            if out:
                yield {"delta": out}
        if deanon:
            tail = deanon.flush()
            if tail:
                yield {"delta": tail}

        yield {"sources": sources}
