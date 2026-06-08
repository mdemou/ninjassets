"""Text chunking — RecursiveCharacterTextSplitter (SPEC §8.2).

Ported from the legacy aiagent chunker; the only logic worth keeping from the old
service. 1000 chars / 200 overlap.
"""

from __future__ import annotations

from langchain_text_splitters import RecursiveCharacterTextSplitter

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def split_text(text: str) -> list[str]:
    if not text.strip():
        return []
    return _splitter.split_text(text)
