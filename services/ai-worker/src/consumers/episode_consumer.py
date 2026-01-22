"""Episode generation consumer - full pipeline."""

import logging
from typing import Dict, Any

from src.config import get_settings
from src.database import get_database_client, EpisodeRepository, EpisodeStatus
from src.generators import ScriptGenerator, DurationMismatchError
from src.tts import TTSEngine, PodcasterVoice
from src.storage import LocalStorage
from src.redis import get_redis_client
from .base_consumer import BaseConsumer

logger = logging.getLogger(__name__)

# Progress percentages for each stage
PROGRESS_STARTED = 10
PROGRESS_FETCHING_DATA = 20
PROGRESS_SCRIPT_GENERATING = 40
PROGRESS_SCRIPT_COMPLETE = 60
PROGRESS_AUDIO_GENERATING = 80
PROGRESS_COMPLETE = 100


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
        self.redis_client = get_redis_client()

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
            "targetLengthMax": 25,
            "voiceTier": "STANDARD" | "GEMINI"
        }
        """
        episode_id = message["episodeId"]
        voice_tier = message.get("voiceTier", "STANDARD").lower()  # Default to standard

        # Idempotency check: skip if episode is already completed
        existing_episode = self.repository.get_episode(episode_id)
        if existing_episode and existing_episode.generation_status == EpisodeStatus.COMPLETED.value:
            logger.info("=" * 50)
            logger.info(f"[EPISODE] SKIPPING: {episode_id} - already COMPLETED")
            logger.info("[EPISODE] Message was likely redelivered after connection loss")
            logger.info("=" * 50)
            return  # Exit without processing - episode is already done

        logger.info("=" * 50)
        logger.info(f"[EPISODE] Starting generation for: {episode_id}")
        logger.info(f"[EPISODE] Title: {message.get('title', 'Unknown')}")
        logger.info(f"[EPISODE] Type: {message.get('episodeType')} | Theme: {message.get('episodeTheme')}")
        logger.info(f"[EPISODE] Target length: {message.get('targetLengthMin')}-{message.get('targetLengthMax')} min")
        logger.info(f"[EPISODE] Voice tier: {voice_tier}")
        logger.info("=" * 50)

        try:
            # Step 1: Update status to SCRIPT_GENERATING
            logger.info("[STEP 1/9] Updating status to SCRIPT_GENERATING...")
            self._update_status(episode_id, EpisodeStatus.SCRIPT_GENERATING)
            self._update_progress(episode_id, PROGRESS_STARTED, "SCRIPT_GENERATING")

            # Step 2: Fetch required data
            logger.info("[STEP 2/9] Fetching podcaster and book data...")
            self._update_progress(episode_id, PROGRESS_FETCHING_DATA, "FETCHING_DATA")
            podcaster = self.repository.get_podcaster(message["podcasterId"])
            book = self.repository.get_book(message["bookId"])

            if not podcaster:
                raise ValueError(f"Podcaster not found: {message['podcasterId']}")
            if not book:
                raise ValueError(f"Book not found: {message['bookId']}")

            logger.info(f"[STEP 2/9] Found podcaster: {podcaster.name} (voice: {podcaster.gender}, {podcaster.accent})")
            logger.info(f"[STEP 2/9] Found book: {book.title} by {book.author}")

            # Step 3: Get book content
            logger.info(f"[STEP 3/9] Fetching book content (coverage: {message['contentCoverage']})...")
            content_result = self.repository.get_book_content(
                book_id=message["bookId"],
                content_coverage=message["contentCoverage"],
                chapter_numbers=message.get("chapters", []),
                max_chars=self.max_content_chars,
            )

            book_content = content_result["content"]
            if not book_content or not book_content.strip():
                raise ValueError("No book content available for script generation")

            # Log truncation warning if content was truncated
            if content_result["truncated"]:
                logger.warning(
                    f"[STEP 3/9] Content truncated! "
                    f"Used {content_result['returned_chars']:,} of {content_result['total_chars']:,} chars "
                    f"({content_result['chapters_included']}/{content_result['total_chapters']} chapters fully included). "
                    f"Consider using fewer chapters for better coverage."
                )
            else:
                logger.info(
                    f"[STEP 3/9] Retrieved {content_result['returned_chars']:,} chars "
                    f"({content_result['chapters_included']} chapters)"
                )

            # Build content_scope and chapter_title for script generation
            content_scope, chapter_title = self._build_content_scope(
                content_coverage=message["contentCoverage"],
                chapter_info=content_result.get("chapter_info", []),
            )
            logger.info(f"[STEP 3/9] Content scope: {content_scope}")

            # Step 4: Generate script
            logger.info("[STEP 4/9] Starting script generation...")
            self._update_progress(episode_id, PROGRESS_SCRIPT_GENERATING, "SCRIPT_GENERATING")
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
                speaking_speed=podcaster.speaking_speed,
                voice_tier=voice_tier,
                content_scope=content_scope,
                chapter_title=chapter_title,
            )

            logger.info(
                f"[STEP 4/9] Script generated: {script_result.word_count} words "
                f"(method: {script_result.method})"
            )

            # Step 5: Update status to SCRIPT_GENERATED
            logger.info("[STEP 5/9] Saving script to database...")
            self._update_status(
                episode_id,
                EpisodeStatus.SCRIPT_GENERATED,
                script_content=script_result.script,
            )
            self._update_progress(episode_id, PROGRESS_SCRIPT_COMPLETE, "SCRIPT_GENERATED")

            # Step 6: Update status to AUDIO_GENERATING
            logger.info("[STEP 6/9] Starting audio generation...")
            self._update_status(episode_id, EpisodeStatus.AUDIO_GENERATING)
            self._update_progress(episode_id, PROGRESS_AUDIO_GENERATING, "AUDIO_GENERATING")

            # Step 7: Generate audio
            logger.info(f"[STEP 7/9] Generating TTS audio (voice tier: {voice_tier})...")
            podcaster_voice = PodcasterVoice(
                gender=podcaster.gender,
                accent=podcaster.accent,
                speaking_speed=podcaster.speaking_speed,
                vocal_pitch=podcaster.vocal_pitch,
                voice_model=podcaster.voice_model,
                gemini_voice_name=podcaster.gemini_voice_name,  # Use stored voice
            )

            tts_result = self.tts_engine.generate(
                script=script_result.script,
                podcaster_voice=podcaster_voice,
                episode_type=message["episodeType"],
                voice_tier=voice_tier,
            )

            logger.info(f"[STEP 7/9] Audio generated: {tts_result.duration}s ({tts_result.format})")

            # Step 8: Save audio to storage
            logger.info("[STEP 8/9] Saving audio to storage...")
            audio_file_key = f"{message['userId']}/{episode_id}/audio.{tts_result.format}"
            self.storage.save(
                data=tts_result.audio_buffer,
                key=audio_file_key,
            )

            logger.info(f"[STEP 8/9] Audio saved: {audio_file_key}")

            # Step 9: Update status to COMPLETED
            logger.info("[STEP 9/9] Updating status to COMPLETED...")
            self._update_status(
                episode_id,
                EpisodeStatus.COMPLETED,
                audio_file_key=audio_file_key,
                duration=tts_result.duration,
                audio_format=tts_result.format,
            )
            self._update_progress(episode_id, PROGRESS_COMPLETE, "COMPLETED")

            logger.info("=" * 50)
            logger.info(f"[EPISODE] COMPLETED: {episode_id}")
            logger.info(f"[EPISODE] Duration: {tts_result.duration}s | Words: {script_result.word_count}")
            logger.info("=" * 50)

        except DurationMismatchError as e:
            # Duration mismatch is a user-recoverable error, not a system failure
            # Don't retry - the user needs to adjust their request
            logger.warning("=" * 50)
            logger.warning(f"[EPISODE] DURATION MISMATCH: {episode_id}")
            logger.warning(
                f"[EPISODE] Generated ~{e.estimated_minutes:.1f} min, "
                f"requested {e.target_min}-{e.target_max} min ({e.word_count} words)"
            )
            logger.warning("=" * 50)

            # Update status to FAILED with a user-friendly error message
            self._update_status(
                episode_id,
                EpisodeStatus.FAILED,
                generation_error=str(e),
            )
            self._update_progress(episode_id, 0, "DURATION_MISMATCH")

            # Don't re-raise - this is not a retryable error
            # The user needs to select more content or adjust duration expectations

        except Exception as e:
            logger.error("=" * 50)
            logger.error(f"[EPISODE] FAILED: {episode_id}")
            logger.error(f"[EPISODE] Error: {type(e).__name__}: {e}")
            logger.error("=" * 50)

            # Update status to FAILED
            self._update_status(
                episode_id,
                EpisodeStatus.FAILED,
                generation_error=str(e),
            )
            self._update_progress(episode_id, 0, "FAILED")

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

    def _update_progress(
        self,
        episode_id: str,
        progress: int,
        status: str,
    ) -> None:
        """Update job progress in Redis for real-time UI updates."""
        try:
            self.redis_client.set_job_progress(episode_id, progress, status)
        except Exception as e:
            logger.error(f"Failed to update progress in Redis: {e}")
            # Don't raise - progress update failure shouldn't stop processing

    def _build_content_scope(
        self,
        content_coverage: str,
        chapter_info: list,
    ) -> tuple:
        """
        Build content_scope string and chapter_title from coverage info.

        Args:
            content_coverage: ENTIRE_BOOK, MULTIPLE_CHAPTERS, or SINGLE_CHAPTER
            chapter_info: List of dicts with 'number' and 'title' keys

        Returns:
            Tuple of (content_scope, chapter_title)
            - content_scope: e.g., "Chapter 2", "Chapters 1-3", "the entire book"
            - chapter_title: Title if single chapter, None otherwise
        """
        if not chapter_info:
            return ("the book", None)

        if content_coverage == "ENTIRE_BOOK" or content_coverage == "FULL":
            return ("the entire book", None)

        if content_coverage == "SINGLE_CHAPTER" and len(chapter_info) == 1:
            ch = chapter_info[0]
            chapter_num = ch.get("number", 1)
            chapter_title = ch.get("title")

            if chapter_title:
                return (f"Chapter {chapter_num}: {chapter_title}", chapter_title)
            else:
                return (f"Chapter {chapter_num}", None)

        # Multiple chapters
        if len(chapter_info) == 1:
            ch = chapter_info[0]
            chapter_num = ch.get("number", 1)
            chapter_title = ch.get("title")
            if chapter_title:
                return (f"Chapter {chapter_num}: {chapter_title}", chapter_title)
            return (f"Chapter {chapter_num}", None)

        # Multiple chapters - build a range or list
        chapter_numbers = [ch.get("number", i + 1) for i, ch in enumerate(chapter_info)]
        chapter_numbers.sort()

        # Check if chapters are consecutive
        if chapter_numbers == list(range(chapter_numbers[0], chapter_numbers[-1] + 1)):
            # Consecutive range: "Chapters 1-5"
            return (f"Chapters {chapter_numbers[0]}-{chapter_numbers[-1]}", None)
        else:
            # Non-consecutive: "Chapters 1, 3, and 5"
            if len(chapter_numbers) == 2:
                return (f"Chapters {chapter_numbers[0]} and {chapter_numbers[1]}", None)
            else:
                nums_str = ", ".join(str(n) for n in chapter_numbers[:-1])
                return (f"Chapters {nums_str}, and {chapter_numbers[-1]}", None)
