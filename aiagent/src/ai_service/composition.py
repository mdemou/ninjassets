"""Composition — build the concrete adapters + domain services from settings.

The one place that wires everything together (a plain function, not a DI
container). `main.lifespan` calls it and stashes the result on `app.state`; tests
build a container with fakes instead.
"""

from __future__ import annotations

from dataclasses import dataclass

from ai_service.config import Settings
from ai_service.domain.rag import RagService
from ai_service.infrastructure.adapters.anonymizer import Anonymizer
from ai_service.infrastructure.adapters.embedder import build_embedder
from ai_service.infrastructure.adapters.llm import GrokLLM
from ai_service.infrastructure.adapters.qdrant_store import QdrantStore


@dataclass(slots=True)
class Container:
    settings: Settings
    store: QdrantStore
    rag: RagService


def build_container(settings: Settings) -> Container:
    embedder = build_embedder(
        model_name=settings.embedding_model_hf, device=settings.embedding_device
    )
    store = QdrantStore(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        collection=settings.qdrant_collection,
        embeddings=embedder,
        dim=settings.embedding_dimensions,
    )
    llm = GrokLLM(api_key=settings.grok_api_key, model=settings.grok_model)
    anonymizer = (
        Anonymizer(
            spacy_model_en=settings.presidio_spacy_model_en,
            spacy_model_es=settings.presidio_spacy_model_es,
        )
        if settings.pii_enabled
        else None
    )
    rag = RagService(store=store, llm=llm, anonymizer=anonymizer, settings=settings)
    return Container(settings=settings, store=store, rag=rag)
