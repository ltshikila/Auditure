"""Script generation orchestrator."""

import logging
import re
from dataclasses import dataclass
from typing import Optional

from src.config import get_settings

from .llm_client import LLMAPIError, OpenAIClient
from .prompt_builder import (
    CoHostArchetype,
    DebateConfig,
    PodcasterPersonality,
    PromptBuilder,
    ScriptRequest,
)
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


class BookContentUnavailableError(Exception):
    """Raised when the requested book content cannot be found for generation.

    Non-retryable: extraction quality is a data-state issue, retrying the
    script generation won't create missing chapters.
    """


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
        self.llm_client = OpenAIClient()
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
        editor_notes: Optional[str] = None,
    ) -> ScriptResult:
        """
        Generate a podcast script.

        First attempts LLM generation, falls back to templates on failure.

        editor_notes: optional free-text user steering for what to focus on / how the
        episode should go. Injected as high-priority direction into the prompt so a
        single dense chapter can be narrowed to the part the user actually cares about.
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
            sentence_structure=podcaster_personality.get("sentence_structure", 5),
            emotional_expression=podcaster_personality.get("emotional_expression", 5),
            viewpoint_behavior=podcaster_personality.get("viewpoint_behavior", 5),
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
                    editor_notes=editor_notes,
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
                        editor_notes=editor_notes,
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

        # Repetition gate: if a finalized LLM script loops, run one targeted rewrite pass.
        # Template scripts are deterministic and skipped.
        if script is not None and method and method.startswith("llm"):
            score = self._repetition_score(self._normalize_for_scoring(script))
            if self._is_repetitive(score):
                logger.warning(
                    f"Repetition gate tripped (redundant_ratio={score['ratio']:.3f}, "
                    f"top_phrase=\"{score['top_phrase']}\" x{score['max_phrase_count']}); "
                    "running dedup pass"
                )
                # Don't let the rewrite shrink the episode below ~0.7x the requested minimum.
                min_words = int(target_length_min * wpm * 0.7)
                script = self._reduce_repetition(
                    script,
                    episode_type=episode_type,
                    min_words=min_words,
                    top_phrase=score["top_phrase"],
                )

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
        """Convert podcaster speaking speed (1-10) to words per minute.

        Gemini TTS voices each have their own natural speaking rate — faster
        voices (higher speed rating) produce more words per minute of audio.
        The speaking_speed slider selects which voice is used, which in turn
        determines the actual WPM.

        Production data (measured from real episodes):
          Speed 4-5 voices (Charon, Kore, Despina): ~163-179 wpm, avg 173
          Speed 6 voices (Achird): ~168-172 wpm, avg 170
          Speed 7+ voices (Puck, Fenrir): estimated ~185-200 wpm
          Overall average: 173 wpm

        Model: base 155 wpm + 5 wpm per speed point above 1.
        """
        if voice_tier == "gemini":
            speed = max(1, min(10, speaking_speed))
            return 155 + (speed - 1) * 5  # Range: 155-200 wpm

        # Google Cloud Standard TTS: speed slider maps to speaking_rate
        speed = max(1, min(10, speaking_speed))
        return 113 + (speed * 7)

    def _calculate_target_words(
        self,
        target_length_min: int,
        target_length_max: int,
        wpm: Optional[int] = None,
    ) -> int:
        """Calculate target word count from time range.

        Targets the LOWER BOUND of the duration range. The LLM consistently
        overshoots by 25-30%, so aiming low lands us in the midrange.
        """
        words_per_min = wpm or self.words_per_minute
        return int(target_length_min * words_per_min)

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

    def _needs_chunked_generation(self, target_words: int) -> bool:
        """Determine if we need to generate in chunks.

        GPT-4.1-mini reliably generates ~1200-1500 words per call.
        For longer scripts, we need to generate in chunks.
        """
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
        target_length_min: int,
        target_length_max: int,
        target_words: int,
        content_is_limited: bool,
        expansion_ratio: float,
        content_scope: str,
        chapter_title: Optional[str],
        debate_config: Optional[DebateConfig],
        book_genres: Optional[list[str]],
        editor_notes: Optional[str] = None,
    ) -> tuple[str, Optional[CoHostArchetype]]:
        """Generate a long script in multiple chunks and combine them.

        Mini-tier models struggle with generating >1500 words in one call.
        This method splits the generation into chunks, each using the full
        PromptBuilder prompt with chunk-specific position instructions. The
        prompt's stable prefix (persona + book content) is byte-identical
        across chunks so chunks 2+ hit OpenAI prompt caching.
        """
        target_words_per_chunk = 1300
        num_chunks = max(2, (target_words + target_words_per_chunk - 1) // target_words_per_chunk)
        words_per_chunk = target_words // num_chunks

        logger.info(
            f"Using chunked generation: {num_chunks} chunks, ~{words_per_chunk} words each "
            f"(total target: {target_words} words)"
        )

        # Outline-first: assign each chunk a distinct beat so chunks don't re-argue the
        # same thesis. Empty on failure — we then fall back to the legacy topic-ledger.
        segments = self._plan_segments(
            book_content=book_content,
            book_title=book_title,
            content_scope=content_scope,
            episode_theme=episode_theme,
            editor_notes=editor_notes,
            num_chunks=num_chunks,
        )

        chunks = []
        cohost_archetype = None
        previous_summary = ""
        topics_covered: list[str] = []
        words_generated_so_far = 0

        # Fixed budget per chunk — no dynamic rebudgeting.
        # This prevents later chunks from being starved when earlier ones overshoot.
        fixed_chunk_target = words_per_chunk

        for chunk_num in range(1, num_chunks + 1):
            is_final_chunk = chunk_num == num_chunks

            logger.info(
                f"Chunk {chunk_num}/{num_chunks} budget: {fixed_chunk_target} words (fixed)"
            )

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
                expansion_ratio=expansion_ratio,
                content_scope=content_scope,
                chapter_title=chapter_title,
                debate_config=debate_config,
                book_genres=book_genres,
                editor_notes=editor_notes,
                chunk_num=chunk_num,
                total_chunks=num_chunks,
                chunk_target_words=fixed_chunk_target,
                previous_summary=previous_summary if chunk_num > 1 else None,
                topics_covered=topics_covered if chunk_num > 1 else None,
                segment_brief=segments[chunk_num - 1] if segments else None,
                # Reuse chunk 1's archetype so later chunks keep the same co-host
                # AND render an identical prompt prefix (prompt-cache hits).
                cohost_archetype=cohost_archetype,
            )

            logger.info(f"Generating chunk {chunk_num}/{num_chunks}...")
            prompt, chunk_cohost = self.prompt_builder.build_prompt(request)

            # Keep cohost from first chunk (consistent throughout episode)
            if chunk_num == 1:
                cohost_archetype = chunk_cohost

            # Non-final chunks: fixed ceiling based on chunk budget.
            # Final chunk: generous ceiling (3000 tokens) so the conclusion is never truncated.
            token_target = 3000 if is_final_chunk else fixed_chunk_target
            chunk_script = self.llm_client.generate_script(prompt, token_target)
            chunk_script = self._clean_script(chunk_script, episode_type)

            # If a non-final chunk was truncated (hit max_tokens), trim the
            # incomplete last line so TTS never reads a half-sentence.
            if not is_final_chunk and self.llm_client._last_finish_reason == "length":
                chunk_script = self._trim_incomplete_ending(chunk_script)
                logger.info(f"Chunk {chunk_num} was truncated — trimmed incomplete ending")
            chunk_word_count = len(chunk_script.split())
            words_generated_so_far += chunk_word_count

            logger.info(f"Chunk {chunk_num} generated: {chunk_word_count} words (total so far: {words_generated_so_far}/{target_words})")
            chunks.append(chunk_script)

            # Build context for next chunk — pass the full previous chunk
            # so the LLM can match tone, pacing, and conversational flow.
            if chunk_num < num_chunks:
                previous_summary = chunk_script

                new_topics = self._extract_topics_from_chunk(chunk_script)
                topics_covered.extend(new_topics)
                logger.info(f"Topics covered so far: {topics_covered}")

        combined_script = self._combine_chunks(chunks, episode_type)
        total_words = len(combined_script.split())
        logger.info(f"Combined script: {total_words} words from {num_chunks} chunks")

        return combined_script, cohost_archetype

    def _plan_segments(
        self,
        *,
        book_content: str,
        book_title: str,
        content_scope: str,
        episode_theme: str,
        editor_notes: Optional[str],
        num_chunks: int,
    ) -> list[str]:
        """Outline-first planning: split the episode's focus into num_chunks DISTINCT beats.

        Chunked generation used to divide the script by word budget only, handing every
        chunk the same scope + full arc, so chunks re-argued the same thesis. This makes
        one upfront LLM call to partition the focus into a different beat per chunk.

        Returns a list of segment briefs with len == num_chunks, or [] on any failure
        (caller falls back to the legacy topic-ledger, so this never blocks generation).
        """
        if not self.llm_client.is_available:
            return []

        if editor_notes and editor_notes.strip():
            focus_line = (
                "The editor's steering is the HIGHEST priority — every segment MUST stay "
                f'within this focus:\n"{editor_notes.strip()}"\n\n'
            )
        else:
            focus_line = ""

        theme_hint = {
            "DEBATE": "Each segment should advance the debate to a DIFFERENT point of contention or line of evidence — not the same argument re-stated.",
            "DISCUSSION": "Each segment should explore a DIFFERENT facet, tension, or question — not circle the same observation.",
            "LECTURE": "Each segment should teach a DIFFERENT concept or stage of the material — not re-explain the same idea.",
        }.get(episode_theme, "Each segment should cover different ground.")

        # A sample is enough to plan beats; keep the planning call cheap on long sources.
        sample = book_content.strip()
        if len(sample) > 10000:
            sample = sample[:7000] + "\n...\n" + sample[-3000:]

        prompt = f"""You are planning a {num_chunks}-part podcast episode about "{book_title}" covering {content_scope}.

{focus_line}Divide the episode into EXACTLY {num_chunks} sequential segments. Each segment must cover a DISTINCT beat, scene, sub-argument, or sub-topic. NO two segments may make the same point, re-argue the same thesis, or reuse the same key scene. Together they should form ONE continuous arc from open to close. {theme_hint}

Return EXACTLY {num_chunks} lines, numbered 1 to {num_chunks}. Each line is a specific, concrete brief (1-2 sentences) naming what THAT segment covers and the fresh material or events it draws on. Output ONLY the numbered lines, nothing else.

SOURCE CONTENT (only use what is here; never invent material):
{sample}
"""
        try:
            raw = self.llm_client.generate_text(prompt, max_tokens=700, temperature=0.5)
            segments = self._parse_segment_plan(raw, num_chunks)
        except Exception as e:
            logger.warning(f"Segment planning failed, falling back to topic-ledger: {e}")
            return []
        if len(segments) != num_chunks:
            logger.warning(
                f"Segment plan yielded {len(segments)} beats for {num_chunks} chunks; "
                "falling back to topic-ledger"
            )
            return []

        logger.info(f"Segment plan ({num_chunks} beats): {segments}")
        return segments

    def _parse_segment_plan(self, raw: str, num_chunks: int) -> list[str]:
        """Parse numbered segment briefs from the planner response."""
        segments = []
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            match = re.match(r"^(?:segment\s*)?#?\d+\s*[.):\-]\s*(.+)$", line, re.IGNORECASE)
            if match:
                brief = match.group(1).strip()
                if len(brief) >= 10:
                    segments.append(brief)
        return segments[:num_chunks]

    def _extract_topics_from_chunk(self, chunk_script: str) -> list[str]:
        """Extract key topics, concepts, and examples from a chunk to avoid repetition."""
        topics = []

        # Topic discussion patterns
        topic_patterns = [
            r"let's (?:talk about|discuss|explore|dive into) ([^.!?]+)",
            r"the (?:key|main|first|second|third|next) (?:concept|idea|point|principle|lesson) (?:is|here is) ([^.!?]+)",
            r"this (?:is|shows|demonstrates|illustrates) ([^.!?]+)",
            r"the (?:idea|concept|principle) of ([^.!?]+)",
        ]

        text_lower = chunk_script.lower()
        for pattern in topic_patterns:
            matches = re.findall(pattern, text_lower)
            for match in matches:
                topic = match.strip()[:100]
                if len(topic) > 10:
                    topics.append(f"Topic: {topic}")

        # Example/scenario patterns
        example_patterns = [
            r"for (?:example|instance),?\s+([^.!?]{20,150})",
            r"(?:imagine|picture|suppose|say)\s+([^.!?]{20,150})",
            r"(?:a|one|another) (?:good |great |perfect |classic )?example (?:is|would be)\s+([^.!?]{20,150})",
            r"(?:think of it like|it's like|it's similar to)\s+([^.!?]{20,150})",
        ]

        for pattern in example_patterns:
            matches = re.findall(pattern, text_lower)
            for match in matches:
                example = match.strip()[:120]
                if len(example) > 15:
                    topics.append(f"Example used: {example}")

        # Quoted concepts
        quoted = re.findall(r'"([^"]{10,50})"', chunk_script)
        for q in quoted[:3]:
            topics.append(f"Quote/concept: {q}")

        # Named proper nouns (case studies, people, companies)
        proper_nouns = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', chunk_script)
        common_words = {
            'The', 'This', 'That', 'What', 'When', 'Where', 'How', 'Why', 'Who',
            'And', 'But', 'Or', 'So', 'Well', 'Now', 'Today', 'Here', 'There',
            'Chapter', 'Part', 'Section', 'Book', 'Author', 'Host', 'Guest',
        }
        unique_nouns = set()
        for noun in proper_nouns:
            if noun not in common_words and len(noun) > 3:
                unique_nouns.add(noun)
        for noun in list(unique_nouns)[:3]:
            topics.append(f"Referenced: {noun}")

        # Deduplicate
        seen = set()
        unique_topics = []
        for topic in topics:
            topic_key = topic.lower().strip()
            if topic_key not in seen:
                seen.add(topic_key)
                unique_topics.append(topic)

        return unique_topics[:10]

    def _combine_chunks(self, chunks: list[str], episode_type: str) -> str:
        """Combine multiple script chunks into a cohesive script."""
        if not chunks:
            return ""

        if episode_type == "MONOLOGUE":
            return "\n\n".join(chunks)

        # For dialogues, join with single newline for speaker label continuity
        combined = []
        for i, chunk in enumerate(chunks):
            if i > 0:
                combined.append("\n")
            combined.append(chunk)
        return "\n".join(combined)

    # --- Repetition gate ------------------------------------------------------
    # Objective backstop: even with outline-first chunking, a script can still loop.
    # We measure exact-phrase repetition and, if it's clearly bad, run one targeted
    # rewrite pass. Thresholds calibrated on 6 real prod scripts (2026-07): the
    # known-looping episode scored ratio=0.048 / top phrase x18; the worst healthy
    # script scored ratio=0.011 / x9 (the x9 being the book's era name, natural for
    # a 25-min episode). Thresholds sit in the gap so proper-noun reuse never trips.
    _REP_REDUNDANT_5GRAM_RATIO = 0.03  # fraction of 5-grams that are duplicates
    _REP_MAX_PHRASE_COUNT = 10         # any single 5-gram repeated this many times

    def _normalize_for_scoring(self, script: str) -> str:
        """Strip speaker labels and TTS markup so scoring sees only spoken words."""
        text = re.sub(r"(?im)^\s*(?:HOST|GUEST)\s*:", " ", script)
        text = re.sub(r"\[[^\]]+\]", " ", text)  # remove [sigh], [short pause], etc.
        return text

    def _repetition_score(self, script: str) -> dict:
        """Compute exact-phrase repetition signals over 5-word shingles."""
        words = re.findall(r"[a-z0-9']+", script.lower())
        n = len(words)
        if n < 60:
            return {"ratio": 0.0, "max_phrase_count": 0, "top_phrase": ""}

        grams: dict[str, int] = {}
        for i in range(n - 4):
            gram = " ".join(words[i:i + 5])
            grams[gram] = grams.get(gram, 0) + 1

        total = sum(grams.values())
        distinct = len(grams)
        redundant_ratio = 1 - (distinct / total) if total else 0.0
        top_phrase, max_count = max(grams.items(), key=lambda kv: kv[1])
        return {
            "ratio": redundant_ratio,
            "max_phrase_count": max_count,
            "top_phrase": top_phrase,
        }

    def _is_repetitive(self, score: dict) -> bool:
        return (
            score["ratio"] >= self._REP_REDUNDANT_5GRAM_RATIO
            or score["max_phrase_count"] >= self._REP_MAX_PHRASE_COUNT
        )

    def _reduce_repetition(
        self,
        script: str,
        *,
        episode_type: str,
        min_words: int,
        top_phrase: str,
    ) -> str:
        """One editing pass to de-loop a repetitive script.

        Returns the rewrite only if it is a genuine improvement AND still long enough;
        otherwise returns the original untouched (the gate must never make things worse).
        """
        if not self.llm_client.is_available:
            return script

        label_rule = (
            "Keep every 'HOST:' and 'GUEST:' speaker label exactly as-is."
            if episode_type == "DUO"
            else "This is a single-speaker script — do not add speaker labels."
        )
        prompt = f"""The following podcast script is too repetitive — it restates the same points, phrases, and images instead of moving forward. Rewrite it so it does not repeat itself.

RULES:
- Preserve the overall length (stay within ~10% of the original word count). Where you cut a repeated point, replace it with a DIFFERENT concrete detail or beat that is already supported by the script — do NOT pad with filler and do NOT invent new facts.
- Every paragraph/turn must advance the episode. Do not reuse a phrase, argument, or image that already appeared.
- Keep the same speakers, tone, structure, and all TTS markup tags (e.g. [sigh], [short pause]). {label_rule}
- Keep the opening hook and the closing goodbye intact.
- The single most over-used phrase was: "{top_phrase}". It must appear at most twice in the whole script.

Return ONLY the rewritten script, nothing else.

SCRIPT:
{script}
"""
        try:
            target_tokens = int(len(script.split()) * 1.8) + 200
            revised = self.llm_client.generate_text(
                prompt,
                max_tokens=min(target_tokens, self.llm_client.max_tokens),
                temperature=0.6,
            )
        except Exception as e:
            logger.warning(f"Repetition-reduction pass failed, keeping original: {e}")
            return script

        revised = self._clean_script(revised, episode_type)
        revised_words = len(revised.split())
        if revised_words < min_words:
            logger.info(
                f"Dedup pass dropped below floor ({revised_words} < {min_words} words); "
                "keeping original"
            )
            return script

        before = self._repetition_score(self._normalize_for_scoring(script))
        after = self._repetition_score(self._normalize_for_scoring(revised))
        if (
            after["ratio"] >= before["ratio"]
            and after["max_phrase_count"] >= before["max_phrase_count"]
        ):
            logger.info("Dedup pass did not reduce repetition; keeping original")
            return script

        logger.info(
            f"Dedup pass applied: redundant_ratio {before['ratio']:.3f}->{after['ratio']:.3f}, "
            f"max_phrase {before['max_phrase_count']}->{after['max_phrase_count']}, "
            f"words {len(script.split())}->{revised_words}"
        )
        return revised

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
        editor_notes: Optional[str] = None,
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

        # Use chunked generation for long scripts
        if self._needs_chunked_generation(target_words):
            logger.info(f"Target {target_words} words exceeds threshold, using chunked generation")
            return self._generate_chunked(
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
                expansion_ratio=expansion_ratio,
                content_scope=content_scope,
                chapter_title=chapter_title,
                debate_config=debate_config,
                book_genres=book_genres,
                editor_notes=editor_notes,
            )

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
            debate_config=debate_config,
            book_genres=book_genres,
            editor_notes=editor_notes,
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

    def _trim_incomplete_ending(self, script: str) -> str:
        """Trim incomplete last line from a truncated script.

        When the LLM hits max_tokens mid-sentence, the last line ends without
        punctuation. We walk backwards and drop lines until we find one that
        ends with sentence-ending punctuation so TTS never reads a half-sentence.

        Safety: never remove more than 5 lines to avoid wiping the entire chunk.
        """
        lines = script.rstrip().split('\n')
        max_trim = min(5, len(lines) - 1)  # Always keep at least 1 line
        trimmed = 0
        while trimmed < max_trim:
            last = lines[-1].rstrip()
            if last and last[-1] in '.!?"\'…':
                break
            lines.pop()
            trimmed += 1
        return '\n'.join(lines)

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
        # LLMs often wrap labels in markdown: **HOST:**, **Host:**
        # This strips markdown and normalizes case so the parser and TTS client
        # can reliably find HOST:/GUEST: at the start of lines.
        if episode_type == "DUO":
            # Strip markdown bold/italic around speaker labels
            # Handles: **HOST:**, **HOST**:, *Host:*, ***GUEST:***, etc.
            script = re.sub(
                r'^\*{1,3}(HOST\d?|GUEST\d?|SPEAKER\d?|NARRATOR)\*{0,3}:\*{0,3}\s*',
                lambda m: m.group(1).upper() + ': ',
                script,
                flags=re.IGNORECASE | re.MULTILINE,
            )
            # Handle colon outside bold: **HOST**: text
            script = re.sub(
                r'^\*{1,3}(HOST\d?|GUEST\d?|SPEAKER\d?|NARRATOR)\*{1,3}:\s*',
                lambda m: m.group(1).upper() + ': ',
                script,
                flags=re.IGNORECASE | re.MULTILINE,
            )
            # Normalize remaining case variants without markdown (Host: → HOST:)
            script = re.sub(
                r'^(host\d?|guest\d?|speaker\d?|narrator):\s*',
                lambda m: m.group(1).upper() + ': ',
                script,
                flags=re.IGNORECASE | re.MULTILINE,
            )

        # Strip ALL bracket tags EXCEPT verified safe Gemini TTS tags.
        # LLMs generate arbitrary tags like [calmly but firmly], [intrigued],
        # [thoughtfully] — these get spoken aloud by TTS, ruining the audio.
        # Allowlist approach: keep only verified safe tags, strip everything else.
        safe_tags = {
            # Mode 1 — Non-speech sounds (acted out, not spoken)
            'sigh', 'laughing', 'uhm', 'uh', 'chuckling', 'clearing throat',
            # Mode 2 — Style modifiers (affect delivery, not vocalized)
            'sarcasm', 'whispering', 'shouting', 'extremely fast', 'robotic',
            # Mode 4 — Pacing/pauses (control rhythm)
            'short pause', 'medium pause', 'long pause',
        }

        def _replace_tag(match):
            tag_content = match.group(1).strip().lower()
            if tag_content in safe_tags:
                return match.group(0)  # Keep safe tag
            return ''  # Strip unsafe tag

        script = re.sub(r'\[([^\]]+)\]', _replace_tag, script)

        # Whisper guard. [whispering] is meant for a short, well-timed phrase, but
        # the model tends to whisper whole sentences or the entire conclusion,
        # which reads as theatrical. Enforce what the prompt asks for but can't
        # guarantee: keep a whisper ONLY if it wraps a short span (<= MAX words up
        # to the next sentence end), and keep AT MOST ONE per script. Stripping a
        # tag only removes the whisper delivery — the words are still spoken.
        script = self._enforce_whisper_limits(script)

        # Clean up double spaces left behind
        script = re.sub(r'  +', ' ', script)

        return script.strip()

    # Max words a [whispering] tag may cover before we strip it as a "long whisper".
    _WHISPER_MAX_SPAN_WORDS = 8

    def _enforce_whisper_limits(self, script: str) -> str:
        """Strip long whispers; keep at most one short whisper per script.

        A [whispering] tag styles the text after it up to the next sentence
        terminator (. ! ?), newline, or next bracket tag. If that span is longer
        than _WHISPER_MAX_SPAN_WORDS, the whisper is dropped (words kept). Of the
        whispers that remain short enough, only the first is kept.
        """
        kept = 0
        out = []
        pos = 0
        for match in re.finditer(r'\[whispering\]', script, flags=re.IGNORECASE):
            out.append(script[pos:match.start()])
            after = script[match.end():]
            # Span the whisper covers: until sentence end, newline, or next tag.
            span = re.split(r'[.!?\n]|\[', after, maxsplit=1)[0]
            span_words = len(span.split())
            if kept == 0 and span_words <= self._WHISPER_MAX_SPAN_WORDS:
                out.append(match.group(0))  # keep this one short whisper
                kept += 1
            # else: drop the tag (fall through), leaving the spoken words intact
            pos = match.end()
        out.append(script[pos:])
        cleaned = ''.join(out)
        dropped = script.lower().count('[whispering]') - kept
        if dropped > 0:
            logger.info(f"[CLEAN] Whisper guard: kept {kept}, stripped {dropped} whisper tag(s)")
        return cleaned
