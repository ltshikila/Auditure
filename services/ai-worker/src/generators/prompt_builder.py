"""Prompt builder for script generation.

Generates prompts for LLM-based podcast script generation with support
for Gemini TTS markup tags for natural speech synthesis.

Gemini TTS Markup Tags (included in generated scripts):
- Non-speech sounds: [sigh], [laughing], [uhm]
- Pacing control: [short pause], [medium pause], [long pause]
- Style modifiers: [whispering], [excited]

Reference: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#prompting_tips
Reference: https://ai.google.dev/gemini-api/docs/speech-generation#prompting-guide
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class PodcasterPersonality:
    """Podcaster personality configuration."""

    tone: int  # 1-10
    communication_style: int  # 1-10
    humor_level: int  # 1-10
    conversational_depth: int  # 1-10
    chaos_factor: int  # 1-10
    intellectual_angle: Optional[str] = None
    expertise_tags: Optional[List[str]] = None


@dataclass
class ScriptRequest:
    """Request for script generation."""

    book_content: str
    book_title: str
    book_author: Optional[str]
    episode_title: str
    podcaster_name: str
    podcaster_personality: PodcasterPersonality
    episode_type: str  # MONOLOGUE, DUO, GROUP
    episode_theme: str  # LECTURE, DISCUSSION, DEBATE
    target_length_min: int  # minutes
    target_length_max: int  # minutes


class PromptBuilder:
    """Build prompts for LLM script generation."""

    # Personality trait mappings
    TONE_MAP = {
        (1, 3): "calm, measured, and thoughtful",
        (4, 6): "balanced and conversational",
        (7, 10): "energetic, enthusiastic, and dynamic",
    }

    COMMUNICATION_MAP = {
        (1, 3): "storytelling and narrative-focused",
        (4, 6): "balanced between stories and analysis",
        (7, 10): "analytical and fact-driven",
    }

    HUMOR_MAP = {
        (1, 3): "serious and professional",
        (4, 6): "occasional light humor",
        (7, 10): "comedic and entertaining",
    }

    DEPTH_MAP = {
        (1, 3): "accessible and surface-level",
        (4, 6): "moderately detailed",
        (7, 10): "deep philosophical exploration",
    }

    CHAOS_MAP = {
        (1, 3): "structured and organized",
        (4, 6): "semi-structured with tangents",
        (7, 10): "spontaneous and free-flowing",
    }

    def _get_trait_description(
        self,
        value: int,
        trait_map: Dict[tuple, str],
    ) -> str:
        """Get description for a trait value."""
        for (low, high), description in trait_map.items():
            if low <= value <= high:
                return description
        return list(trait_map.values())[1]  # Default to middle

    def build_personality_description(
        self,
        personality: PodcasterPersonality,
    ) -> str:
        """Build personality description from traits."""
        descriptions = []

        descriptions.append(
            f"Speaking style: {self._get_trait_description(personality.tone, self.TONE_MAP)}"
        )
        descriptions.append(
            f"Communication approach: {self._get_trait_description(personality.communication_style, self.COMMUNICATION_MAP)}"
        )
        descriptions.append(
            f"Humor: {self._get_trait_description(personality.humor_level, self.HUMOR_MAP)}"
        )
        descriptions.append(
            f"Depth: {self._get_trait_description(personality.conversational_depth, self.DEPTH_MAP)}"
        )
        descriptions.append(
            f"Flow: {self._get_trait_description(personality.chaos_factor, self.CHAOS_MAP)}"
        )

        if personality.intellectual_angle:
            descriptions.append(f"Intellectual lens: {personality.intellectual_angle}")

        if personality.expertise_tags:
            descriptions.append(f"Areas of expertise: {', '.join(personality.expertise_tags)}")

        return "\n".join(f"- {d}" for d in descriptions)

    def build_episode_type_instructions(self, episode_type: str) -> str:
        """Get instructions based on episode type.

        Includes Gemini TTS markup guidance for natural speech synthesis.
        Reference: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#prompting_tips
        """
        tts_markup_guide = """
## TTS Markup Tags (USE THESE for natural speech)
Include these markup tags naturally throughout the script:
- [short pause] - Brief pause like a comma (~250ms)
- [medium pause] - Sentence break pause (~500ms)
- [long pause] - Dramatic pause for emphasis (~1s)
- [sigh] - Express frustration, relief, or contemplation
- [laughing] or [chuckle] - Natural laughter reactions
- [uhm] or [uh] - Thinking hesitation for naturalness
- [excited] - When sharing surprising or exciting information

Example usage:
"So I was reading this book [short pause] and honestly [sigh] it completely changed how I think about productivity."
"Wait, really? [laughing] That's exactly what happened to me!"
"[uhm] Let me think about that for a second [medium pause] yeah, I think you're right."
"""

        if episode_type == "MONOLOGUE":
            return f"""
Format: Single host speaking directly to the audience.
Structure: No speaker labels needed - write as continuous prose.
Style: First person, intimate, as if speaking to a close friend.
{tts_markup_guide}"""

        elif episode_type == "DUO":
            return f"""
Format: Two-person conversation between HOST and GUEST.
Structure: Use speaker labels like "HOST:" and "GUEST:" for each speaking turn.
Style: Natural dialogue with back-and-forth exchange. The guest can challenge or add perspectives.
Include natural reactions like agreement sounds, laughter, and thoughtful pauses.
{tts_markup_guide}"""

        else:  # GROUP
            return f"""
Format: Group discussion with HOST, GUEST1, and GUEST2 (optionally GUEST3).
Structure: Use speaker labels like "HOST:", "GUEST1:", "GUEST2:" for each turn.
Style: Dynamic conversation with multiple viewpoints. Allow for interruptions and building on ideas.
Include reactions, agreements, and natural conversational sounds.
{tts_markup_guide}"""

    def build_theme_instructions(self, episode_theme: str) -> str:
        """Get instructions based on episode theme."""
        if episode_theme == "LECTURE":
            return """
Tone: Educational and informative. Present information clearly with examples.
Goal: Teach the audience about the book's key concepts and insights."""

        elif episode_theme == "DISCUSSION":
            return """
Tone: Exploratory and collaborative. Share thoughts and reactions organically.
Goal: Have a genuine conversation about the book's themes and impact."""

        else:  # DEBATE
            return """
Tone: Argumentative (friendly). Present different perspectives and challenge ideas.
Goal: Explore the book through contrasting viewpoints and critical analysis."""

    def calculate_target_words(
        self,
        target_length_min: int,
        target_length_max: int,
        words_per_minute: int = 150,
    ) -> int:
        """Calculate target word count from time range."""
        avg_minutes = (target_length_min + target_length_max) / 2
        return int(avg_minutes * words_per_minute)

    def build_prompt(self, request: ScriptRequest) -> str:
        """
        Build complete prompt for script generation.

        Args:
            request: Script generation request

        Returns:
            Complete prompt string
        """
        personality_desc = self.build_personality_description(request.podcaster_personality)
        type_instructions = self.build_episode_type_instructions(request.episode_type)
        theme_instructions = self.build_theme_instructions(request.episode_theme)
        target_words = self.calculate_target_words(
            request.target_length_min,
            request.target_length_max,
        )

        author_line = f" by {request.book_author}" if request.book_author else ""

        prompt = f"""You are {request.podcaster_name}, a podcast host creating an episode about "{request.book_title}"{author_line}.

## Your Personality
{personality_desc}

## Episode Format
{type_instructions}

## Episode Theme
{theme_instructions}

## Requirements
- **CRITICAL: MINIMUM LENGTH**: The script MUST be at least {target_words} words. This is approximately {request.target_length_min}-{request.target_length_max} minutes when spoken at 150 words per minute.
- DO NOT write a short script. Episodes under {request.target_length_min} minutes are unacceptable and will be rejected.
- Include an engaging introduction that hooks the listener (at least 100 words)
- Cover ALL the key ideas from the book content provided - discuss each point in depth with examples and commentary
- Add extensive personal insights, analysis, and real-world applications for each concept
- Include transitions between topics that add value, not just "next, let's talk about..."
- End with a thorough conclusion that summarizes key points and provides a call to action (at least 100 words)
- When in doubt, add MORE detail, MORE examples, and MORE commentary - longer is better than shorter

## Book Content to Discuss
{request.book_content}

## Episode Title
"{request.episode_title}"

Now write the complete podcast script:
"""
        return prompt
