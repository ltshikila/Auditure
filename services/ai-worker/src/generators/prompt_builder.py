"""Prompt builder for script generation.

Generates prompts for LLM-based podcast script generation with support
for Gemini TTS markup tags for natural speech synthesis.

OFFICIAL Gemini TTS Markup Tags (ONLY use these - others will be spoken aloud!):

Mode 1 - Non-Speech Sounds (acted out, not spoken):
- [sigh] - Express frustration, relief, contemplation
- [laughing] - Natural laughter
- [uhm] - Thinking hesitation

Mode 2 - Style Modifiers (modify delivery, not vocalized):
- [whispering] - Decreases volume
- [shouting] - Increases volume
- [sarcasm] - Sarcastic tone
- [extremely fast] - Accelerated speech (good for disclaimers)

Mode 4 - Pacing/Pauses (control rhythm):
- [short pause] - Brief silence (~250ms)
- [medium pause] - Standard sentence break (~500ms)
- [long pause] - Extended dramatic pause (~1000ms+)

IMPORTANT: Do NOT use unofficial tags like [nodding], [thoughtfully], [intrigued],
[chuckle], [excited], [curious], etc. - these will be SPOKEN ALOUD, not acted out!

Reference: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#markup_tag_guide
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
    content_is_limited: bool = False  # True when only partial content provided
    is_retry: bool = False  # True when retrying due to short script
    retry_count: int = 0  # 0 = first attempt, 1 = first retry, 2 = second retry
    expansion_ratio: float = 1.0  # How much to expand content (target_words / source_words)


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
## TTS Markup Tags (OFFICIAL TAGS ONLY - others will be spoken aloud!)
Include ONLY these official markup tags throughout the script:

**Non-Speech Sounds (acted out):**
- [sigh] - Express frustration, relief, or contemplation
- [laughing] - Natural laughter reactions
- [uhm] - Thinking hesitation for naturalness

**Pacing/Pauses:**
- [short pause] - Brief pause (~250ms)
- [medium pause] - Sentence break (~500ms)
- [long pause] - Dramatic pause (~1s)

**Style Modifiers (change delivery):**
- [whispering] - Quiet, intimate delivery
- [sarcasm] - Sarcastic tone

**IMPORTANT:** Do NOT use tags like [nodding], [thoughtfully], [intrigued], [chuckle],
[excited], [curious], [smiling], etc. - these are NOT official and will be SPOKEN ALOUD!
Use descriptive words instead: "That's fascinating" instead of "[intrigued]"

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

    def build_theme_instructions(self, episode_theme: str, chaos_factor: int = 5) -> str:
        """Get instructions based on episode theme and chaos factor.

        Args:
            episode_theme: LECTURE, DISCUSSION, or DEBATE
            chaos_factor: 1-10 scale affecting interruption frequency
        """
        if episode_theme == "LECTURE":
            return """
Tone: Educational and informative. Present information clearly with examples.
Goal: Teach the audience about the book's key concepts and insights."""

        elif episode_theme == "DISCUSSION":
            # Discussions have occasional friendly backchannels
            backchannel_guidance = self._build_backchannel_guidance(chaos_factor, is_debate=False)
            return f"""
Tone: Exploratory and collaborative. Share thoughts and reactions organically.
Goal: Have a genuine conversation about the book's themes and impact.
{backchannel_guidance}"""

        else:  # DEBATE
            # Debates have more interruptions based on chaos factor
            backchannel_guidance = self._build_backchannel_guidance(chaos_factor, is_debate=True)
            return f"""
Tone: Argumentative (friendly). Present different perspectives and challenge ideas.
Goal: Explore the book through contrasting viewpoints and critical analysis.
{backchannel_guidance}"""

    def _build_backchannel_guidance(self, chaos_factor: int, is_debate: bool) -> str:
        """Build guidance for backchannels and interruptions based on chaos factor.

        Args:
            chaos_factor: 1-10 scale (higher = more interruptions)
            is_debate: True for debates (more aggressive), False for discussions (friendly)
        """
        chaos = max(1, min(10, chaos_factor))

        if is_debate:
            # Debates: interruptions scale with chaos factor
            if chaos <= 3:
                frequency = "occasionally (2-3 times)"
                style = "polite interjections"
                examples = '"Actually, I see your point, but—", "Hold on, let me add—", "Mm-hmm, and also—"'
            elif chaos <= 6:
                frequency = "regularly (4-6 times)"
                style = "engaged interruptions and reactions"
                examples = '"Wait, wait—I have to push back on that—", "—yes! Exactly—", "No no no, here\'s the thing—", "Mm-hmm, mm-hmm, but consider—"'
            else:  # chaos 7-10
                frequency = "frequently (7+ times)"
                style = "passionate interruptions and heated exchanges"
                examples = '"—hold on, that\'s not quite right—", "—I completely disagree—", "Right right right, but—!", "See, THIS is where I think—", "[laughing] Oh come on—"'

            return f"""
## Natural Conversation Flow
Make the debate feel ALIVE with {style}. Speakers should {frequency} interject while the other is speaking:
- Use verbal backchannels: "Mm-hmm", "Right", "Exactly", "Interesting..."
- Include interruptions where one speaker cuts in: {examples}
- Show reactions in real-time: "[laughing]", "[sigh]", "Wow", "Hmm..."
- Let speakers build momentum and get passionate about their points
- Don't wait for complete silence—real debates have overlap and energy!"""

        else:
            # Discussions: rare friendly interruptions, more backchannels
            if chaos <= 3:
                return """
## Natural Conversation Flow
Keep the discussion smooth with occasional verbal affirmations:
- Use gentle backchannels sparingly: "Mm-hmm", "Right", "I see"
- Speakers should mostly take turns naturally
- Include thoughtful reactions: "That's interesting...", "I hadn't considered that..."
"""
            elif chaos <= 6:
                return """
## Natural Conversation Flow
Add warmth with friendly verbal cues (3-4 times throughout):
- Use backchannels to show engagement: "Mm-hmm", "Oh interesting!", "Right, right"
- Occasional friendly interjections: "Oh, that reminds me—", "Yes! And building on that—"
- Show genuine reactions: "[laughing]", "Wow", "Hmm, that's a great point"
"""
            else:  # chaos 7-10
                return """
## Natural Conversation Flow
Create an energetic, friendly discussion with frequent engagement (5+ times):
- Active backchannels throughout: "Mm-hmm!", "Oh yeah!", "Totally!", "Exactly!"
- Excited interjections: "—oh wait, I love this part—", "Yes yes yes!", "Ha! So true—"
- Enthusiastic reactions: "[laughing]", "Oh man...", "See, that's what I'm saying!"
- Let the energy build naturally—friends talking excitedly about a book they love
"""

    def calculate_target_words(
        self,
        target_length_min: int,
        target_length_max: int,
        words_per_minute: int = 185,  # Gemini TTS speaks at ~185 wpm
    ) -> int:
        """Calculate target word count from time range.

        Always aims for the MAXIMUM duration - the minimum is the tolerance floor.
        """
        # Always aim for the max - user's min is just the acceptable floor
        return int(target_length_max * words_per_minute)

    def build_deep_dive_instructions(
        self,
        retry_count: int = 0,
        expansion_ratio: float = 1.0,
        target_words: int = 2000,
    ) -> str:
        """Build instructions for deep diving into limited content.

        Args:
            retry_count: 0 = first attempt, 1+ = retries
            expansion_ratio: How much bigger the script needs to be vs source content
            target_words: Exact target word count
        """
        # Calculate how aggressive the instructions need to be
        needs_major_expansion = expansion_ratio >= 2.0  # Need 2x+ the source content

        retry_emphasis = ""
        if retry_count == 1:
            retry_emphasis = """
**WARNING - FIRST ATTEMPT WAS TOO SHORT**
Your previous script was rejected for being too short. This time:
- Write AT LEAST 50% more content
- Add 3+ real-world examples per concept
- Spend more time on analysis and implications
- Include more personal anecdotes and observations
"""
        elif retry_count >= 2:
            retry_emphasis = f"""
**CRITICAL - SECOND RETRY - YOUR SCRIPT MUST BE {target_words}+ WORDS**
This is your FINAL attempt. Previous attempts were rejected for insufficient length.
You MUST write at least {target_words} words. Count your paragraphs:
- A good paragraph is ~100-150 words
- You need approximately {target_words // 120} paragraphs MINIMUM
- If you're unsure, ADD MORE CONTENT

MANDATORY additions:
- 4-5 detailed real-world examples per concept
- Extended personal anecdotes (2-3 paragraphs each)
- Historical context and background information
- Comparisons to other books, theories, or ideas
- Practical applications and step-by-step advice
- Potential objections and counterarguments
- Future implications and predictions
"""

        expansion_guidance = ""
        if needs_major_expansion:
            expansion_guidance = f"""
## CONTENT EXPANSION REQUIRED
The source material is SHORT but you need to create a FULL-LENGTH episode.
Your script must be approximately {int(expansion_ratio)}x longer than the source content.
This means you must ADD SUBSTANTIAL ORIGINAL CONTENT:
- Extended commentary and analysis
- Multiple examples for every point
- Personal stories and experiences
- Historical and cultural context
- Practical applications
- Thought experiments and hypotheticals
"""

        return f"""{retry_emphasis}{expansion_guidance}
## Deep Dive Instructions (CRITICAL - READ CAREFULLY)
Your job is NOT to summarize briefly. You must create a COMPLETE, FULL-LENGTH podcast episode.
EXTENSIVELY DISCUSS every concept presented, spending significant time on each.

For EACH idea or concept in the source material, you MUST include:
1. **Explain the core concept** (3-4 sentences minimum)
2. **Provide context** - Why does this matter? Historical background? (3-4 sentences)
3. **Give real-world examples** - At least 3-4 concrete examples from everyday life, history, business, sports, or current events. DESCRIBE each example in detail (2-3 sentences per example).
4. **Discuss implications** - What happens if you apply this? Short-term and long-term consequences? (4-5 sentences)
5. **Personal analysis** - Share your personal take, experiences, observations, and stories (1-2 paragraphs)
6. **Practical application** - How can listeners use this in their daily lives? Step-by-step if applicable. (3-4 sentences)
7. **Connect to other ideas** - Relate to other concepts, books, philosophies, or common knowledge (2-3 sentences)
8. **Potential objections** - What might critics say? How would you respond? (2-3 sentences)

**REMEMBER: Your audience is listening to LEARN and be ENTERTAINED.**
A rushed, shallow episode is WORSE than a thorough, engaging one.
When in doubt, ADD MORE CONTENT. Longer is always better than shorter.

**Minimum content per concept: 250-400 words of discussion.**
"""

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
        chaos_factor = request.podcaster_personality.chaos_factor
        theme_instructions = self.build_theme_instructions(request.episode_theme, chaos_factor)
        target_words = self.calculate_target_words(
            request.target_length_min,
            request.target_length_max,
        )

        author_line = f" by {request.book_author}" if request.book_author else ""

        # Build deep dive instructions if content is limited or this is a retry
        deep_dive_section = ""
        if request.content_is_limited or request.retry_count > 0 or request.expansion_ratio >= 1.5:
            deep_dive_section = self.build_deep_dive_instructions(
                retry_count=request.retry_count,
                expansion_ratio=request.expansion_ratio,
                target_words=target_words,
            )

        # Adjust target words up for retries (more aggressive with each retry)
        adjusted_target = target_words
        if request.retry_count >= 2:
            adjusted_target = int(target_words * 1.5)  # 50% more on second retry
            logger.info(f"Second retry: increased target from {target_words} to {adjusted_target} words")
        elif request.retry_count == 1:
            adjusted_target = int(target_words * 1.3)  # 30% more on first retry
            logger.info(f"First retry: increased target from {target_words} to {adjusted_target} words")
        elif request.content_is_limited or request.expansion_ratio >= 1.5:
            adjusted_target = int(target_words * 1.15)  # 15% buffer for limited content

        prompt = f"""You are {request.podcaster_name}, a podcast host creating an episode about "{request.book_title}"{author_line}.

## Your Personality
{personality_desc}

## Episode Format
{type_instructions}

## Episode Theme
{theme_instructions}
{deep_dive_section}
## Requirements
- **CRITICAL: MINIMUM LENGTH**: The script MUST be at least {adjusted_target} words. This is approximately {request.target_length_min}-{request.target_length_max} minutes when spoken at ~185 words per minute.
- DO NOT write a short script. Episodes under {request.target_length_min} minutes are unacceptable and will be rejected.
- Include an engaging introduction that hooks the listener (at least 100 words)
- Cover ALL the key ideas from the book content provided - discuss each point in depth with examples and commentary
- Add extensive personal insights, analysis, and real-world applications for each concept
- Include transitions between topics that add value, not just "next, let's talk about..."
- End with a thorough conclusion that summarizes key points and provides a call to action (at least 100 words)
- When in doubt, add MORE detail, MORE examples, and MORE commentary - longer is better than shorter

## Book Content to Discuss (THIS IS THE ONLY CONTENT YOU CAN REFERENCE!)
{request.book_content}

## STRICT CONTENT BOUNDARIES - CRITICAL!
You are discussing ONLY the content shown above. You must:
- **NEVER mention any law numbers, chapter titles, or concepts NOT explicitly written above**
- **NEVER reference other parts of this book that aren't shown above**
- **NEVER say things like "as we'll see later" or "in other chapters"**
- **If you know this book, COMPLETELY IGNORE that knowledge - pretend you've never read it**

When you need to EXPAND and fill time, use ONLY these techniques:
1. **General real-world examples** - from history, business, politics, sports, relationships (NOT from this book)
2. **Personal anecdotes** - hypothetical stories about "someone I know" or "imagine if..."
3. **Deeper analysis** - ask "why does this work?" and "what are the psychological principles?"
4. **Practical applications** - "how would you apply this at work?" or "in your personal life?"
5. **Counterarguments** - "but some might say..." and respond to objections
6. **Repeat and rephrase** key concepts from the source in different ways

## Episode Title
"{request.episode_title}"

Now write the complete podcast script:
"""
        return prompt
