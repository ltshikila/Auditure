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
        speaking_speed: int = 5,
        voice_tier: str = "standard",
        content_scope: str = "the book",
        chapter_title: Optional[str] = None,
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
            speaking_speed: Podcaster speaking speed 1-10 (affects word count)
            voice_tier: TTS voice tier (gemini, premium, standard)
            content_scope: Description of content being covered (e.g., "Chapter 2", "Chapters 1-3")
            chapter_title: Title of the chapter if single chapter selected

        Returns:
            ScriptResult with generated script and metadata
        """
        # Calculate wpm based on podcaster's speaking speed AND TTS engine
        # Gemini TTS speaks significantly faster (~270 wpm vs ~170 wpm for standard)
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

        # Calculate expansion ratio to understand how much we need to elaborate
        expansion_ratio = self._calculate_expansion_ratio(book_content, target_words)

        # Detect if content appears to be truncated/limited
        content_is_limited = self._is_content_limited(book_content) or expansion_ratio >= 1.5
        if content_is_limited:
            logger.info(
                f"Content is limited (expansion_ratio={expansion_ratio:.2f}x) - enabling deep dive mode"
            )

        # Try LLM first if available
        retry_count = 0
        if self.llm_client.is_available:
            try:
                # First attempt
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
                    content_is_limited=content_is_limited,
                    retry_count=0,
                    expansion_ratio=expansion_ratio,
                    content_scope=content_scope,
                    chapter_title=chapter_title,
                )
                method = "llm"

                # Check if script is too short - retry up to 2 times
                # The user's minimum (target_length_min) is the hard floor
                for retry_num in range(1, 3):  # Retry 1 and 2
                    word_count = len(script.split())
                    estimated_min = word_count / wpm

                    # Script must meet the user's requested minimum
                    if estimated_min >= target_length_min:
                        break  # Script is acceptable

                    logger.warning(
                        f"Attempt {retry_num} too short: {word_count} words (~{estimated_min:.1f} min), "
                        f"need at least {target_length_min} min. Retrying with enhanced prompt..."
                    )
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
                        content_is_limited=True,  # Force deep dive on retry
                        retry_count=retry_num,
                        expansion_ratio=expansion_ratio,
                        content_scope=content_scope,
                        chapter_title=chapter_title,
                    )
                    retry_count = retry_num
                    method = f"llm_retry{retry_num}"

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

        # Calculate word count and estimated duration using podcaster's wpm
        word_count = len(script.split())
        estimated_duration_seconds = self._estimate_duration_seconds(word_count, wpm)
        estimated_minutes = estimated_duration_seconds / 60

        logger.info(
            f"Script generated ({method}): {word_count} words, estimated {estimated_minutes:.1f} minutes "
            f"(target: {target_length_min}-{target_length_max} min)"
        )

        # Validate duration meets the user's requested minimum
        # The user's minimum IS the hard floor - no percentage tolerance
        # After retries, we accept slightly shorter (we tried our best)
        is_retried = method.startswith("llm_retry") if method else False

        # After 2 retries, accept 50% of user's minimum (gpt-4o-mini struggles with long content)
        # After 1 retry, accept 70% of user's minimum
        # No retry: require full user minimum
        # Absolute floor: 5 minutes (anything less is unacceptable)
        ABSOLUTE_MIN_MINUTES = 5.0
        if retry_count >= 2:
            effective_min = max(ABSOLUTE_MIN_MINUTES, target_length_min * 0.5)
        elif retry_count == 1:
            effective_min = max(ABSOLUTE_MIN_MINUTES, target_length_min * 0.7)
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
        )

    def _speed_to_wpm(self, speaking_speed: int, voice_tier: str = "standard") -> int:
        """
        Convert podcaster speaking speed (1-10) to words per minute.

        Gemini TTS speaks significantly faster than Google Cloud TTS,
        so we use different base WPM values.

        Standard/Premium (Google Cloud TTS):
        - Speed 1: ~140 wpm (slow, deliberate)
        - Speed 5: ~185 wpm (normal conversational)
        - Speed 10: ~230 wpm (fast, energetic)
        - Formula: wpm = 130 + (speed * 10)

        Gemini TTS (speaks ~1.5x faster):
        - Speed 1: ~210 wpm
        - Speed 5: ~270 wpm
        - Speed 10: ~330 wpm
        - Formula: wpm = 200 + (speed * 13)
        """
        speed = max(1, min(10, speaking_speed))

        if voice_tier == "gemini":
            # Gemini TTS speaks faster - need more words to fill same time
            return 200 + (speed * 13)
        else:
            # Standard/Premium Google Cloud TTS
            return 130 + (speed * 10)

    def _calculate_target_words(
        self,
        target_length_min: int,
        target_length_max: int,
        wpm: Optional[int] = None,
    ) -> int:
        """Calculate target word count from time range.

        Always aims for the MAXIMUM duration - the minimum is the tolerance floor.
        """
        words_per_min = wpm or self.words_per_minute
        # Always aim for the max - user's min is just the acceptable floor
        return int(target_length_max * words_per_min)

    def _estimate_duration_seconds(self, word_count: int, wpm: Optional[int] = None) -> int:
        """Estimate audio duration in seconds from word count."""
        words_per_min = wpm or self.words_per_minute
        minutes = word_count / words_per_min
        return int(minutes * 60)

    def _is_content_limited(self, book_content: str) -> bool:
        """
        Detect if the provided content is limited/truncated.

        Heuristics:
        - Content under 15,000 chars is considered limited (~3,000 words)
        - Content that ends abruptly (mid-sentence) is considered limited
        """
        # Short content is definitely limited
        if len(book_content) < 15000:
            logger.info(f"Content is limited: only {len(book_content)} chars")
            return True

        # Check if content ends mid-sentence (no proper ending punctuation)
        content_end = book_content.strip()[-100:] if len(book_content) > 100 else book_content
        if content_end and not content_end.rstrip().endswith(('.', '!', '?', '"', "'", '...')):
            logger.info("Content appears truncated (no ending punctuation)")
            return True

        return False

    def _calculate_expansion_ratio(self, book_content: str, target_words: int) -> float:
        """
        Calculate how much the LLM needs to expand the source content.

        Returns ratio of target_words / source_words.
        A ratio of 2.0 means the script needs to be 2x longer than the source.
        """
        source_words = len(book_content.split())
        if source_words == 0:
            return 10.0  # Max expansion needed

        ratio = target_words / source_words
        logger.info(
            f"Expansion ratio: {ratio:.2f}x "
            f"(source: {source_words} words, target: {target_words} words)"
        )
        return ratio

    def _needs_chunked_generation(self, target_words: int) -> bool:
        """Determine if we need to generate in chunks.

        gpt-4o-mini reliably generates ~1200-1500 words per call.
        For longer scripts, we need to generate in chunks.
        """
        # Threshold: if we need more than 1800 words, use chunked generation
        return target_words > 1800

    def _generate_chunked(
        self,
        book_content: str,
        book_title: str,
        book_author: Optional[str],
        episode_title: str,
        podcaster_name: str,
        personality: PodcasterPersonality,
        episode_type: str,
        episode_theme: str,
        target_words: int,
        expansion_ratio: float,
        content_scope: str = "the book",
    ) -> str:
        """Generate a long script in multiple chunks and combine them.

        gpt-4o-mini struggles with generating >1500 words in one call.
        This method splits the generation into chunks:
        - Chunk 1: Introduction + first topic discussion
        - Chunk 2-N: Continue discussion with context from previous
        - Final chunk: Wrap up and conclusion
        """
        # Calculate number of chunks needed (aim for ~1200-1400 words per chunk)
        WORDS_PER_CHUNK = 1300
        num_chunks = max(2, (target_words + WORDS_PER_CHUNK - 1) // WORDS_PER_CHUNK)
        words_per_chunk = target_words // num_chunks

        logger.info(
            f"Using chunked generation: {num_chunks} chunks, ~{words_per_chunk} words each "
            f"(total target: {target_words} words)"
        )

        chunks = []
        previous_summary = ""
        topics_covered: List[str] = []  # Track topics to avoid repetition

        for chunk_num in range(num_chunks):
            is_first = chunk_num == 0
            is_last = chunk_num == num_chunks - 1

            # Build chunk-specific prompt
            chunk_prompt = self._build_chunk_prompt(
                book_content=book_content,
                book_title=book_title,
                book_author=book_author,
                episode_title=episode_title,
                podcaster_name=podcaster_name,
                personality=personality,
                episode_type=episode_type,
                episode_theme=episode_theme,
                chunk_num=chunk_num + 1,
                total_chunks=num_chunks,
                words_per_chunk=words_per_chunk,
                previous_summary=previous_summary,
                is_first=is_first,
                is_last=is_last,
                expansion_ratio=expansion_ratio,
                topics_covered=topics_covered if chunk_num > 0 else None,
                content_scope=content_scope,
            )

            logger.info(f"Generating chunk {chunk_num + 1}/{num_chunks}...")
            chunk_script = self.llm_client.generate_script(chunk_prompt, words_per_chunk)
            chunk_script = self._clean_script(chunk_script, episode_type)
            chunk_word_count = len(chunk_script.split())

            logger.info(f"Chunk {chunk_num + 1} generated: {chunk_word_count} words")
            chunks.append(chunk_script)

            # Create summary of what was covered for context in next chunk
            if not is_last:
                # Extract last few sentences as context for next chunk
                sentences = chunk_script.replace('\n', ' ').split('. ')
                previous_summary = '. '.join(sentences[-3:]) if len(sentences) > 3 else chunk_script[-500:]

                # Extract key topics from this chunk to avoid repetition
                new_topics = self._extract_topics_from_chunk(chunk_script)
                topics_covered.extend(new_topics)
                logger.info(f"Topics covered so far: {topics_covered}")

        # Combine all chunks
        combined_script = self._combine_chunks(chunks, episode_type)
        total_words = len(combined_script.split())
        logger.info(f"Combined script: {total_words} words from {num_chunks} chunks")

        return combined_script

    def _build_chunk_prompt(
        self,
        book_content: str,
        book_title: str,
        book_author: Optional[str],
        episode_title: str,
        podcaster_name: str,
        personality: PodcasterPersonality,
        episode_type: str,
        episode_theme: str,
        chunk_num: int,
        total_chunks: int,
        words_per_chunk: int,
        previous_summary: str,
        is_first: bool,
        is_last: bool,
        expansion_ratio: float,
        topics_covered: Optional[List[str]] = None,
        content_scope: str = "the book",
    ) -> str:
        """Build a prompt for generating a specific chunk of the script."""
        author_line = f" by {book_author}" if book_author else ""

        # Personality description
        personality_desc = self.prompt_builder.build_personality_description(personality)

        # Build topics covered section if any
        topics_section = ""
        if topics_covered and len(topics_covered) > 0:
            topics_list = "\n".join(f"  - {topic}" for topic in topics_covered)
            topics_section = f"""
## ALREADY COVERED - DO NOT REPEAT THESE TOPICS OR EXAMPLES!
The following topics, examples, and references have already been used in previous parts.
DO NOT repeat them or use similar examples:
{topics_list}

CRITICAL: Use DIFFERENT examples and scenarios! If you talked about a restaurant example, use a different industry.
If you mentioned a specific person or company, don't mention them again. Create FRESH illustrations!
"""

        # Position-specific instructions
        if is_first:
            position_instruction = f"""
## Part 1 of {total_chunks} - INTRODUCTION
This is the OPENING of the episode. You MUST:
- Start with an engaging hook to grab listeners
- Introduce the book "{book_title}" and clearly state you're covering {content_scope}
- Set up what you'll be discussing in this episode
- Begin exploring the first key concepts from the content
- Write approximately {words_per_chunk} words
- End with a transition like "We'll continue after a short break" or "Stay with us" - NOT "see you next time"
- Do NOT conclude or wrap up - this continues in the next part
"""
        elif is_last:
            position_instruction = f"""
## Part {chunk_num} of {total_chunks} - CONCLUSION
This is the FINAL part of the episode. You MUST:
- Start with "Welcome back" or "And we're back" to continue naturally
- Continue from where we left off
- Discuss any remaining insights and concepts (that haven't been covered yet!)
- Provide a thorough conclusion summarizing key takeaways
- End with a compelling call-to-action for listeners
- Write approximately {words_per_chunk} words
{topics_section}
PREVIOUS CONTEXT (continue from here):
{previous_summary}
"""
        else:
            position_instruction = f"""
## Part {chunk_num} of {total_chunks} - CONTINUATION
This is a MIDDLE section of the episode. You MUST:
- Start with "Welcome back" or "And we're back" to continue naturally
- Continue from where we left off
- Dive deeper into NEW concepts from the book (not ones already covered!)
- Add examples, analysis, and personal insights
- Write approximately {words_per_chunk} words
- End with a transition like "We'll continue after the break" or "We'll be right back" - NOT "see you next time"
- Do NOT conclude - the episode continues after this
{topics_section}
PREVIOUS CONTEXT (continue from here):
{previous_summary}
"""

        # Format instructions based on episode type
        if episode_type == "MONOLOGUE":
            format_instruction = """Write as a single host speaking directly to the audience. No speaker labels needed."""
            format_example = ""
        elif episode_type == "DUO":
            format_instruction = """Write as a conversation between two speakers. EVERY line of dialogue MUST start with either "HOST:" or "GUEST:" on its own line."""
            format_example = """
Example format (FOLLOW THIS EXACTLY):
HOST: Welcome to the show! Today we're diving into something fascinating.

GUEST: I'm so excited to discuss this with you. This topic is incredibly relevant.

HOST: Absolutely. Let me start by explaining the first key concept here.

GUEST: That's a great point. I'd add that..."""
        else:  # GROUP
            format_instruction = """Write as a group discussion. EVERY line of dialogue MUST start with "HOST:", "GUEST1:", or "GUEST2:" on its own line."""
            format_example = """
Example format (FOLLOW THIS EXACTLY):
HOST: Welcome everyone! We have two great guests today.

GUEST1: Thanks for having us!

GUEST2: Yes, excited to be here and discuss this topic.

HOST: Let's dive right in..."""

        prompt = f"""You are {podcaster_name}, creating part {chunk_num} of a {total_chunks}-part podcast episode about "{book_title}"{author_line}.

## Your Personality
{personality_desc}

{position_instruction}

## CRITICAL FORMAT REQUIREMENTS
{format_instruction}
{format_example}

## Source Content (THIS IS THE ONLY CONTENT YOU CAN REFERENCE!)
{book_content}

## STRICT CONTENT BOUNDARIES - READ CAREFULLY!
You are discussing ONLY the content shown above. You must:
- **NEVER mention any law numbers, chapter titles, or concepts NOT explicitly written in the Source Content**
- **NEVER reference "Law 2", "Law 3", or ANY other laws if they're not in the text above**
- **NEVER say things like "as we'll see in later laws" or "building on other laws"**
- **If you know this book, COMPLETELY IGNORE that knowledge - pretend you've never read it**

When you need to EXPAND and add depth, use ONLY these techniques:
1. **General real-world examples** - from history, business, politics, sports, relationships (NOT from this book)
2. **Personal anecdotes** - hypothetical stories about "someone you know" or "imagine if..."
3. **Deeper analysis** - ask "why does this work?" and "what are the psychological principles?"
4. **Practical applications** - "how would you apply this at work?" or "in your personal life?"
5. **Counterarguments** - "but some might say..." and then respond to objections
6. **Repeat and rephrase** key concepts from the source in different ways

## Critical Requirements
- Write EXACTLY around {words_per_chunk} words (this is important!)
- {"EVERY line must start with HOST: or GUEST: - NO EXCEPTIONS!" if episode_type == "DUO" else ""}
- {"EVERY line must start with HOST:, GUEST1:, or GUEST2: - NO EXCEPTIONS!" if episode_type == "GROUP" else ""}
- Use natural speech patterns with pauses and reactions

## TTS TAGS - ONLY USE THESE OFFICIAL TAGS
- [sigh], [laughing], [chuckling], [clearing throat], [uhm], [uh]
- [short pause], [medium pause], [long pause]
- [whispering]
**DO NOT use [nodding], [smiling], [thoughtful], [leaning in], [gesturing], [excited], or any visual/physical actions!**

Now write Part {chunk_num}:
"""
        return prompt

    def _combine_chunks(self, chunks: List[str], episode_type: str) -> str:
        """Combine multiple script chunks into a cohesive script."""
        if not chunks:
            return ""

        # For monologues, just join with paragraph breaks
        if episode_type == "MONOLOGUE":
            return "\n\n".join(chunks)

        # For dialogues, need to ensure proper speaker label continuity
        combined = []
        for i, chunk in enumerate(chunks):
            if i > 0:
                # Add a transition marker between chunks
                combined.append("\n")
            combined.append(chunk)

        return "\n".join(combined)

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
    ) -> str:
        """Generate script using LLM."""
        retry_info = f" (RETRY #{retry_count} with enhanced prompt)" if retry_count > 0 else ""
        logger.info(f"Generating script with LLM for: {episode_title}{retry_info}")

        # Use chunked generation for long scripts (gpt-4o-mini can't reliably generate >1500 words)
        if self._needs_chunked_generation(target_words):
            logger.info(f"Target {target_words} words exceeds threshold, using chunked generation")
            script = self._generate_chunked(
                book_content=book_content,
                book_title=book_title,
                book_author=book_author,
                episode_title=episode_title,
                podcaster_name=podcaster_name,
                personality=personality,
                episode_type=episode_type,
                episode_theme=episode_theme,
                target_words=target_words,
                expansion_ratio=expansion_ratio,
                content_scope=content_scope,
            )
            logger.info(f"Chunked generation produced {len(script.split())} words")
            return script

        # Single-call generation for shorter scripts
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
        )

        # Request more words on retries (increasingly aggressive)
        if retry_count >= 2:
            request_words = int(target_words * 1.5)  # 50% more on second retry
        elif retry_count == 1:
            request_words = int(target_words * 1.3)  # 30% more on first retry
        else:
            request_words = target_words

        prompt = self.prompt_builder.build_prompt(request)
        script = self.llm_client.generate_script(prompt, request_words)

        # Clean up the script
        script = self._clean_script(script, episode_type)

        logger.info(f"LLM generated {len(script.split())} words (retry_count={retry_count})")
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

    def _extract_topics_from_chunk(self, chunk_script: str) -> List[str]:
        """Extract key topics, concepts, AND examples discussed in a chunk to avoid repetition.

        Uses heuristics to identify main discussion points and the examples/scenarios used.
        Returns strings that describe both what was covered and how it was illustrated.
        """
        import re

        topics = []

        # Look for patterns that indicate topic discussion
        topic_patterns = [
            r"let's (?:talk about|discuss|explore|dive into) ([^.!?]+)",
            r"the (?:key|main|first|second|third|next) (?:concept|idea|point|principle|lesson) (?:is|here is) ([^.!?]+)",
            r"this (?:is|shows|demonstrates|illustrates) ([^.!?]+)",
            r"what (?:we're|we are) seeing here is ([^.!?]+)",
            r"the (?:idea|concept|principle) of ([^.!?]+)",
        ]

        text_lower = chunk_script.lower()
        for pattern in topic_patterns:
            matches = re.findall(pattern, text_lower)
            for match in matches:
                # Clean up the match
                topic = match.strip()[:100]  # Limit length
                if len(topic) > 10:  # Only meaningful topics
                    topics.append(f"Topic: {topic}")

        # Extract EXAMPLES and SCENARIOS used (these should NOT be repeated)
        example_patterns = [
            # "For example, ..." / "For instance, ..."
            r"for (?:example|instance),?\s+([^.!?]{20,150})",
            # "Take X for example" / "Consider X"
            r"(?:take|consider|look at|think about)\s+([^.!?]{10,100})\s+(?:for example|as an example)?",
            # "Like when..." / "Like if..."
            r"like (?:when|if|how)\s+([^.!?]{20,150})",
            # "Imagine..." / "Picture..."
            r"(?:imagine|picture|suppose|say)\s+([^.!?]{20,150})",
            # "A good example is..." / "One example would be..."
            r"(?:a|one|another|the best) (?:good |great |perfect |classic )?example (?:is|would be|here is)\s+([^.!?]{20,150})",
            # "Think of it like..." / "It's like..."
            r"(?:think of it like|it's like|it's similar to)\s+([^.!?]{20,150})",
            # "In the story..." / "The author describes..."
            r"(?:in the story|the author (?:describes|talks about|mentions)|the book (?:describes|talks about))\s+([^.!?]{20,150})",
        ]

        for pattern in example_patterns:
            matches = re.findall(pattern, text_lower)
            for match in matches:
                example = match.strip()[:120]
                if len(example) > 15:  # Only meaningful examples
                    topics.append(f"Example used: {example}")

        # Extract any quoted concepts or emphasized phrases
        quoted = re.findall(r'"([^"]{10,50})"', chunk_script)
        for q in quoted[:3]:
            topics.append(f"Quote/concept: {q}")

        # Extract named people, companies, or case studies mentioned
        # Look for capitalized proper nouns that might be case studies
        proper_nouns = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', chunk_script)
        # Filter out common words and keep unique ones
        common_words = {'The', 'This', 'That', 'What', 'When', 'Where', 'How', 'Why', 'Who',
                        'And', 'But', 'Or', 'So', 'Well', 'Now', 'Today', 'Here', 'There',
                        'Chapter', 'Part', 'Section', 'Book', 'Author', 'Host', 'Guest'}
        unique_nouns = set()
        for noun in proper_nouns:
            if noun not in common_words and len(noun) > 3:
                unique_nouns.add(noun)
        for noun in list(unique_nouns)[:3]:
            topics.append(f"Referenced: {noun}")

        # Deduplicate and limit
        seen = set()
        unique_topics = []
        for topic in topics:
            topic_key = topic.lower().strip()
            if topic_key not in seen:
                seen.add(topic_key)
                unique_topics.append(topic)

        return unique_topics[:10]  # Return top 10 items (topics + examples)

    def _clean_script(self, script: str, episode_type: str) -> str:
        """Clean and format the generated script."""
        import re

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

        # Remove unofficial TTS tags that can't be synthesized
        # Keep only: [sigh], [laughing], [chuckling], [clearing throat], [uhm], [uh],
        #            [short pause], [medium pause], [long pause], [whispering]
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
            r'\[pausing\]',  # Use [short/medium/long pause] instead
            r'\[grinning\]', r'\[grins\]',
            r'\[frowning\]', r'\[frowns\]',
            r'\[winking\]', r'\[winks\]',
            r'\[excited\]',  # Not an official Gemini TTS tag
        ]
        for tag in unofficial_tags:
            script = re.sub(tag, '', script, flags=re.IGNORECASE)

        # Clean up any double spaces left behind
        script = re.sub(r'  +', ' ', script)

        return script.strip()
