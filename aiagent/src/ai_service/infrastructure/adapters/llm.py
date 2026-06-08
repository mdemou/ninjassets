"""LLM adapter — Grok (xAI) via langchain-xai, streaming.

Tracing is optional: a Langfuse callback is attached only when keys are set
(SPEC D16). With no keys, nothing leaves the service beyond the LLM call itself.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_xai import ChatXAI


class GrokLLM:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._chat = ChatXAI(api_key=api_key, model=model, streaming=True)

    async def astream(
        self,
        *,
        system_prompt: str,
        user_message: str,
        history: list[dict[str, str]] | None = None,
    ) -> AsyncIterator[str]:
        """Yield answer tokens as they are produced."""
        messages: list[BaseMessage] = [SystemMessage(content=system_prompt)]
        for turn in history or []:
            role = turn.get("role")
            content = turn.get("content", "")
            if role == "assistant":
                messages.append(AIMessage(content=content))
            else:
                messages.append(HumanMessage(content=content))
        messages.append(HumanMessage(content=user_message))

        async for chunk in self._chat.astream(messages):
            text = chunk.content
            if text:
                yield text if isinstance(text, str) else str(text)
