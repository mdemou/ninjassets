"""In-memory stand-in for QdrantStore — no Qdrant, no embedding model."""

from __future__ import annotations

from langchain_core.documents import Document


class FakeStore:
    def __init__(self, hits: list[tuple[Document, float]] | None = None, *, ready: bool = True) -> None:
        self._hits = hits if hits is not None else [
            (
                Document(
                    page_content="To create an API key, go to Settings → API keys.",
                    metadata={"document_name": "spec-api-automation.md", "document_id": "spec-api-automation"},
                ),
                0.91,
            )
        ]
        self._ready = ready

    def search(self, query: str, *, k: int) -> list[tuple[Document, float]]:
        return self._hits[:k]

    def readyz(self) -> bool:
        return self._ready

    def ensure_collection(self) -> None:
        pass
