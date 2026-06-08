"""RAG endpoint streams SSE; empty retrieval short-circuits (§9.3, §9.5)."""

import pytest

from ai_service.config import get_settings
from ai_service.domain.rag import RagService
from ai_service.infrastructure.deps import get_rag
from tests.fakes.fake_llm import FakeLLM
from tests.fakes.fake_store import FakeStore


def test_rag_streams_tokens_and_sources(client):
    resp = client.post("/chat/rag", json={"query": "How do I create an API key?", "locale": "en"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    body = resp.text
    assert '"delta"' in body
    assert '"sources"' in body
    assert "spec-api-automation" in body
    assert body.rstrip().endswith("data: [DONE]")


def test_rag_empty_retrieval_short_circuits(client):
    empty_store = FakeStore(hits=[])
    rag = RagService(
        store=empty_store, llm=FakeLLM(["unused"]), anonymizer=None, settings=get_settings()
    )
    client.app.dependency_overrides[get_rag] = lambda: rag

    resp = client.post("/chat/rag", json={"query": "weather today", "locale": "en"})
    assert resp.status_code == 200
    body = resp.text
    assert '"empty": true' in body
    assert '"delta"' not in body  # no LLM call


@pytest.mark.parametrize("locale", ["en", "es"])
def test_rag_accepts_both_locales(client, locale):
    resp = client.post("/chat/rag", json={"query": "API keys?", "locale": locale})
    assert resp.status_code == 200
