"""PostHog analytics for the AI worker.

Mirrors the core-api `analytics.ts` wrapper so episode generation outcomes
(success/failure, duration, voice tier) land in the same PostHog project.

All functions are best-effort: analytics must never break episode processing.
"""

import logging
from typing import Any, Optional

from src.config import get_settings

logger = logging.getLogger(__name__)

_client: Optional[Any] = None
_initialized = False


def _get_client() -> Optional[Any]:
    global _client, _initialized
    if _initialized:
        return _client

    _initialized = True
    settings = get_settings()
    if not settings.posthog_api_key:
        logger.info("[Analytics] POSTHOG_API_KEY not set - analytics disabled")
        return None

    try:
        from posthog import Posthog

        _client = Posthog(
            settings.posthog_api_key,
            host=settings.posthog_host,
            # Worker is always-on; flush eagerly so events aren't lost on restart.
            flush_at=1,
            flush_interval=5,
        )
    except Exception as err:  # pragma: no cover - defensive
        logger.error(f"[Analytics] Failed to initialize PostHog: {err}")
        _client = None

    return _client


def track_event(distinct_id: str, event: str, properties: Optional[dict] = None) -> None:
    """Capture a product event. Never raises."""
    client = _get_client()
    if not client:
        return
    try:
        client.capture(distinct_id, event, properties=properties or {})
    except Exception as err:
        logger.error(f"[Analytics] capture failed for '{event}': {err}")


def shutdown_analytics() -> None:
    """Flush and close the client on worker shutdown. Never raises."""
    if _client:
        try:
            _client.shutdown()
        except Exception as err:
            logger.error(f"[Analytics] shutdown failed: {err}")
