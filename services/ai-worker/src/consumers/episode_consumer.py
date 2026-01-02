"""Episode generation consumer - full pipeline."""

import logging
from typing import Dict, Any

from src.config import get_settings
from src.database import get_database_client, EpisodeRepository, EpisodeStatus
from src.generators import ScriptGenerator
from src.tts import TTSEngine, PodcasterVoice
from src.storage import LocalStorage
from .base_consumer import BaseConsumer

logger = logging.getLogger(__name__)


class EpisodeConsumer(BaseConsumer):
    """Consumer for episode generation jobs."""

    def __init__(self):
        """Initialize episode consumer."""
        settings = get_settings()
        super().__init__(
            queue_name=settings.episode_generation_queue,
            dlq_name=settings.episode_generation_dlq,
            max_retries=settings.max_retries,
            retry_delay_base=settings.retry_delay_base,
        )

        # Initialize services
        self.db_client = get_database_client()
        self.repository = EpisodeRepository(self.db_client)
        self.script_generator = ScriptGenerator()
        self.tts_engine = TTSEngine()
        self.storage = LocalStorage()

        self.max_content_chars = settings.max_book_content_chars

    def process_message(self, message: Dict[str, Any]) -> None:
        """
        Process episode generation job.

        Expected message format:
        {
            "episodeId": "uuid",
            "userId": "uuid",
            "podcasterId": "uuid",
            "bookId": "uuid",
            "title": "Episode Title",
            "contentCoverage": "ENTIRE_BOOK" | "MULTIPLE_CHAPTERS" | "SINGLE_CHAPTER",
            "chapters": [1, 2, 3],
            "episodeType": "MONOLOGUE" | "DUO" | "GROUP",
            "episodeTheme": "LECTURE" | "DISCUSSION" | "DEBATE",
            "targetLengthMin": 15,
            "targetLengthMax": 25
        }
        """
        episode_id = message["episodeId"]
        logger.info(f"Processing episode generation job: {episode_id}")

        try:
            # Step 1: Update status to SCRIPT_GENERATING
            self._update_status(episode_id, EpisodeStatus.SCRIPT_GENERATING)

            # Step 2: Fetch required data
            podcaster = self.repository.get_podcaster(message["podcasterId"])
            book = self.repository.get_book(message["bookId"])

            if not podcaster:
                raise ValueError(f"Podcaster not found: {message['podcasterId']}")
            if not book:
                raise ValueError(f"Book not found: {message['bookId']}")

            # Step 3: Get book content
            book_content = self.repository.get_book_content(
                book_id=message["bookId"],
                content_coverage=message["contentCoverage"],
                chapter_numbers=message.get("chapters", []),
                max_chars=self.max_content_chars,
            )

            if not book_content or not book_content.strip():
                raise ValueError("No book content available for script generation")

            logger.info(f"Retrieved {len(book_content)} chars of book content")

            # Step 4: Generate script
            logger.info("Generating script...")
            script_result = self.script_generator.generate(
                book_content=book_content,
                book_title=book.title,
                book_author=book.author,
                episode_title=message["title"],
                podcaster_name=podcaster.name,
                podcaster_personality={
                    "tone": podcaster.tone,
                    "communication_style": podcaster.communication_style,
                    "humor_level": podcaster.humor_level,
                    "conversational_depth": podcaster.conversational_depth,
                    "chaos_factor": podcaster.chaos_factor,
                    "intellectual_angle": podcaster.intellectual_angle,
                    "expertise_tags": podcaster.expertise_tags,
                },
                episode_type=message["episodeType"],
                episode_theme=message["episodeTheme"],
                target_length_min=message["targetLengthMin"],
                target_length_max=message["targetLengthMax"],
            )

            logger.info(
                f"Script generated: {script_result.word_count} words "
                f"(method: {script_result.method})"
            )

            # Step 5: Update status to SCRIPT_GENERATED
            self._update_status(
                episode_id,
                EpisodeStatus.SCRIPT_GENERATED,
                script_content=script_result.script,
            )

            # Step 6: Update status to AUDIO_GENERATING
            self._update_status(episode_id, EpisodeStatus.AUDIO_GENERATING)

            # Step 7: Generate audio
            logger.info("Generating audio...")
            podcaster_voice = PodcasterVoice(
                gender=podcaster.gender,
                accent=podcaster.accent,
                speaking_speed=podcaster.speaking_speed,
                vocal_pitch=podcaster.vocal_pitch,
            )

            tts_result = self.tts_engine.generate(
                script=script_result.script,
                podcaster_voice=podcaster_voice,
                episode_type=message["episodeType"],
            )

            logger.info(f"Audio generated: {tts_result.duration}s ({tts_result.format})")

            # Step 8: Save audio to storage
            audio_file_key = f"{message['userId']}/{episode_id}/audio.{tts_result.format}"
            self.storage.save(
                data=tts_result.audio_buffer,
                key=audio_file_key,
            )

            logger.info(f"Audio saved: {audio_file_key}")

            # Step 9: Update status to COMPLETED
            self._update_status(
                episode_id,
                EpisodeStatus.COMPLETED,
                audio_file_key=audio_file_key,
                duration=tts_result.duration,
                audio_format=tts_result.format,
            )

            logger.info(f"Episode generation completed: {episode_id}")

        except Exception as e:
            logger.error(f"Episode generation failed: {episode_id} - {e}")

            # Update status to FAILED
            self._update_status(
                episode_id,
                EpisodeStatus.FAILED,
                generation_error=str(e),
            )

            # Re-raise for retry logic
            raise

    def _update_status(
        self,
        episode_id: str,
        status: EpisodeStatus,
        **kwargs: Any,
    ) -> None:
        """Update episode status in database."""
        try:
            self.repository.update_status(episode_id, status, **kwargs)
        except Exception as e:
            logger.error(f"Failed to update status: {e}")
            # Don't raise - status update failure shouldn't stop processing
