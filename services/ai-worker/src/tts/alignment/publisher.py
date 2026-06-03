"""Publish transcript-alignment requests to Pub/Sub.

The generation worker calls this after an episode COMPLETES, instead of aligning
inline. A dedicated alignment service consumes the topic (Pub/Sub push -> Cloud
Run, autoscaling + scale-to-zero), so episode generation never blocks on the
heavy CPU alignment work.

Best-effort: a publish failure is logged and swallowed — the episode is already
COMPLETED and unaffected; it just won't get live transcript sync.
"""

from __future__ import annotations

import json
import logging

from src.config import get_settings

logger = logging.getLogger(__name__)

_publisher = None
_topic_path: str | None = None


def _get_publisher():
    """Lazily build and cache the Pub/Sub publisher + topic path."""
    global _publisher, _topic_path
    if _publisher is None:
        import google.auth
        from google.cloud import pubsub_v1

        settings = get_settings()
        project = settings.google_cloud_project_id
        if not project:
            # On Cloud Run, ADC resolves the running project.
            _, project = google.auth.default()
        _publisher = pubsub_v1.PublisherClient()
        _topic_path = _publisher.topic_path(project, settings.alignment_topic)
    return _publisher, _topic_path


def publish_alignment_request(episode_id: str) -> bool:
    """Queue a {episodeId} alignment message. Never raises.

    Returns True if the message was published, False otherwise (disabled or error).
    """
    settings = get_settings()
    if not getattr(settings, "alignment_enabled", True):
        logger.info("[ALIGN] Alignment disabled; not queuing")
        return False

    try:
        publisher, topic_path = _get_publisher()
        data = json.dumps({"episodeId": episode_id}).encode("utf-8")
        future = publisher.publish(topic_path, data)
        future.result(timeout=15)
        logger.info(f"[ALIGN] Queued alignment request for {episode_id}")
        return True
    except Exception as e:  # noqa: BLE001 - publishing must never break generation
        logger.warning(
            f"[ALIGN] Failed to queue alignment (non-vital): {type(e).__name__}: {e}"
        )
        return False
