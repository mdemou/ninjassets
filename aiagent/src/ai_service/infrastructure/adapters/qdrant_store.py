"""Qdrant adapter — thin wrapper over langchain-qdrant + qdrant-client.

Collection lifecycle (create / recreate / count) uses the raw client; search and
upsert go through `QdrantVectorStore` so we don't hand-roll point building or
batching. The store embeds via our `E5Embeddings` (prefixes applied there).
"""

from __future__ import annotations

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

from ai_service.logging import logger


class QdrantStore:
    def __init__(
        self,
        *,
        url: str,
        api_key: str | None,
        collection: str,
        embeddings: Embeddings,
        dim: int,
    ) -> None:
        self._client = QdrantClient(url=url, api_key=api_key)
        self._collection = collection
        self._embeddings = embeddings
        self._dim = dim
        self._store: QdrantVectorStore | None = None

    # ── collection lifecycle ─────────────────────────────────────────────────
    def ensure_collection(self) -> None:
        if not self._client.collection_exists(self._collection):
            self._create()

    def recreate_collection(self) -> None:
        """Full wipe & recreate (SPEC §8.4)."""
        if self._client.collection_exists(self._collection):
            self._client.delete_collection(self._collection)
        self._create()
        self._store = None  # rebuild store against the fresh collection

    def _create(self) -> None:
        logger.info("creating qdrant collection %s (dim=%s)", self._collection, self._dim)
        self._client.create_collection(
            collection_name=self._collection,
            vectors_config=VectorParams(size=self._dim, distance=Distance.COSINE),
        )

    def is_empty(self) -> bool:
        if not self._client.collection_exists(self._collection):
            return True
        return self._client.count(self._collection).count == 0

    def readyz(self) -> bool:
        try:
            self._client.get_collections()
            return True
        except Exception:
            return False

    # ── vector store ops ─────────────────────────────────────────────────────
    def _vs(self) -> QdrantVectorStore:
        if self._store is None:
            self.ensure_collection()
            self._store = QdrantVectorStore(
                client=self._client,
                collection_name=self._collection,
                embedding=self._embeddings,
            )
        return self._store

    def add_documents(self, documents: list[Document]) -> int:
        self._vs().add_documents(documents)
        return len(documents)

    def search(self, query: str, *, k: int) -> list[tuple[Document, float]]:
        """Return `(document, score)` pairs; score is the cosine similarity."""
        return self._vs().similarity_search_with_score(query, k=k)
