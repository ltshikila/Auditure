"""Script generation orchestrator."""

import logging
from dataclasses import dataclass
from typing import Optional, List

from src.config import get_settings
from .llm_client import HuggingFaceClient, HuggingFaceAPIError
from .prompt_builder import PromptBuilder, ScriptRequest, PodcasterPersonality
from .templates.fallback_generator import FallbackGenerator, FallbackRequest

logger = logging.getLogger(__name__)


class DurationMismatchError(Exception):
    """Raised when generated script doesn't meet duration requirements."""

    def __init__(
        self,
        message: str,
        estimated_minutes: float,
        target_min: int,
        target_max: int,
        word_count: int,
    ):
        super().__init__(message)
        self.estimated_minutes = estimated_minutes
        self.target_min = target_min
        self.target_max = target_max
        self.word_count = word_count


@dataclass
class ScriptResult:
    """Result of script generation."""

    script: str
    word_count: int
    method: str  # "llm" or "template"
    estimated_duration_seconds: int  # Estimated duration based on word count


class ScriptGenerator:
    """Orchestrates script generation with LLM + fallback."""

    def __init__(self):
        """Initialize script generator with clients."""
        settings = get_settings()
        self.llm_client = HuggingFaceClient()
        self.prompt_builder = PromptBuilder()
        self.fallback_generator = FallbackGenerator()
        self.words_per_minute = settings.words_per_minute

    def generate(
        self,
        book_content: str,
        book_title: str,
        book_author: Optional[str],
        episode_title: str,
        podcaster_name: str,
        podcaster_personality: dict,
        episode_type: str,
        episode_theme: str,
        target_length_min: int,
        target_length_max: int,
    ) -> ScriptResult:
        """
        Generate a podcast script.

        First attempts LLM generation, falls back to templates on failure.

        Args:
            book_content: Extracted text from book
            book_title: Title of the book
            book_author: Author name (optional)
            episode_title: Title for this episode
            podcaster_name: Name of the virtual podcaster
            podcaster_personality: Dict with personality traits
            episode_type: MONOLOGUE, DUO, or GROUP
            episode_theme: LECTURE, DISCUSSION, or DEBATE
            target_length_min: Minimum length in minutes
            target_length_max: Maximum length in minutes

        Returns:
            ScriptResult with generated script and metadata
        """
        target_words = self._calculate_target_words(target_length_min, target_length_max)

        # Build personality object
        personality = PodcasterPersonality(
            tone=podcaster_personality.get("tone", 5),
            communication_style=podcaster_personality.get("communication_style", 5),
            humor_level=podcaster_personality.get("humor_level", 5),
            conversational_depth=podcaster_personality.get("conversational_depth", 5),
            chaos_factor=podcaster_personality.get("chaos_factor", 5),
            intellectual_angle=podcaster_personality.get("intellectual_angle"),
            expertise_tags=podcaster_personality.get("expertise_tags"),
        )

        script = None
        method = None

        # Try LLM first if available
        if self.llm_client.is_available:
            try:
                script = self._generate_with_llm(
                    book_content=book_content,
                    book_title=book_title,
                    book_author=book_author,
                    episode_title=episode_title,
                    podcaster_name=podcaster_name,
                    personality=personality,
                    episode_type=episode_type,
                    episode_theme=episode_theme,
                    target_length_min=target_length_min,
                    target_length_max=target_length_max,
                    target_words=target_words,
                )
                method = "llm"
            except HuggingFaceAPIError as e:
                logger.warning(f"LLM generation failed, falling back to templates: {e}")
            except Exception as e:
                logger.error(f"Unexpected error in LLM generation: {e}")
        else:
            logger.info("LLM not configured, using template generation")

        # Fall back to template generation if LLM failed or unavailable
        if script is None:
            script = self._generate_with_templates(
                book_content=book_content,
                book_title=book_title,
                book_author=book_author,
                episode_title=episode_title,
                podcaster_name=podcaster_name,
                episode_type=episode_type,
                episode_theme=episode_theme,
                target_words=target_words,
            )
            method = "template"

        # Calculate word count and estimated duration
        word_count = len(script.split())
        estimated_duration_seconds = self._estimate_duration_seconds(word_count)
        estimated_minutes = estimated_duration_seconds / 60

        logger.info(
            f"Script generated: {word_count} words, estimated {estimated_minutes:.1f} minutes "
            f"(target: {target_length_min}-{target_length_max} min)"
        )

        # Validate duration meets minimum requirements
        # Absolute minimum is 5 minutes - anything less is unacceptable
        ABSOLUTE_MIN_MINUTES = 5.0
        # Also enforce user's requested minimum with 20% tolerance
        user_min_threshold = target_length_min * 0.8

        # Use the higher of absolute minimum or user's threshold
        effective_min = max(ABSOLUTE_MIN_MINUTES, user_min_threshold)

        if estimated_minutes < effective_min:
            if estimated_minutes < ABSOLUTE_MIN_MINUTES:
                error_msg = (
                    f"Generated episode is only approximately {estimated_minutes:.1f} minutes "
                    f"({word_count} words), which is below the minimum acceptable length of 5 minutes. "
                    f"You requested {target_length_min}-{target_length_max} minutes. "
                    f"This may be due to insufficient source content or an issue with script generation. "
                    f"Please try selecting more chapters or providing more content."
                )
            else:
                error_msg = (
                    f"Generated episode would be approximately {estimated_minutes:.1f} minutes, "
                    f"but you requested {target_length_min}-{target_length_max} minutes. "
                    f"The script only contains {word_count} words. "
                    f"This may be due to insufficient source content. "
                    f"Please try selecting more chapters or a shorter target duration."
                )
            logger.error(f"Duration validation failed: {error_msg}")
            raise DurationMismatchError(
                message=error_msg,
                estimated_minutes=estimated_minutes,
                target_min=target_length_min,
                target_max=target_length_max,
                word_count=word_count,
            )

        return ScriptResult(
            script=script,
            word_count=word_count,
            method=method,
            estimated_duration_seconds=estimated_duration_seconds,
        )

    def _calculate_target_words(
        self,
        target_length_min: int,
        target_length_max: int,
    ) -> int:
        """Calculate target word count from time range."""
        avg_minutes = (target_length_min + target_length_max) / 2
        return int(avg_minutes * self.words_per_minute)

    def _estimate_duration_seconds(self, word_count: int) -> int:
        """Estimate audio duration in seconds from word count."""
        minutes = word_count / self.words_per_minute
        return int(minutes * 60)

    def _generate_with_llm(
        self,
        book_content: str,
        book_title: str,
        book_author: Optional[str],
        episode_title: str,
        podcaster_name: str,
        personality: PodcasterPersonality,
        episode_type: str,
        episode_theme: str,
        target_length_min: int,
        target_length_max: int,
        target_words: int,
    ) -> str:
        """Generate script using LLM."""
        logger.info(f"Generating script with LLM for: {episode_title}")

        request = ScriptRequest(
            book_content=book_content,
            book_title=book_title,
            book_author=book_author,
            episode_title=episode_title,
            podcaster_name=podcaster_name,
            podcaster_personality=personality,
            episode_type=episode_type,
            episode_theme=episode_theme,
            target_length_min=target_length_min,
            target_length_max=target_length_max,
        )

        prompt = self.prompt_builder.build_prompt(request)
        script = self.llm_client.generate_script(prompt, target_words)

        # Clean up the script
        script = self._clean_script(script, episode_type)

        logger.info(f"LLM generated {len(script.split())} words")
        return script

    def _generate_with_templates(
        self,
        book_content: str,
        book_title: str,
        book_author: Optional[str],
        episode_title: str,
        podcaster_name: str,
        episode_type: str,
        episode_theme: str,
        target_words: int,
    ) -> str:
        """Generate script using templates."""
        logger.info(f"Generating script with templates for: {episode_title}")

        request = FallbackRequest(
            book_content=book_content,
            book_title=book_title,
            book_author=book_author,
            episode_title=episode_title,
            podcaster_name=podcaster_name,
            episode_type=episode_type,
            episode_theme=episode_theme,
            target_word_count=target_words,
        )

        script = self.fallback_generator.generate_script(request)

        logger.info(f"Template generated {len(script.split())} words")
        return script

    def _clean_script(self, script: str, episode_type: str) -> str:
        """Clean and format the generated script."""
        # Remove any instruction leakage
        lines = script.split("\n")
        cleaned_lines = []

        for line in lines:
            line = line.strip()
            # Skip empty lines at the start
            if not cleaned_lines and not line:
                continue
            # Skip lines that look like instructions
            if line.startswith("##") or line.startswith("**Requirements"):
                continue
            cleaned_lines.append(line)

        script = "\n".join(cleaned_lines)

        # Ensure proper speaker labels for multi-voice
        if episode_type in ["DUO", "GROUP"]:
            # Normalize speaker labels
            script = script.replace("Host:", "HOST:")
            script = script.replace("Guest:", "GUEST:")
            script = script.replace("Guest 1:", "GUEST1:")
            script = script.replace("Guest 2:", "GUEST2:")

        return script.strip()
