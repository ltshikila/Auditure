"""Database repository for episode operations."""

import logging
from datetime import datetime
from typing import Any, Optional

from .client import DatabaseClient
from .models import (
    Book,
    Chapter,
    Episode,
    EpisodeStatus,
    Notification,
    Podcaster,
    Subscription,
    UserSettings,
)

logger = logging.getLogger(__name__)


class EpisodeRepository:
    """Repository for episode-related database operations."""

    def __init__(self, db_client: DatabaseClient):
        """Initialize repository with database client."""
        self.db_client = db_client

    def get_episode(self, episode_id: str) -> Optional[Episode]:
        """Get episode by ID."""
        session = self.db_client.create_session()
        try:
            return session.query(Episode).filter(Episode.id == episode_id).first()
        finally:
            session.close()

    def get_podcaster(self, podcaster_id: str) -> Optional[Podcaster]:
        """Get podcaster by ID."""
        logger.info(f"[DB] Fetching podcaster: {podcaster_id}")
        session = self.db_client.create_session()
        try:
            podcaster = session.query(Podcaster).filter(Podcaster.id == podcaster_id).first()
            if podcaster:
                logger.info(f"[DB] Found podcaster: {podcaster.name}")
            else:
                logger.warning(f"[DB] Podcaster not found: {podcaster_id}")
            return podcaster
        except Exception as e:
            logger.error(f"[DB] Error fetching podcaster: {e}")
            raise
        finally:
            session.close()

    def get_book(self, book_id: str) -> Optional[Book]:
        """Get book by ID."""
        logger.info(f"[DB] Fetching book: {book_id}")
        session = self.db_client.create_session()
        try:
            book = session.query(Book).filter(Book.id == book_id).first()
            if book:
                logger.info(f"[DB] Found book: {book.title}")
            else:
                logger.warning(f"[DB] Book not found: {book_id}")
            return book
        except Exception as e:
            logger.error(f"[DB] Error fetching book: {e}")
            raise
        finally:
            session.close()

    def get_book_content(
        self,
        book_id: str,
        content_coverage: str,
        chapter_numbers: list[int],
        max_chars: int = 8000,
    ) -> dict[str, Any]:
        """
        Get book content based on coverage type.

        Args:
            book_id: Book UUID
            content_coverage: ENTIRE_BOOK, MULTIPLE_CHAPTERS, or SINGLE_CHAPTER
            chapter_numbers: List of chapter numbers to include
            max_chars: Maximum characters to return

        Returns:
            Dict with keys:
            - content: Concatenated book content
            - truncated: Whether content was truncated
            - total_chars: Total characters available
            - returned_chars: Characters actually returned
            - chapters_included: Number of chapters fully included
            - total_chapters: Total chapters requested/available
        """
        session = self.db_client.create_session()
        try:
            query = session.query(Chapter).filter(Chapter.book_id == book_id)

            if content_coverage == "SINGLE_CHAPTER" and chapter_numbers:
                query = query.filter(Chapter.chapter_number == chapter_numbers[0])
            elif content_coverage == "MULTIPLE_CHAPTERS" and chapter_numbers:
                query = query.filter(Chapter.chapter_number.in_(chapter_numbers))
            # ENTIRE_BOOK: get all chapters

            chapters = query.order_by(Chapter.chapter_number).all()

            content_parts = []
            total_chars = 0
            total_available_chars = sum(len(ch.extracted_text or "") for ch in chapters)
            chapters_included = 0
            truncated = False

            for chapter in chapters:
                if chapter.extracted_text:
                    if total_chars + len(chapter.extracted_text) > max_chars:
                        # Truncate to fit within limit
                        remaining = max_chars - total_chars
                        if remaining > 100:  # Only add if meaningful
                            content_parts.append(chapter.extracted_text[:remaining])
                            total_chars += remaining
                        truncated = True
                        break
                    content_parts.append(chapter.extracted_text)
                    total_chars += len(chapter.extracted_text)
                    chapters_included += 1

            # Build list of chapter info (number and title) for included chapters
            chapter_info = [
                {"number": ch.chapter_number, "title": ch.title}
                for ch in chapters[:chapters_included]
            ]

            return {
                "content": "\n\n".join(content_parts),
                "truncated": truncated,
                "total_chars": total_available_chars,
                "returned_chars": total_chars,
                "chapters_included": chapters_included,
                "total_chapters": len(chapters),
                "chapter_info": chapter_info,
            }
        finally:
            session.close()

    def update_status(
        self,
        episode_id: str,
        status: EpisodeStatus,
        **kwargs: Any,
    ) -> None:
        """
        Update episode generation status.

        Args:
            episode_id: Episode UUID
            status: New status
            **kwargs: Additional fields to update (script_content, audio_file_key, etc.)
        """
        session = self.db_client.create_session()
        try:
            episode = session.query(Episode).filter(Episode.id == episode_id).first()
            if not episode:
                logger.error(f"Episode not found: {episode_id}")
                return

            episode.generation_status = status.value
            episode.updated_at = datetime.utcnow()

            # Handle status-specific updates
            if status == EpisodeStatus.SCRIPT_GENERATED:
                if "script_content" in kwargs:
                    episode.script_content = kwargs["script_content"]
                if "summary" in kwargs:
                    episode.summary = kwargs["summary"]
                episode.script_generated_at = datetime.utcnow()

            elif status == EpisodeStatus.COMPLETED:
                if "audio_file_key" in kwargs:
                    episode.audio_file_key = kwargs["audio_file_key"]
                if "duration" in kwargs:
                    episode.duration = kwargs["duration"]
                if "audio_format" in kwargs:
                    episode.audio_format = kwargs["audio_format"]
                episode.audio_generated_at = datetime.utcnow()

            elif status == EpisodeStatus.FAILED:
                if "generation_error" in kwargs:
                    episode.generation_error = kwargs["generation_error"]

            session.commit()
            logger.info(f"[DB] Successfully updated episode {episode_id} to status {status.value}")
        except Exception as e:
            session.rollback()
            logger.error(f"[DB] Failed to update episode status: {e}")
            logger.error(f"[DB] Episode ID: {episode_id}, Target status: {status.value}")
            raise
        finally:
            session.close()

    def update_segments(self, episode_id: str, segments: list[dict]) -> None:
        """Persist forced-alignment transcript segments for an episode.

        Best-effort and isolated from status updates: this runs after an episode
        is already COMPLETED, so a failure here only means the episode lacks live
        transcript timing — it never affects generation.
        """
        session = self.db_client.create_session()
        try:
            episode = session.query(Episode).filter(Episode.id == episode_id).first()
            if not episode:
                logger.warning(f"[DB] Episode not found for segments update: {episode_id}")
                return

            episode.transcript_segments = segments
            episode.updated_at = datetime.utcnow()
            session.commit()
            logger.info(
                f"[DB] Stored {len(segments)} transcript segments for episode {episode_id}"
            )
        except Exception as e:
            session.rollback()
            logger.error(f"[DB] Failed to store transcript segments: {e}")
        finally:
            session.close()

    def get_episodes_needing_alignment(self, limit: int = 50) -> list[dict[str, Any]]:
        """Return COMPLETED episodes that have audio + script but no segments yet.

        Used by the backfill script. Returns plain dicts (id/audioFileKey/script/
        audioFormat) so the SQLAlchemy session can be closed immediately.
        """
        session = self.db_client.create_session()
        try:
            episodes = (
                session.query(Episode)
                .filter(
                    Episode.generation_status == EpisodeStatus.COMPLETED.value,
                    Episode.transcript_segments.is_(None),
                    Episode.audio_file_key.isnot(None),
                    Episode.script_content.isnot(None),
                )
                .order_by(Episode.created_at.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "id": ep.id,
                    "audio_file_key": ep.audio_file_key,
                    "audio_format": ep.audio_format or "mp3",
                    "script_content": ep.script_content,
                }
                for ep in episodes
            ]
        finally:
            session.close()

    def get_episode_with_relations(
        self,
        episode_id: str,
    ) -> Optional[dict[str, Any]]:
        """
        Get episode with podcaster and book data.

        Returns dict with episode, podcaster, and book objects.
        """
        session = self.db_client.create_session()
        try:
            episode = session.query(Episode).filter(Episode.id == episode_id).first()
            if not episode:
                return None

            podcaster = session.query(Podcaster).filter(
                Podcaster.id == episode.podcaster_id
            ).first()

            book = session.query(Book).filter(Book.id == episode.book_id).first()

            return {
                "episode": episode,
                "podcaster": podcaster,
                "book": book,
            }
        finally:
            session.close()

    def create_notification(
        self,
        user_id: str,
        notification_type: str,
        title: str,
        body: str,
        data: Optional[dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Create a notification in the database.

        Returns the notification ID for Redis stream queuing.
        """
        session = self.db_client.create_session()
        try:
            notification = Notification(
                user_id=user_id,
                type=notification_type,
                title=title,
                body=body,
                data=data,
            )
            session.add(notification)
            session.commit()
            notification_id = notification.id
            logger.info(f"[DB] Created notification {notification_id} for user {user_id}")
            return notification_id
        except Exception as e:
            session.rollback()
            logger.error(f"[DB] Failed to create notification: {e}")
            return None
        finally:
            session.close()

    def get_push_settings(self, user_id: str) -> Optional[dict[str, Any]]:
        """Get a user's push token and whether push notifications are enabled."""
        session = self.db_client.create_session()
        try:
            settings = (
                session.query(UserSettings)
                .filter(UserSettings.user_id == user_id)
                .first()
            )
            if not settings:
                return None
            return {
                "push_enabled": bool(settings.push_notifications_enabled),
                "token": settings.expo_push_token,
            }
        except Exception as e:
            logger.error(f"[DB] Failed to fetch push settings for {user_id}: {e}")
            return None
        finally:
            session.close()

    def clear_push_token(self, user_id: str) -> None:
        """Clear a user's push token (e.g. after Expo reports DeviceNotRegistered)."""
        session = self.db_client.create_session()
        try:
            settings = (
                session.query(UserSettings)
                .filter(UserSettings.user_id == user_id)
                .first()
            )
            if settings:
                settings.expo_push_token = None
                session.commit()
                logger.info(f"[DB] Cleared dead push token for user {user_id}")
        except Exception as e:
            session.rollback()
            logger.error(f"[DB] Failed to clear push token for {user_id}: {e}")
        finally:
            session.close()

    def consume_quota(self, user_id: str, voice_tier: str) -> bool:
        """
        Increment episode usage for a user after successful generation.

        Called only when an episode COMPLETES successfully.

        Args:
            user_id: User UUID
            voice_tier: GEMINI or STANDARD

        Returns:
            True if quota was consumed, False on error
        """
        session = self.db_client.create_session()
        try:
            sub = session.query(Subscription).filter(
                Subscription.user_id == user_id
            ).first()

            if not sub:
                logger.error(f"[DB] No subscription found for user {user_id}")
                return False

            if voice_tier.upper() == "GEMINI":
                sub.gemini_episodes_used += 1
                logger.info(
                    f"[DB] Incremented Gemini usage for user {user_id}: "
                    f"{sub.gemini_episodes_used}/{sub.gemini_episode_limit}"
                )
            else:
                sub.standard_episodes_used += 1
                logger.info(
                    f"[DB] Incremented Standard usage for user {user_id}: "
                    f"{sub.standard_episodes_used}/{sub.standard_episode_limit}"
                )

            sub.updated_at = datetime.utcnow()
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            logger.error(f"[DB] Failed to consume quota: {e}")
            return False
        finally:
            session.close()
