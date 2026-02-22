"""Script generation orchestrator."""

import logging
import re
from dataclasses import dataclass
from typing import Optional

from src.config import get_settings

from .llm_client import GeminiTextClient, LLMAPIError
from .prompt_builder import CoHostArchetype, DebateConfig, PodcasterPersonality, PromptBuilder, ScriptRequest
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
    method: str  # "llm", "llm_retry1", "llm_retry2", or "template"
    estimated_duration_seconds: int
    cohost_archetype: Optional[CoHostArchetype] = None  # Populated for DUO episodes


class ScriptGenerator:
    """Orchestrates script generation with LLM + fallback."""

    def __init__(self):
        """Initialize script generator with clients."""
        settings = get_settings()
        self.llm_client = GeminiTextClient()
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
        speaking_speed: int = 5,
        voice_tier: str = "standard",
        content_scope: str = "the book",
        chapter_title: Optional[str] = None,
        book_genres: Optional[list[str]] = None,
    ) -> ScriptResult:
        """
        Generate a podcast script.

        First attempts LLM generation, falls back to templates on failure.
        """
        # Calculate wpm based on podcaster's speaking speed
        wpm = self._speed_to_wpm(speaking_speed, voice_tier)
        target_words = self._calculate_target_words(target_length_min, target_length_max, wpm)
        logger.info(f"Speaking speed {speaking_speed}/10, tier={voice_tier} -> {wpm} wpm, target: {target_words} words")

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
        cohost_archetype = None

        # Calculate expansion ratio
        expansion_ratio = self._calculate_expansion_ratio(book_content, target_words)
        content_is_limited = self._is_content_limited(book_content) or expansion_ratio >= 1.5
        if content_is_limited:
            logger.info(
                f"Content is limited (expansion_ratio={expansion_ratio:.2f}x) - enabling deep dive mode"
            )

        # Try LLM first if available
        retry_count = 0
        if self.llm_client.is_available:
            try:
                script, cohost_archetype = self._generate_with_llm(
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
                    content_is_limited=content_is_limited,
                    retry_count=0,
                    expansion_ratio=expansion_ratio,
                    content_scope=content_scope,
                    chapter_title=chapter_title,
                    book_genres=book_genres,
                )
                method = "llm"

                # Retry if script too short (up to 2 times)
                for retry_num in range(1, 3):
                    word_count = len(script.split())
                    estimated_min = word_count / wpm

                    if estimated_min >= target_length_min:
                        break

                    logger.warning(
                        f"Attempt {retry_num} too short: {word_count} words (~{estimated_min:.1f} min), "
                        f"need at least {target_length_min} min. Retrying..."
                    )
                    script, cohost_archetype = self._generate_with_llm(
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
                        content_is_limited=True,
                        retry_count=retry_num,
                        expansion_ratio=expansion_ratio,
                        content_scope=content_scope,
                        chapter_title=chapter_title,
                        book_genres=book_genres,
                    )
                    retry_count = retry_num
                    method = f"llm_retry{retry_num}"

            except LLMAPIError as e:
                logger.warning(f"LLM generation failed, falling back to templates: {e}")
            except Exception as e:
                logger.error(f"Unexpected error in LLM generation: {e}")
        else:
            logger.info("LLM not configured, using template generation")

        # Fall back to template generation
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

        # Calculate duration and validate
        word_count = len(script.split())
        estimated_duration_seconds = self._estimate_duration_seconds(word_count, wpm)
        estimated_minutes = estimated_duration_seconds / 60

        logger.info(
            f"Script generated ({method}): {word_count} words, estimated {estimated_minutes:.1f} minutes "
            f"(target: {target_length_min}-{target_length_max} min)"
        )

        # Duration validation with retry tolerance
        is_retried = method.startswith("llm_retry") if method else False
        absolute_min_minutes = 5.0
        if retry_count >= 2:
            effective_min = max(absolute_min_minutes, target_length_min * 0.5)
        elif retry_count == 1:
            effective_min = max(absolute_min_minutes, target_length_min * 0.7)
        else:
            effective_min = float(target_length_min)

        if is_retried:
            logger.info(
                f"After {retry_count} retries: accepting scripts >= {effective_min:.1f} min "
                f"(user requested minimum: {target_length_min} min)"
            )

        if estimated_minutes < effective_min:
            error_msg = (
                f"Generated episode is approximately {estimated_minutes:.1f} minutes, "
                f"but you requested {target_length_min}-{target_length_max} minutes. "
                f"The script contains {word_count} words. "
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
            cohost_archetype=cohost_archetype,
        )

    def _speed_to_wpm(self, speaking_speed: int, voice_tier: str = "standard") -> int:
        """Convert podcaster speaking speed (1-10) to words per minute."""
        speed = max(1, min(10, speaking_speed))
        return 130 + (speed * 10)

    def _calculate_target_words(
        self,
        target_length_min: int,
        target_length_max: int,
        wpm: Optional[int] = None,
    ) -> int:
        """Calculate target word count from time range (midpoint)."""
        words_per_min = wpm or self.words_per_minute
        target_minutes = (target_length_min + target_length_max) / 2
        return int(target_minutes * words_per_min)

    def _estimate_duration_seconds(self, word_count: int, wpm: Optional[int] = None) -> int:
        """Estimate audio duration in seconds from word count."""
        words_per_min = wpm or self.words_per_minute
        minutes = word_count / words_per_min
        return int(minutes * 60)

    def _is_content_limited(self, book_content: str) -> bool:
        """Detect if the provided content is limited/truncated."""
        if len(book_content) < 15000:
            logger.info(f"Content is limited: only {len(book_content)} chars")
            return True
        content_end = book_content.strip()[-100:] if len(book_content) > 100 else book_content
        if content_end and not content_end.rstrip().endswith(('.', '!', '?', '"', "'", '...')):
            logger.info("Content appears truncated (no ending punctuation)")
            return True
        return False

    def _calculate_expansion_ratio(self, book_content: str, target_words: int) -> float:
        """Calculate how much the LLM needs to expand the source content."""
        source_words = len(book_content.split())
        if source_words == 0:
            return 10.0
        ratio = target_words / source_words
        logger.info(
            f"Expansion ratio: {ratio:.2f}x "
            f"(source: {source_words} words, target: {target_words} words)"
        )
        return ratio

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
        content_is_limited: bool = False,
        retry_count: int = 0,
        expansion_ratio: float = 1.0,
        content_scope: str = "the book",
        chapter_title: Optional[str] = None,
        book_genres: Optional[list[str]] = None,
    ) -> tuple[str, Optional[CoHostArchetype]]:
        """Generate script using LLM. Returns (script, cohost_archetype)."""
        retry_info = f" (RETRY #{retry_count} with enhanced prompt)" if retry_count > 0 else ""
        logger.info(f"Generating script with LLM for: {episode_title}{retry_info}")

        # Generate debate config for DEBATE theme episodes
        debate_config = None
        if episode_theme == "DEBATE":
            if episode_type == "DUO":
                debate_config = DebateConfig.generate(
                    episode_type=episode_type,
                    host_chaos_factor=personality.chaos_factor,
                )
                logger.info(
                    f"Generated debate config: host={debate_config.host_position.value}, "
                    f"guests={[(g.name, g.position.value, g.chaos_factor) for g in debate_config.guest_personalities]}, "
                    f"outcome={debate_config.outcome.value}, formality={debate_config.formality_level}"
                )

        # Build prompt (single-call — no chunking needed with Gemini 2.5 Flash)
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
            content_is_limited=content_is_limited,
            is_retry=retry_count > 0,
            retry_count=retry_count,
            expansion_ratio=expansion_ratio,
            content_scope=content_scope,
            chapter_title=chapter_title,
            debate_config=debate_config,
            book_genres=book_genres,
        )

        # Request more words on retries
        if retry_count >= 2:
            request_words = int(target_words * 1.5)
        elif retry_count == 1:
            request_words = int(target_words * 1.3)
        else:
            request_words = target_words

        prompt, cohost_archetype = self.prompt_builder.build_prompt(request)
        script = self.llm_client.generate_script(prompt, request_words)
        script = self._clean_script(script, episode_type)

        logger.info(f"LLM generated {len(script.split())} words (retry_count={retry_count})")
        return script, cohost_archetype

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
        # Remove instruction leakage
        lines = script.split("\n")
        cleaned_lines = []

        for line in lines:
            line = line.strip()
            if not cleaned_lines and not line:
                continue
            if line.startswith("##") or line.startswith("**Requirements"):
                continue
            cleaned_lines.append(line)

        script = "\n".join(cleaned_lines)

        # Normalize speaker labels for DUO
        if episode_type == "DUO":
            script = script.replace("Host:", "HOST:")
            script = script.replace("Guest:", "GUEST:")

        # Remove unofficial/dangerous TTS tags
        # Mode 3 vocalized adjectives (word gets spoken aloud — bad for podcasts)
        # Plus physical/visual actions that can't be synthesized
        unofficial_tags = [
            r'\[nodding\]', r'\[nods\]',
            r'\[smiling\]', r'\[smiles\]',
            r'\[thoughtful\]', r'\[thinking\]',
            r'\[leaning in\]', r'\[leans in\]', r'\[leaning forward\]',
            r'\[gesturing\]', r'\[gestures\]',
            r'\[shaking head\]', r'\[shakes head\]',
            r'\[raising eyebrows\]', r'\[raises eyebrows\]',
            r'\[pointing\]', r'\[points\]',
            r'\[looking\]', r'\[looks\]',
            r'\[turning\]', r'\[turns\]',
            r'\[sitting\]', r'\[stands\]', r'\[standing\]',
            r'\[pausing\]',
            r'\[grinning\]', r'\[grins\]',
            r'\[frowning\]', r'\[frowns\]',
            r'\[winking\]', r'\[winks\]',
            r'\[excited\]',
            # Mode 3 vocalized adjectives — the word itself gets spoken aloud
            r'\[scared\]', r'\[curious\]', r'\[bored\]',
        ]
        for tag in unofficial_tags:
            script = re.sub(tag, '', script, flags=re.IGNORECASE)

        # Clean up double spaces left behind
        script = re.sub(r'  +', ' ', script)

        return script.strip()
