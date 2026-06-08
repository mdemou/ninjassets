"""Reindex CLI — `python -m ai_service.jobs.reindex` (SPEC §8.4).

Full wipe & recreate of the Qdrant collection from the bundled sources. Run in CI
after the backend image builds, or manually after editing specs/docs/the API.
"""

from __future__ import annotations

from ai_service.composition import build_container
from ai_service.config import get_settings
from ai_service.domain import indexer
from ai_service.logging import configure_logging, logger


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    container = build_container(settings)
    count = indexer.reindex(store=container.store, settings=settings)
    logger.info("done — %d chunks indexed into '%s'", count, settings.qdrant_collection)


if __name__ == "__main__":
    main()
