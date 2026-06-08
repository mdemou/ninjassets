"""Embeddings adapter — local multilingual-e5 via langchain-huggingface.

e5 models REQUIRE prefixes: `query: ` for queries and `passage: ` for documents
(SPEC §7.4). We wrap the HF embeddings in a thin `Embeddings` subclass that adds
the prefixes, so the rest of the stack (langchain-qdrant) stays prefix-unaware
and we still avoid hand-rolling any embedding/Qdrant code.
"""

from __future__ import annotations

from langchain_core.embeddings import Embeddings


class E5Embeddings(Embeddings):
    """HuggingFace e5 embeddings with the mandatory `query:`/`passage:` prefixes."""

    def __init__(self, *, model_name: str, device: str = "cpu") -> None:
        from langchain_huggingface import HuggingFaceEmbeddings

        self._hf = HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={"device": device},
            encode_kwargs={"normalize_embeddings": True},
        )

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._hf.embed_documents([f"passage: {t}" for t in texts])

    def embed_query(self, text: str) -> list[float]:
        return self._hf.embed_query(f"query: {text}")


def build_embedder(*, model_name: str, device: str) -> E5Embeddings:
    return E5Embeddings(model_name=model_name, device=device)
