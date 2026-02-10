"""Redis client for job progress tracking and notification queuing."""

import json
import logging
from datetime import datetime
from typing import Any, Optional

import redis
from src.config import get_settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client for tracking job progress."""

    def __init__(self, host: str, port: int):
        """Initialize Redis client."""
        self._client: Optional[redis.Redis] = None
        self._host = host
        self._port = port

    def connect(self) -> None:
        """Connect to Redis."""
        try:
            self._client = redis.Redis(
                host=self._host,
                port=self._port,
                decode_responses=True,
            )
            self._client.ping()
            logger.info(f"Connected to Redis at {self._host}:{self._port}")
        except redis.ConnectionError as e:
            logger.warning(f"Failed to connect to Redis: {e}. Progress tracking disabled.")
            self._client = None

    def close(self) -> None:
        """Close Redis connection."""
        if self._client:
            self._client.close()
            self._client = None

    def is_connected(self) -> bool:
        """Check if Redis is connected."""
        if not self._client:
            return False
        try:
            self._client.ping()
            return True
        except redis.ConnectionError:
            return False

    def set_job_progress(
        self,
        episode_id: str,
        progress: int,
        status: str,
    ) -> None:
        """
        Set job progress in Redis.

        Args:
            episode_id: Episode ID
            progress: Progress percentage (0-100)
            status: Status string (e.g., 'SCRIPT_GENERATING', 'AUDIO_GENERATING')
        """
        if not self._client:
            return

        try:
            key = f"job:{episode_id}"
            self._client.hset(
                key,
                mapping={
                    "progress": str(progress),
                    "status": status,
                    "updatedAt": datetime.utcnow().isoformat(),
                },
            )
            # Set TTL of 24 hours
            self._client.expire(key, 86400)
            logger.debug(f"Set progress for {episode_id}: {progress}% ({status})")
        except Exception as e:
            logger.warning(f"Failed to set job progress in Redis: {e}")

    def get_job_progress(self, episode_id: str) -> Optional[dict]:
        """
        Get job progress from Redis.

        Args:
            episode_id: Episode ID

        Returns:
            Progress data or None if not found
        """
        if not self._client:
            return None

        try:
            key = f"job:{episode_id}"
            data = self._client.hgetall(key)
            if not data:
                return None

            return {
                "progress": int(data.get("progress", 0)),
                "status": data.get("status", "UNKNOWN"),
                "updatedAt": data.get("updatedAt"),
            }
        except Exception as e:
            logger.warning(f"Failed to get job progress from Redis: {e}")
            return None

    def delete_job_progress(self, episode_id: str) -> None:
        """
        Delete job progress from Redis.

        Args:
            episode_id: Episode ID
        """
        if not self._client:
            return

        try:
            key = f"job:{episode_id}"
            self._client.delete(key)
        except Exception as e:
            logger.warning(f"Failed to delete job progress from Redis: {e}")

    def queue_notification(
        self,
        notification_id: str,
        user_id: str,
        notification_type: str,
        title: str,
        body: str,
        data: Optional[dict[str, Any]] = None,
    ) -> None:
        """
        Add a notification to the Redis Stream for push delivery.

        Uses the same stream format as the NestJS Core API so the
        existing background consumer picks it up and sends the push.
        """
        if not self._client:
            return

        try:
            self._client.xadd(
                "notifications:stream",
                {
                    "notificationId": notification_id,
                    "userId": user_id,
                    "type": notification_type,
                    "title": title,
                    "body": body,
                    "data": json.dumps(data) if data else "",
                    "createdAt": datetime.utcnow().isoformat(),
                },
            )
            logger.info(f"Queued notification {notification_id} to stream")
        except Exception as e:
            logger.warning(f"Failed to queue notification to stream: {e}")


_redis_client: Optional[RedisClient] = None


def get_redis_client() -> RedisClient:
    """Get Redis client singleton."""
    global _redis_client

    if _redis_client is None:
        settings = get_settings()
        _redis_client = RedisClient(
            host=settings.redis_host,
            port=settings.redis_port,
        )
        _redis_client.connect()

    return _redis_client
