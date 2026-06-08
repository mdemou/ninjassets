"""Typed settings, loaded from environment / .env.

Field names map case-insensitively to env vars (e.g. `qdrant_url` ← `QDRANT_URL`).
Everything reads from a single `Settings` via `get_settings()`.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

Locale = Literal["en", "es"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    app_env: Literal["development", "production", "test"] = "development"
    log_level: str = "INFO"
    cors_origins: list[str] = ["*"]

    # ── Internal auth (backend → aiagent) ────────────────────────────────────
    ai_agent_api_key: str = ""

    # ── Qdrant ───────────────────────────────────────────────────────────────
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_collection: str = "documents"

    # ── Embeddings ───────────────────────────────────────────────────────────
    embedding_model_hf: str = "intfloat/multilingual-e5-base"
    embedding_dimensions: int = 768
    embedding_device: str = "cpu"

    # ── LLM (Grok / xAI) ─────────────────────────────────────────────────────
    grok_api_key: str = ""
    grok_model: str = "grok-2-latest"

    # ── RAG ──────────────────────────────────────────────────────────────────
    top_k: int = 5
    min_score: float = 0.0
    max_history_messages: int = 6

    # ── PII anonymization ────────────────────────────────────────────────────
    pii_enabled: bool = True
    presidio_spacy_model_en: str = "en_core_web_sm"
    presidio_spacy_model_es: str = "es_core_news_md"

    # ── Indexing / bootstrap ─────────────────────────────────────────────────
    ai_auto_index_on_start: bool = False
    corpus_root: str = ".."
    specs_glob: str = "docs/spec-*.md"
    docs_pages_file: str = "frontend/app/data/docs-pages.ts"
    openapi_file: str = "openapi.json"
    # Optional: fetch the OpenAPI doc at reindex time if the file is absent.
    openapi_url: str | None = None

    # ── Tracing (optional; off unless both keys set) ─────────────────────────
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str | None = None

    @property
    def tracing_enabled(self) -> bool:
        return bool(self.langfuse_public_key and self.langfuse_secret_key)

    @property
    def internal_auth_required(self) -> bool:
        return bool(self.ai_agent_api_key)


@lru_cache
def get_settings() -> Settings:
    """Process-wide settings singleton. Tests call `get_settings.cache_clear()`."""
    return Settings()
