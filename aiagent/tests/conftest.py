"""Shared fixtures — build the real app + RagService against fakes.

Only the outermost adapters (store, LLM) are faked; the real RagService, routes,
and SSE wiring are exercised end-to-end (the `_python` test philosophy).
"""

from __future__ import annotations

import os

import pytest

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AI_AGENT_API_KEY", "")  # internal-auth check disabled
os.environ.setdefault("PII_ENABLED", "false")  # no spaCy in unit tests

from fastapi.testclient import TestClient  # noqa: E402

from ai_service.config import get_settings  # noqa: E402
from ai_service.domain.rag import RagService  # noqa: E402
from ai_service.infrastructure.deps import get_rag, get_store  # noqa: E402
from ai_service.main import create_app  # noqa: E402
from tests.fakes.fake_llm import FakeLLM  # noqa: E402
from tests.fakes.fake_store import FakeStore  # noqa: E402


@pytest.fixture
def store() -> FakeStore:
    return FakeStore()


@pytest.fixture
def llm() -> FakeLLM:
    return FakeLLM(["To create an API key, ", "open Settings → API keys."])


@pytest.fixture
def client(store: FakeStore, llm: FakeLLM) -> TestClient:
    get_settings.cache_clear()
    settings = get_settings()
    app = create_app()
    rag = RagService(store=store, llm=llm, anonymizer=None, settings=settings)
    app.dependency_overrides[get_rag] = lambda: rag
    app.dependency_overrides[get_store] = lambda: store
    with TestClient(app) as c:
        yield c
