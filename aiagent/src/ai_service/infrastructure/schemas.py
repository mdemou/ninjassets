"""HTTP request/response DTOs."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ai_service.config import Locale


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Message(_Model):
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class RAGRequest(_Model):
    query: str = Field(min_length=1, max_length=2000)
    locale: Locale = "en"
    top_k: int | None = Field(default=None, ge=1, le=20)
    # Recent turns, supplied by the backend (the service is stateless).
    history: list[Message] = Field(default_factory=list)


class SourceChunk(_Model):
    documentName: str
    documentId: str
    excerpt: str
    score: float


class ReindexResponse(_Model):
    chunks: int


class HealthResponse(_Model):
    status: str
    qdrant: bool
