"""Minimal stdlib logging setup — no bespoke logger framework."""

from __future__ import annotations

import logging

logger = logging.getLogger("ai_service")


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
    )
