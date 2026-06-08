"""ninjasset admin AI assistant — RAG service.

A lightly-layered FastAPI service (SPEC-AI-ASSISTANT-001 §6.4):

    domain/            pure business logic (rag, indexer, sources, chunking)
    infrastructure/    routes + concrete adapters (no ports, no DI container)

Stateless: the backend owns conversation memory and passes recent turns per call.
"""

__version__ = "0.1.0"
