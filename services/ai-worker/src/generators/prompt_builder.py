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
import random
from dataclasses import dataclass
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class DebatePosition(str, Enum):
    """Position a speaker takes in a debate."""
    ADVOCATE = "advocate"  # Supports the book's main thesis/ideas
    CRITIC = "critic"  # Challenges or questions the book's ideas
    MODERATE = "moderate"  # Takes a balanced middle-ground position
    DEVILS_ADVOCATE = "devils_advocate"  # Intentionally argues against for discussion


class DebateOutcome(str, Enum):
    """How the debate resolves."""
    ADVOCATE_WINS = "advocate_wins"  # Pro-book position is more convincing
    CRITIC_WINS = "critic_wins"  # Critical position gains ground
    SYNTHESIS = "synthesis"  # Both sides find common ground
    AGREE_TO_DISAGREE = "agree_to_disagree"  # Respectful disagreement remains
    UNEXPECTED_ALLIANCE = "unexpected_alliance"  # Critic comes around to advocate's view


@dataclass
class GuestPersonality:
    """Individual guest personality for debates/discussions."""
    name: str  # GUEST, GUEST1, GUEST2, etc.
    chaos_factor: int  # 1-10, randomly generated
    position: Optional[DebatePosition] = None  # For debates
    personality_flavor: Optional[str] = None  # Brief descriptor


@dataclass
class DebateConfig:
    """Configuration for debate-style episodes with randomized elements."""
    host_position: DebatePosition
    guest_personalities: list[GuestPersonality]
    outcome: DebateOutcome
    formality_level: int  # 1-10: 1-3=formal, 4-6=conversational, 7-10=heated
    tension_arc: str  # Description of how tension evolves

    @classmethod
    def generate(
        cls,
        episode_type: str,
        host_chaos_factor: int,
    ) -> "DebateConfig":
        """Generate a randomized debate configuration."""
        # Formality level driven by host's chaos factor with variance
        variance = random.randint(-1, 1)
        formality_level = max(1, min(10, host_chaos_factor + variance))

        # Randomly assign host position
        host_position_weights = [
            (DebatePosition.ADVOCATE, 0.4),
            (DebatePosition.CRITIC, 0.25),
            (DebatePosition.MODERATE, 0.25),
            (DebatePosition.DEVILS_ADVOCATE, 0.1),
        ]
        host_position = random.choices(
            [p for p, _ in host_position_weights],
            weights=[w for _, w in host_position_weights]
        )[0]

        # Generate guest personalities
        guest_personalities = []
        num_guests = 1

        advocate_flavors = [
            "enthusiastic supporter", "thoughtful believer", "practical implementer",
            "passionate advocate", "experiential endorser", "optimistic applier"
        ]
        critic_flavors = [
            "skeptical academic", "pragmatic questioner", "contrarian thinker",
            "analytical doubter", "seasoned cynic", "devil's advocate"
        ]
        moderate_flavors = [
            "balanced mediator", "nuanced observer", "diplomatic bridge-builder",
            "open-minded explorer", "fair assessor"
        ]

        for i in range(num_guests):
            guest_name = "GUEST" if num_guests == 1 else f"GUEST{i + 1}"
            guest_chaos = random.randint(1, 10)

            # Assign contrasting positions for interesting dynamics
            if host_position == DebatePosition.ADVOCATE:
                guest_position_weights = [
                    (DebatePosition.CRITIC, 0.45),
                    (DebatePosition.MODERATE, 0.3),
                    (DebatePosition.ADVOCATE, 0.15),
                    (DebatePosition.DEVILS_ADVOCATE, 0.1),
                ]
            elif host_position == DebatePosition.CRITIC:
                guest_position_weights = [
                    (DebatePosition.ADVOCATE, 0.45),
                    (DebatePosition.MODERATE, 0.3),
                    (DebatePosition.CRITIC, 0.15),
                    (DebatePosition.DEVILS_ADVOCATE, 0.1),
                ]
            else:
                guest_position_weights = [
                    (DebatePosition.ADVOCATE, 0.35),
                    (DebatePosition.CRITIC, 0.35),
                    (DebatePosition.MODERATE, 0.2),
                    (DebatePosition.DEVILS_ADVOCATE, 0.1),
                ]

            # Ensure variety in debates with multiple guests
            if num_guests == 2 and i == 1 and guest_personalities:
                first_pos = guest_personalities[0].position
                if first_pos == DebatePosition.ADVOCATE:
                    guest_position_weights = [
                        (DebatePosition.CRITIC, 0.5),
                        (DebatePosition.MODERATE, 0.35),
                        (DebatePosition.DEVILS_ADVOCATE, 0.15),
                    ]
                elif first_pos == DebatePosition.CRITIC:
                    guest_position_weights = [
                        (DebatePosition.ADVOCATE, 0.5),
                        (DebatePosition.MODERATE, 0.35),
                        (DebatePosition.DEVILS_ADVOCATE, 0.15),
                    ]

            guest_position = random.choices(
                [p for p, _ in guest_position_weights],
                weights=[w for _, w in guest_position_weights]
            )[0]

            if guest_position == DebatePosition.ADVOCATE:
                flavor = random.choice(advocate_flavors)
            elif guest_position in [DebatePosition.CRITIC, DebatePosition.DEVILS_ADVOCATE]:
                flavor = random.choice(critic_flavors)
            else:
                flavor = random.choice(moderate_flavors)

            guest_personalities.append(GuestPersonality(
                name=guest_name,
                chaos_factor=guest_chaos,
                position=guest_position,
                personality_flavor=flavor,
            ))

        outcome = cls._determine_outcome(host_position, guest_personalities)
        tension_arc = cls._generate_tension_arc(formality_level, outcome)

        return cls(
            host_position=host_position,
            guest_personalities=guest_personalities,
            outcome=outcome,
            formality_level=formality_level,
            tension_arc=tension_arc,
        )

    @staticmethod
    def _determine_outcome(
        host_position: DebatePosition,
        guest_personalities: list[GuestPersonality],
    ) -> DebateOutcome:
        """Randomly determine debate outcome."""
        positions = [host_position] + [g.position for g in guest_personalities]
        advocate_count = sum(1 for p in positions if p == DebatePosition.ADVOCATE)
        critic_count = sum(1 for p in positions if p in [DebatePosition.CRITIC, DebatePosition.DEVILS_ADVOCATE])

        if advocate_count > critic_count:
            outcome_weights = [
                (DebateOutcome.ADVOCATE_WINS, 0.3),
                (DebateOutcome.CRITIC_WINS, 0.15),
                (DebateOutcome.SYNTHESIS, 0.35),
                (DebateOutcome.AGREE_TO_DISAGREE, 0.15),
                (DebateOutcome.UNEXPECTED_ALLIANCE, 0.05),
            ]
        elif critic_count > advocate_count:
            outcome_weights = [
                (DebateOutcome.ADVOCATE_WINS, 0.15),
                (DebateOutcome.CRITIC_WINS, 0.3),
                (DebateOutcome.SYNTHESIS, 0.3),
                (DebateOutcome.AGREE_TO_DISAGREE, 0.15),
                (DebateOutcome.UNEXPECTED_ALLIANCE, 0.1),
            ]
        else:
            outcome_weights = [
                (DebateOutcome.ADVOCATE_WINS, 0.2),
                (DebateOutcome.CRITIC_WINS, 0.2),
                (DebateOutcome.SYNTHESIS, 0.35),
                (DebateOutcome.AGREE_TO_DISAGREE, 0.2),
                (DebateOutcome.UNEXPECTED_ALLIANCE, 0.05),
            ]

        return random.choices(
            [o for o, _ in outcome_weights],
            weights=[w for _, w in outcome_weights]
        )[0]

    @staticmethod
    def _generate_tension_arc(formality_level: int, outcome: DebateOutcome) -> str:
        """Generate tension arc description."""
        if formality_level <= 3:
            arcs = [
                "Start with measured opening statements, build through structured rebuttals, resolve with dignified conclusions",
                "Begin cordially, exchange increasingly pointed counterarguments, conclude with mutual respect",
                "Open with thesis statements, develop through evidence-based challenges, end with scholarly synthesis",
            ]
        elif formality_level <= 6:
            arcs = [
                "Start friendly, tension builds as disagreements surface, cool down toward resolution",
                "Begin casually, heat up during key points of contention, find common ground at the end",
                "Open warmly, get more animated during debates, settle into thoughtful conclusion",
            ]
        else:
            arcs = [
                "Jump in hot, escalate through passionate exchanges, reach explosive climax before unexpected resolution",
                "Start with immediate friction, build to heated confrontation, resolve through breakthrough moment",
                "Begin with provocative statements, spiral into intense back-and-forth, end with hard-won understanding",
                "Open with bold challenges, escalate with personal conviction, conclude with grudging respect",
            ]
        return random.choice(arcs)


@dataclass
class PodcasterPersonality:
    """Podcaster personality configuration."""

    tone: int  # 1-10
    communication_style: int  # 1-10
    humor_level: int  # 1-10
    conversational_depth: int  # 1-10
    chaos_factor: int  # 1-10
    intellectual_angle: Optional[str] = None
    expertise_tags: Optional[list[str]] = None


@dataclass
class ScriptRequest:
    """Request for script generation."""

    book_content: str
    book_title: str
    book_author: Optional[str]
    episode_title: str
    podcaster_name: str
    podcaster_personality: PodcasterPersonality
    episode_type: str  # MONOLOGUE, DUO
    episode_theme: str  # LECTURE, DISCUSSION, DEBATE
    target_length_min: int  # minutes
    target_length_max: int  # minutes
    content_is_limited: bool = False  # True when only partial content provided
    is_retry: bool = False  # True when retrying due to short script
    retry_count: int = 0  # 0 = first attempt, 1 = first retry, 2 = second retry
    expansion_ratio: float = 1.0  # How much to expand content (target_words / source_words)
    # Content scope info for the intro
    content_scope: str = "the book"  # e.g., "Chapter 2", "the entire book", "Chapters 1-3"
    chapter_title: Optional[str] = None  # Title of the chapter if single chapter
    # Debate configuration (generated for DEBATE theme episodes)
    debate_config: Optional[DebateConfig] = None
    # Book genres from Google Books API (e.g., ["Fiction / Fantasy / Epic"])
    book_genres: Optional[list[str]] = None


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
        trait_map: dict[tuple, str],
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

        # Note: expertise_tags are handled separately by build_genre_and_expertise_instructions()
        # to enable proper weighting based on book genre relevance

        return "\n".join(f"- {d}" for d in descriptions)

    def build_genre_and_expertise_instructions(
        self,
        book_genres: Optional[list[str]],
        expertise_tags: Optional[list[str]],
        book_title: str,
    ) -> str:
        """Build genre-aware, expertise-weighted discussion instructions.

        Instead of treating all books as self-help material and listing expertise
        tags as flat bullets, this method:
        1. Instructs the LLM to identify the book's core message from the content
        2. Uses genre to set the primary discussion energy/lens
        3. Weights expertise tags by their relevance to the genre and message
        """
        sections = []

        if book_genres:
            genres_str = ", ".join(book_genres)
            sections.append(f"""## BOOK GENRE & DISCUSSION LENS (CRITICAL - READ FIRST!)
This book's genre(s): {genres_str}

**Your #1 priority is the book's INTENDED MESSAGE.** Before discussing anything:
1. Identify what the book is actually trying to say — its core thesis, narrative, or argument
2. Let the genre set the PRIMARY ENERGY of your discussion

Genre-specific guidance:
- **Fiction / Fantasy / Sci-Fi:** Discuss the world-building, character arcs, narrative tension, themes, and emotional resonance. Talk about the magic systems, plot twists, and what makes the story compelling. Do NOT default to "5 life lessons from this novel."
- **Fiction / Literary:** Explore prose style, symbolism, character psychology, narrative structure. Discuss what the author is saying through the story.
- **Business / Management / Leadership:** Discuss strategies, frameworks, case studies, and practical applications as the book intends.
- **Self-Help / Personal Development:** The self-improvement lens IS the genre — discuss growth strategies, mindset shifts, and actionable advice.
- **History / Biography / Memoir:** Discuss events, context, significance, the people involved, and what we learn from the historical record.
- **Science / Technology:** Discuss discoveries, mechanisms, implications, and the wonder of understanding how things work.
- **Philosophy / Religion / Spirituality:** Engage with the ideas, arguments, worldviews, and their implications for how we understand existence.
- **Politics / Social Science / Economics:** Discuss power dynamics, institutions, policy implications, different perspectives, and societal impact.
- **Poetry / Art / Music:** Discuss aesthetics, emotional impact, cultural context, and artistic technique.
- **True Crime / Mystery / Thriller:** Discuss the investigation, psychology, suspense, justice, and what draws us to these stories.

If the genre doesn't match any of the above, infer the appropriate discussion style from the genre name and content.

**IMPORTANT:** If you detect a mismatch between the provided genre and the actual content, TRUST THE CONTENT over the genre label. The content is the source of truth.""")

        else:
            sections.append("""## BOOK DISCUSSION APPROACH
No genre information is available for this book. Determine the appropriate discussion lens from the content itself:
1. Read the provided content carefully
2. Identify what kind of book this is (fiction, non-fiction, self-help, academic, etc.)
3. Discuss it in the way that genre naturally calls for — fiction as fiction, business as business, philosophy as philosophy
4. Prioritize the book's intended message and themes above all else
5. Do NOT default to a self-help "life lessons" approach unless the content is genuinely self-help""")

        if expertise_tags:
            tags_str = ", ".join(expertise_tags)

            if book_genres:
                sections.append(f"""## EXPERTISE WEIGHTING (How to use your knowledge areas)
Your areas of expertise: {tags_str}

**Your expertise provides SECONDARY flavor, not the primary lens.** Apply this rule:

1. **High overlap** (your expertise closely matches the book's genre/subject): Lean heavily into your expertise. Your specialized knowledge directly serves the book's purpose.
2. **Moderate overlap** (tangential connection between your expertise and the book): Bring in expertise insights when they organically illuminate the content — but don't turn the discussion into a lecture on your expertise topic.
3. **Low overlap** (your expertise has little connection to this book's genre): Only surface your expertise when the content genuinely warrants it. Do NOT force connections.

**The golden rule:** Would a thoughtful reader with your background naturally make this connection? If yes, include it. If you have to strain to connect your expertise to the content, leave it out.

Do NOT:
- Force every book into a "lessons for your life/business" framework
- Override the genre's natural energy with your expertise lens
- Make the episode feel like a lecture on your expertise topic that happens to reference this book""")
            else:
                sections.append(f"""## YOUR EXPERTISE
Your areas of expertise: {tags_str}

Use your expertise as a lens where it naturally fits the content. If the book's subject aligns with your expertise, lean into it. If not, let the book's own themes lead and only reference your expertise when genuinely relevant.""")

        return "\n\n".join(sections)

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

        else:  # DUO
            return f"""
Format: Two-person conversation between HOST and GUEST.
Structure: Use speaker labels like "HOST:" and "GUEST:" for each speaking turn.
Style: Natural dialogue with back-and-forth exchange. The guest can challenge or add perspectives.
Include natural reactions like agreement sounds, laughter, and thoughtful pauses.
{tts_markup_guide}"""

    def build_theme_instructions(
        self,
        episode_theme: str,
        chaos_factor: int = 5,
        debate_config: Optional[DebateConfig] = None,
        episode_type: str = "DUO",
    ) -> str:
        """Get instructions based on episode theme and chaos factor.

        Args:
            episode_theme: LECTURE, DISCUSSION, or DEBATE
            chaos_factor: 1-10 scale affecting interruption frequency
            debate_config: Configuration for debate episodes (required for DEBATE theme)
            episode_type: DUO (used for debate speaker instructions)
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
            if debate_config:
                return self.build_debate_instructions(debate_config, episode_type)
            else:
                # Fallback to old behavior if no config provided
                backchannel_guidance = self._build_backchannel_guidance(chaos_factor, is_debate=True)
                return f"""
Tone: Argumentative (friendly). Present different perspectives and challenge ideas.
Goal: Explore the book through contrasting viewpoints and critical analysis.
{backchannel_guidance}"""

    def build_debate_instructions(self, config: DebateConfig, episode_type: str) -> str:
        """Build comprehensive debate instructions with position assignments, structure, and techniques.

        The goal is to create entertaining debates that make listeners question both positions.
        """
        formality = config.formality_level

        # Build position descriptions for each speaker
        position_instructions = self._build_position_assignments(config, episode_type)

        # Build debate structure based on formality
        structure_instructions = self._build_debate_structure(formality, config.outcome)

        # Build argumentative techniques guidance
        techniques_instructions = self._build_argumentation_techniques(formality)

        # Build tension/entertainment dynamics
        dynamics_instructions = self._build_tension_dynamics(config)

        # Build interruption/backchannel guidance based on formality
        interaction_instructions = self._build_debate_interactions(config)

        return f"""
## DEBATE FORMAT - MAKE BOTH SIDES COMPELLING!

**Primary Goal:** Create an entertaining debate where listeners genuinely question both positions.
Neither side should be obviously "right" - both must present strong, convincing arguments.

{position_instructions}

{structure_instructions}

{techniques_instructions}

{dynamics_instructions}

{interaction_instructions}
"""

    def _build_position_assignments(self, config: DebateConfig, episode_type: str) -> str:
        """Build clear position assignments for each speaker."""
        position_descriptions = {
            DebatePosition.ADVOCATE: "SUPPORTS the book's ideas - finds them valuable, practical, and worth applying",
            DebatePosition.CRITIC: "CHALLENGES the book's ideas - questions assumptions, points out flaws, demands evidence",
            DebatePosition.MODERATE: "BALANCED perspective - sees merit in both sides, seeks nuance and middle ground",
            DebatePosition.DEVILS_ADVOCATE: "PROVOCATEUR - intentionally argues against to test ideas, plays devil's advocate",
        }

        chaos_descriptors = {
            (1, 3): "measured and thoughtful",
            (4, 6): "engaged and animated",
            (7, 10): "passionate and fiery",
        }

        def get_chaos_descriptor(chaos: int) -> str:
            for (low, high), desc in chaos_descriptors.items():
                if low <= chaos <= high:
                    return desc
            return "engaged"

        lines = ["## SPEAKER POSITIONS (CRITICAL - Each speaker MUST maintain their assigned stance!)"]

        # Host position
        host_desc = position_descriptions[config.host_position]
        lines.append(f"\n**HOST:** {host_desc}")

        # Guest positions with their random chaos factors
        for guest in config.guest_personalities:
            guest_desc = position_descriptions[guest.position]
            chaos_desc = get_chaos_descriptor(guest.chaos_factor)
            flavor = f" ({guest.personality_flavor})" if guest.personality_flavor else ""
            lines.append(f"\n**{guest.name}:** {guest_desc}")
            lines.append(f"   - Speaking style: {chaos_desc}{flavor}")

        lines.append("""
**IMPORTANT:** Speakers must COMMIT to their positions throughout the debate.
- Don't have speakers agree too easily or abandon their stance
- Each position should sound genuinely convincing when argued
- Listeners should find themselves nodding along with BOTH sides at different moments
""")

        return "\n".join(lines)

    def _build_debate_structure(self, formality: int, outcome: DebateOutcome) -> str:
        """Build debate structure instructions based on formality level."""

        outcome_instructions = {
            DebateOutcome.ADVOCATE_WINS: "The advocate's position emerges as more convincing by the end, though the critic raises valid concerns that are acknowledged.",
            DebateOutcome.CRITIC_WINS: "The critic's skepticism proves well-founded; advocates concede some key points while defending core merits.",
            DebateOutcome.SYNTHESIS: "Both sides find unexpected common ground, creating a richer understanding than either started with.",
            DebateOutcome.AGREE_TO_DISAGREE: "The debate ends with mutual respect but fundamental disagreement - both positions remain valid.",
            DebateOutcome.UNEXPECTED_ALLIANCE: "A critic or skeptic is genuinely won over by a compelling argument, shifting their position.",
        }

        if formality <= 3:
            # Formal/Oxford-style debate
            structure = """## DEBATE STRUCTURE (Formal Style)

**Opening Phase (~20% of debate):**
- Each speaker presents their opening position clearly and formally
- State thesis, preview main arguments, establish credibility
- Minimal interruptions - let each speaker complete their opening

**Evidence & Arguments Phase (~50% of debate):**
- Present evidence, examples, and reasoning systematically
- Respond to opposing arguments with structured rebuttals
- Use phrases like "I'd like to address that point...", "The evidence suggests..."
- Polite but firm disagreements: "I respectfully disagree because..."

**Rebuttal & Challenge Phase (~20% of debate):**
- Direct responses to each other's strongest points
- Steel-man opposing arguments before refuting them
- Acknowledge valid points: "You raise a fair point, however..."

**Resolution Phase (~10% of debate):**
- Summarize key areas of agreement and disagreement
- Offer final thoughts on the core question"""

        elif formality <= 6:
            # Conversational debate
            structure = """## DEBATE STRUCTURE (Conversational Style)

**Opening Hook (~15% of debate):**
- Jump into the topic with genuine reactions to the book's ideas
- Speakers naturally reveal their differing takes early
- Set up the tension: "See, this is where we disagree..."

**Back-and-Forth Exploration (~55% of debate):**
- Natural conversation flow with building disagreements
- Mix of agreement moments and challenging each other
- Use real examples and personal experiences to argue points
- Interruptions are fine: "Wait, but what about...", "Hold on—"

**Peak Tension (~20% of debate):**
- The core disagreement comes to a head
- Most animated exchange of the debate
- Both sides make their strongest case

**Landing (~10% of debate):**
- Find resolution or acknowledge the impasse
- Natural wind-down with key takeaways"""

        else:
            # Heated/entertaining debate
            structure = """## DEBATE STRUCTURE (Heated/Entertaining Style)

**Explosive Opening (~10% of debate):**
- Start with a provocative statement or strong disagreement
- Immediately establish tension: "Look, I think this book gets it completely wrong..."
- Speakers jump in with passion from the start

**Escalating Clash (~60% of debate):**
- Rapid back-and-forth with frequent interruptions
- Personal stakes: "This matters because...", "In my experience..."
- Build momentum - each exchange more intense than the last
- Use humor, exasperation, disbelief: "[laughing] You can't be serious!", "[sigh] Here we go again..."
- Challenge each other directly: "That's exactly the problem with your thinking!"

**Climax (~20% of debate):**
- The most heated moment - voices raised, passionate arguments
- Core philosophical disagreement fully exposed
- This should be the most entertaining part

**Resolution (~10% of debate):**
- Unexpected moment of connection OR stubborn disagreement
- Either grudging respect or agreeing to disagree
- Leave listeners with something to think about"""

        outcome_text = outcome_instructions.get(outcome, outcome_instructions[DebateOutcome.SYNTHESIS])

        return f"""{structure}

**DEBATE OUTCOME:** {outcome_text}

Build toward this naturally - don't telegraph it, but guide the conversation there."""

    def _build_argumentation_techniques(self, formality: int) -> str:
        """Build guidance on argumentative techniques."""

        if formality <= 3:
            techniques = """## ARGUMENTATION TECHNIQUES (Use These!)

**Steel-Manning (REQUIRED):**
Before disagreeing, genuinely represent the opposing view at its strongest:
- "I understand why you'd think that, and it's a strong argument because..."
- "The best version of that argument would be..."
- Then offer your rebuttal

**Evidence-Based Arguments:**
- Cite examples from the book
- Reference real-world applications
- Use logical reasoning chains

**Conceding Points Gracefully:**
- "You're right about X, but that doesn't change Y..."
- "I'll grant you that point, however..."
- Shows intellectual honesty

**Pivoting Skillfully:**
- "That's true in some cases, but the larger point is..."
- "Even if we accept that, we still have to address..."

**Reframing:**
- "I think you're asking the wrong question. The real issue is..."
- "Let's step back and look at this from a different angle..." """

        elif formality <= 6:
            techniques = """## ARGUMENTATION TECHNIQUES (Keep It Natural!)

**Quick Steel-Manning:**
- Acknowledge the other person's point before countering
- "Okay, I get why you see it that way, but..."
- Don't spend too long on it - just show you're listening

**Real-World Examples:**
- "Think about it like this..." + relatable scenario
- Personal anecdotes: "I've seen this play out when..."
- Pop culture references work great

**Strategic Concessions:**
- Give ground on small points to strengthen your main argument
- "Fine, maybe that part is overstated, but the core idea..."

**Redirecting:**
- "Sure, but here's what really matters..."
- "That's a side issue. The main thing is..."

**Building Coalitions:**
- Find moments of unexpected agreement
- "Actually, we both agree on this part—it's the next step where we differ" """

        else:
            techniques = """## ARGUMENTATION TECHNIQUES (Go For Impact!)

**Quick Acknowledgments Then Attack:**
- "Yeah yeah, I hear you, BUT—"
- Don't dwell on their points, pivot to your counterattack

**Visceral Examples:**
- Make it personal and immediate
- "Imagine YOUR boss did this to you..."
- Stories > statistics in heated debate

**Strategic Provocations:**
- Challenge their assumptions directly
- "That's such a [naive/cynical/idealistic] way to see it!"
- Push their buttons (respectfully)

**Concede to Conquer:**
- Give up a point dramatically to set up your knockout argument
- "FINE. Let's say you're right about that. Then explain THIS..."

**Humor as Weapon:**
- Well-timed jokes defuse AND sharpen tension
- Exaggeration for effect: "Oh sure, and next you'll tell me..."
- [laughing] reactions that show genuine engagement

**Emotional Appeals:**
- "This isn't just theory—this affects real people!"
- Show genuine passion for your position
- Let frustration and excitement come through"""

        return techniques

    def _build_tension_dynamics(self, config: DebateConfig) -> str:
        """Build instructions for tension and entertainment dynamics."""

        formality = config.formality_level

        entertainment_core = """## ENTERTAINMENT & ENGAGEMENT

**The Golden Rule:** Both positions must be argued so well that listeners change their mind MULTIPLE times during the debate.

**Create Doubt:**
- When the advocate makes a point, listeners should think "Hmm, that's true..."
- When the critic responds, listeners should think "Oh wait, that's also valid..."
- Keep them ping-ponging between positions

**Make It Personal (But Keep It Friendly):**
- Why does each speaker CARE about their position?
- What's at stake for them personally or professionally?
- Passion is entertaining—indifference is boring

**Surprise Moments:**
- An unexpected concession
- A new angle no one considered
- A moment of genuine connection amid disagreement
- [laughing] at a well-made point against you"""

        tension_arc = f"""
**Tension Arc:** {config.tension_arc}

Follow this emotional journey - don't stay at the same intensity throughout.
The debate should breathe: build tension, release some, build higher, release, climax, resolve."""

        if formality <= 3:
            style_note = """
**Style Note:** Formal doesn't mean boring! The entertainment comes from:
- Intellectual jousting and clever rebuttals
- The satisfaction of a well-constructed argument
- Watching two smart people genuinely grapple with ideas
- "Oh, that's a good point" moments"""

        elif formality <= 6:
            style_note = """
**Style Note:** This is a conversation between friends who disagree:
- Genuine warmth underlying the disagreement
- Playful jabs mixed with serious points
- Natural laughter and reactions
- The fun of a good argument with someone you respect"""

        else:
            style_note = """
**Style Note:** This is entertainment first, education second:
- High energy from start to finish
- Don't be afraid of dramatic moments
- Let speakers get genuinely worked up
- [laughing], [sigh], exclamations - use them!
- The goal is listeners saying "Wow, that got intense!" """

        return f"{entertainment_core}\n{tension_arc}\n{style_note}"

    def _build_debate_interactions(self, config: DebateConfig) -> str:
        """Build interaction/interruption guidance based on formality and guest chaos."""

        formality = config.formality_level

        # Calculate average guest chaos for interaction frequency
        avg_guest_chaos = sum(g.chaos_factor for g in config.guest_personalities) / len(config.guest_personalities)
        combined_chaos = (formality + avg_guest_chaos) / 2

        if combined_chaos <= 3:
            return """## INTERACTION STYLE (Measured)

**Interruption Frequency:** Rare (2-3 times total)
- Let speakers complete their thoughts
- Use polite interjections: "If I may...", "To add to that..."
- Interruptions should feel purposeful, not chaotic

**Verbal Cues:**
- Thoughtful acknowledgments: "I see...", "Interesting point..."
- Measured disagreement: "I'm not sure I agree..."
- Occasional "[uhm]" for thoughtfulness

**Physical Rhythm:**
- Longer speaking turns
- Natural pauses between speakers
- [medium pause] and [long pause] for emphasis"""

        elif combined_chaos <= 6:
            return """## INTERACTION STYLE (Engaged)

**Interruption Frequency:** Regular (4-6 times)
- Jump in when you have something important
- Mix of completing thoughts and cutting in
- "Sorry to interrupt, but—", "Wait, I have to say—"

**Verbal Cues:**
- Active listening: "Mm-hmm", "Right", "Okay okay"
- Reactive: "Ooh!", "Hmm...", "See, that's the thing—"
- Show you're processing: "[uhm]", "[short pause]"

**Energy:**
- Building momentum
- Voices get more animated as debate heats up
- Natural [laughing] at good points or absurdities"""

        else:
            return """## INTERACTION STYLE (Heated)

**Interruption Frequency:** Frequent (7+ times)
- Don't wait for the other person to finish
- "Hold on hold on—", "No no no, wait—", "See, THIS is—"
- Overlap is natural and expected

**Verbal Cues:**
- Rapid-fire: "Right right right", "Yeah but—", "Exactly! And—"
- Exasperation: "[sigh]", "Oh come ON", "[laughing] That's ridiculous!"
- Emphasis: "THIS is what I'm talking about!", "THAT'S the problem!"

**Energy:**
- Start energetic, keep building
- Let voices rise during key moments
- Genuine reactions: [laughing], [sigh], exclamations
- Passionate delivery throughout

**Entertainment Factor:**
- This should be FUN to listen to
- Think podcast hosts who genuinely disagree but respect each other
- Memorable moments > polished delivery"""

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
        words_per_minute: int = 180,  # ~180 wpm at default speed 5
    ) -> int:
        """Calculate target word count from time range.

        Aims for the MIDPOINT of the range to stay within bounds.
        """
        target_minutes = (target_length_min + target_length_max) / 2
        return int(target_minutes * words_per_minute)

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
When in doubt, ADD MORE CONTENT through NEW examples and perspectives - NOT by repeating yourself.

**ANTI-REPETITION RULE:** Once you've explained a concept, DO NOT circle back to explain it again.
Instead, expand through: new examples, different applications, historical parallels, or thought experiments.
Repetition is the enemy of engagement. Keep moving forward with fresh content.

**Minimum content per concept: 250-400 words of discussion (but all UNIQUE content, no rehashing).**
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
        theme_instructions = self.build_theme_instructions(
            episode_theme=request.episode_theme,
            chaos_factor=chaos_factor,
            debate_config=request.debate_config,
            episode_type=request.episode_type,
        )
        target_words = self.calculate_target_words(
            request.target_length_min,
            request.target_length_max,
        )

        author_line = f" by {request.book_author}" if request.book_author else ""

        # Build genre-aware, expertise-weighted instructions
        genre_expertise_section = self.build_genre_and_expertise_instructions(
            book_genres=request.book_genres,
            expertise_tags=request.podcaster_personality.expertise_tags,
            book_title=request.book_title,
        )

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

{genre_expertise_section}

## Episode Format
{type_instructions}

## Episode Theme
{theme_instructions}
{deep_dive_section}
## Requirements
- **CRITICAL: MINIMUM LENGTH**: The script MUST be at least {adjusted_target} words. This is approximately {request.target_length_min}-{request.target_length_max} minutes when spoken at ~185 words per minute.
- DO NOT write a short script. Episodes under {request.target_length_min} minutes are unacceptable and will be rejected.
- **NEVER BE REPETITIVE** - Each paragraph must add NEW value. Do not rehash or rephrase points you've already made.
- **INTRODUCTION MUST STATE SCOPE**: In the introduction, clearly state what you're covering (e.g., "Today we're diving into {request.content_scope} from {request.book_title}"{f' - specifically {request.chapter_title}' if request.chapter_title else ''})
- Include an engaging introduction that hooks the listener (at least 100 words)
- Cover ALL the key ideas from the book content provided - discuss each point in depth with examples and commentary
- Add extensive personal insights, analysis, and real-world applications for each concept - use ORIGINAL examples not from the source
- Include transitions between topics that add value, not just "next, let's talk about..."
- End with a thorough conclusion that synthesizes key points and provides a call to action (at least 100 words)
- When content is limited, expand through CREATIVE techniques (new examples, scenarios, historical parallels) - NOT repetition

## TTS TAGS - ONLY USE THESE OFFICIAL TAGS
The only allowed TTS expression tags are:
- [sigh], [laughing], [chuckling], [clearing throat], [uhm], [uh]
- [short pause], [medium pause], [long pause]
- [whispering]
**DO NOT use tags like [nodding], [smiling], [thoughtful], [leaning in], [gesturing], [excited], or any visual/physical actions - these cannot be synthesized by TTS!**

## Book Content to Discuss (THIS IS THE ONLY CONTENT YOU CAN REFERENCE!)
{request.book_content}

## STRICT CONTENT BOUNDARIES - CRITICAL!
You are discussing ONLY the content shown above. You must:
- **NEVER mention any law numbers, chapter titles, or concepts NOT explicitly written above**
- **NEVER reference other parts of this book that aren't shown above**
- **NEVER say things like "as we'll see later" or "in other chapters"**
- **If you know this book, COMPLETELY IGNORE that knowledge - pretend you've never read it**

## AVOIDING REPETITION - CRITICAL!
**DO NOT repeat or rephrase the same points multiple times.** Once you've explained a concept, MOVE ON.
- Only briefly revisit a topic if it's essential for a transition or to connect ideas
- If content is limited, use CREATIVE EXPANSION (below) instead of circling back
- Listeners find repetition boring - variety and fresh perspectives keep them engaged

## CREATIVE EXPANSION TECHNIQUES
When you need to EXPAND beyond the source material, use these techniques INSTEAD of repeating:
1. **Original real-world examples** - from history, business, politics, sports, celebrities, current events, pop culture (NOT from this book). Create vivid, detailed scenarios.
2. **Hypothetical scenarios** - "Imagine you're in a meeting and...", "Picture this situation..."
3. **Personal anecdotes** - hypothetical stories about "someone I know" or "a friend once told me..."
4. **Deeper psychological analysis** - explore WHY things work, the underlying human nature
5. **Practical step-by-step applications** - "Here's exactly how you'd use this at work/home/relationships..."
6. **Counterarguments and debates** - "But some might argue..." and thoughtfully respond
7. **Historical parallels** - Connect to famous historical figures, events, or decisions
8. **Modern applications** - How does this apply to social media, remote work, modern relationships?
9. **Thought experiments** - "What if everyone followed this principle? What would happen?"
10. **Related wisdom** - Connect to general psychology, philosophy, or common sayings (without citing this book)

## Episode Title
"{request.episode_title}"

Now write the complete podcast script:
"""
        return prompt
