"""Deterministic LLM fake — yields preset tokens, no network."""

from __future__ import annotations

from collections.abc import AsyncIterator


class FakeLLM:
    def __init__(self, tokens: list[str]) -> None:
        self._tokens = tokens

    async def astream(
        self, *, system_prompt: str, user_message: str, history: list[dict] | None = None
    ) -> AsyncIterator[str]:
        for token in self._tokens:
            yield token
