"""Indexer — sources → chunk → embed(passage:) → wipe + upsert (SPEC §8.4).

Strategy: **full wipe & recreate**. The corpus is small, so this is the simplest
thing that can't leave stale or duplicate chunks. Embedding (with the `passage:`
prefix) happens inside `QdrantStore.add_documents` via the E5 embeddings.
"""

from __future__ import annotations

from datetime import datetime, timezone

from langchain_core.documents import Document

from ai_service.config import Settings
from ai_service.domain.chunking import split_text
from ai_service.domain.sources import load_documents
from ai_service.infrastructure.adapters.qdrant_store import QdrantStore
from ai_service.logging import logger


def build_chunks(settings: Settings) -> list[Document]:
    indexed_at = datetime.now(timezone.utc).isoformat()
    chunks: list[Document] = []
    for raw in load_documents(settings):
        for i, text in enumerate(split_text(raw.content)):
            chunks.append(
                Document(
                    page_content=text,
                    metadata={**raw.metadata, "chunk_index": i, "indexed_at": indexed_at},
                )
            )
    return chunks


def reindex(*, store: QdrantStore, settings: Settings) -> int:
    """Wipe the collection and re-ingest the whole corpus. Returns chunk count."""
    chunks = build_chunks(settings)
    logger.info("reindexing: %d chunks", len(chunks))
    store.recreate_collection()
    if chunks:
        store.add_documents(chunks)
    logger.info("reindex complete: %d chunks", len(chunks))
    return len(chunks)
