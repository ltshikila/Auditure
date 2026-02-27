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

            # Assign contrasting positions — in DUO, guest MUST oppose the host
            # (two advocates or two critics = discussion, not debate)
            if episode_type == "DUO":
                if host_position == DebatePosition.ADVOCATE:
                    guest_position_weights = [
                        (DebatePosition.CRITIC, 0.55),
                        (DebatePosition.MODERATE, 0.25),
                        (DebatePosition.DEVILS_ADVOCATE, 0.20),
                    ]
                elif host_position == DebatePosition.CRITIC:
                    guest_position_weights = [
                        (DebatePosition.ADVOCATE, 0.55),
                        (DebatePosition.MODERATE, 0.25),
                        (DebatePosition.DEVILS_ADVOCATE, 0.20),
                    ]
                elif host_position == DebatePosition.DEVILS_ADVOCATE:
                    guest_position_weights = [
                        (DebatePosition.ADVOCATE, 0.55),
                        (DebatePosition.MODERATE, 0.25),
                        (DebatePosition.CRITIC, 0.20),
                    ]
                else:  # MODERATE host
                    guest_position_weights = [
                        (DebatePosition.ADVOCATE, 0.40),
                        (DebatePosition.CRITIC, 0.40),
                        (DebatePosition.DEVILS_ADVOCATE, 0.20),
                    ]
            else:
                # GROUP episodes: allow some overlap for richer dynamics
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

        outcome = cls._determine_outcome(host_position, guest_personalities, formality_level)
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
        formality_level: int = 5,
    ) -> DebateOutcome:
        """Randomly determine debate outcome. High chaos biases toward stubbornness."""
        # At extreme chaos (9-10), stubbornness dominates — nobody concedes
        if formality_level >= 9:
            outcome_weights = [
                (DebateOutcome.ADVOCATE_WINS, 0.05),
                (DebateOutcome.CRITIC_WINS, 0.05),
                (DebateOutcome.SYNTHESIS, 0.0),
                (DebateOutcome.AGREE_TO_DISAGREE, 0.90),
                (DebateOutcome.UNEXPECTED_ALLIANCE, 0.0),
            ]
            return random.choices(
                [o for o, _ in outcome_weights],
                weights=[w for _, w in outcome_weights]
            )[0]

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
class CoHostArchetype:
    """Archetype-based co-host for DUO episodes. No fake identities — just a defined
    perspective and speaking style that contrasts with the host."""
    perspective: str  # Their angle: skeptical, enthusiastic, analytical, experiential, philosophical
    speaking_style: str  # How they communicate: concise and direct, warm and expansive, etc.
    role_description: str  # One-line description for the prompt


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
    # Chunking fields (for long episode generation)
    chunk_num: Optional[int] = None  # 1-indexed chunk number
    total_chunks: Optional[int] = None  # Total chunks planned
    chunk_target_words: Optional[int] = None  # Per-chunk word target (overrides calculated)
    previous_summary: Optional[str] = None  # Last ~3 sentences from previous chunk
    topics_covered: Optional[list[str]] = None  # Anti-repetition list from prior chunks


class PromptBuilder:
    """Build prompts for LLM script generation."""

    # Personality trait mappings
    TONE_MAP = {
        (1, 3): "calm, measured, and thoughtful",
        (4, 6): "balanced and conversational",
        (7, 8): "energetic, enthusiastic, and dynamic",
        (9, 10): "ELECTRIC — bursting with energy, infectious excitement, voice dripping with passion, practically jumping out of their seat",
    }

    COMMUNICATION_MAP = {
        (1, 3): "storytelling and narrative-focused",
        (4, 6): "balanced between stories and analysis",
        (7, 8): "analytical and fact-driven",
        (9, 10): "rapid-fire analysis — rattles off facts, connects dots at lightning speed, builds argument chains like a courtroom lawyer on espresso",
    }

    HUMOR_MAP = {
        (1, 3): "serious and professional",
        (4, 6): "occasional light humor",
        (7, 8): "comedic and entertaining",
        (9, 10): "relentlessly funny — roasts everything, drops one-liners constantly, turns serious points into comedy bits, makes the other speaker crack up",
    }

    DEPTH_MAP = {
        (1, 3): "accessible and surface-level",
        (4, 6): "moderately detailed",
        (7, 8): "deep philosophical exploration",
        (9, 10): "obsessively deep — goes down rabbit holes, pulls in obscure references, won't let a single point go unexamined, 'but wait, there's ANOTHER layer to this'",
    }

    CHAOS_MAP = {
        (1, 3): "structured and organized",
        (4, 6): "semi-structured with tangents",
        (7, 8): "spontaneous and free-flowing",
        (9, 10): "UNHINGED — chaotic, provocative, wildly unpredictable, goes on rants, picks fights, says things that make the other speaker go 'did you really just say that?!'",
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

    def generate_cohost_archetype(
        self,
        host_personality: PodcasterPersonality,
        episode_theme: str,
        book_genres: Optional[list[str]] = None,
    ) -> CoHostArchetype:
        """Generate a complementary co-host archetype that contrasts the host.

        The co-host should feel like a genuinely different person — not just the host
        with a different voice. Their perspective and style should create natural tension
        and variety in the conversation.
        """
        # Determine genre category for context-appropriate archetypes
        genre_cat = self._categorize_genre(book_genres)

        # Define perspective pools that contrast with host traits
        # Analytical host → experiential co-host, energetic host → measured co-host, etc.
        perspective_pools = {
            "LECTURE": {
                # Co-host is the engaged learner who asks good questions
                "perspectives": [
                    "an engaged learner who asks the questions the audience is thinking",
                    "a curious newcomer to this topic who wants things explained clearly",
                    "someone who learns by challenging — if an explanation doesn't click, they push back",
                ],
                "styles": [
                    "asks concise, pointed questions and genuinely listens to the answers",
                    "isn't afraid to say 'wait, I don't get that — can you break it down?'",
                    "connects abstract ideas to concrete everyday situations",
                ],
            },
            "DISCUSSION": {
                "perspectives": [
                    "a naturally curious explorer who follows ideas wherever they lead",
                    "someone who thinks out loud and isn't afraid to change their mind mid-conversation",
                    "a reflective thinker who connects everything back to lived experience",
                    "an enthusiastic reactor who gets genuinely excited when an idea clicks",
                ],
                "styles": [
                    "warm and expansive — builds on ideas with personal stories and 'what-if' scenarios",
                    "concise and direct — cuts to the heart of things with sharp observations",
                    "playful and witty — finds the humor and irony in serious ideas",
                    "deeply thoughtful — takes a beat before responding, then says something surprising",
                ],
            },
            "DEBATE": {
                "perspectives": [
                    "a sharp critical thinker who won't accept arguments at face value",
                    "a passionate contrarian who genuinely believes the opposing view",
                    "a pragmatist who cares about what actually works, not what sounds good in theory",
                    "someone who's been burned by ideas like this before and isn't buying it easily",
                ],
                "styles": [
                    "direct and unafraid of confrontation — says exactly what they think",
                    "builds their case methodically, then delivers the knockout punch",
                    "disarmingly calm when making devastating points",
                    "passionate and animated — you can hear the conviction in every word",
                ],
            },
        }

        pool = perspective_pools.get(episode_theme, perspective_pools["DISCUSSION"])

        # Select perspective and style, ensuring contrast with host
        perspective = random.choice(pool["perspectives"])
        speaking_style = random.choice(pool["styles"])

        # Adjust for host personality contrast
        if host_personality.tone >= 7:  # Energetic host
            # Prefer measured, grounded co-host
            if episode_theme != "DEBATE":
                calm_styles = [s for s in pool["styles"] if "thoughtful" in s or "concise" in s or "calm" in s]
                if calm_styles:
                    speaking_style = random.choice(calm_styles)
        elif host_personality.tone <= 3:  # Calm host
            # Prefer more animated co-host
            animated_styles = [s for s in pool["styles"] if "passionate" in s or "playful" in s or "enthusiastic" in s or "animated" in s]
            if animated_styles:
                speaking_style = random.choice(animated_styles)

        # Build role description
        role_description = f"Your co-host is {perspective}. They {speaking_style}."

        # Add genre-specific flavor
        genre_flavor = {
            "fiction": " They focus on characters, themes, and what makes the story resonate emotionally.",
            "business": " They bring a practical lens — always asking 'but does this actually work in the real world?'",
            "self_help": " They're interested in whether the advice is genuinely actionable or just sounds good.",
            "philosophy": " They love pushing ideas to their logical extremes to see if they hold up.",
            "history": " They're fascinated by the human stories behind the events and what we can learn from them.",
            "science": " They want to understand the 'so what' — why should a non-expert care about this?",
        }
        if genre_cat in genre_flavor:
            role_description += genre_flavor[genre_cat]

        return CoHostArchetype(
            perspective=perspective,
            speaking_style=speaking_style,
            role_description=role_description,
        )

    def _categorize_genre(self, book_genres: Optional[list[str]]) -> str:
        """Categorize book genres into broad categories."""
        if not book_genres:
            return "general"
        genres_lower = " ".join(book_genres).lower()
        if any(kw in genres_lower for kw in ["fiction", "novel", "fantasy", "sci-fi", "thriller", "mystery", "romance"]):
            return "fiction"
        if any(kw in genres_lower for kw in ["business", "management", "leadership", "economics", "entrepreneur"]):
            return "business"
        if any(kw in genres_lower for kw in ["self-help", "personal development", "self-improvement", "motivation"]):
            return "self_help"
        if any(kw in genres_lower for kw in ["philosophy", "religion", "spiritual"]):
            return "philosophy"
        if any(kw in genres_lower for kw in ["history", "biography", "memoir", "war"]):
            return "history"
        if any(kw in genres_lower for kw in ["science", "technology", "computer", "physics", "biology"]):
            return "science"
        return "general"

    def build_pacing_structure(
        self,
        episode_theme: str,
        book_genres: Optional[list[str]],
        target_words: int,
    ) -> str:
        """Build genre-aware emotional pacing structure for the episode."""
        genre_cat = self._categorize_genre(book_genres)

        if episode_theme == "LECTURE":
            return self._build_lecture_pacing(genre_cat, target_words)
        elif episode_theme == "DISCUSSION":
            return self._build_discussion_pacing(target_words)
        else:  # DEBATE
            return self._build_debate_pacing(target_words)

    def _build_lecture_pacing(self, genre_cat: str, target_words: int) -> str:
        """Build lecture pacing that varies by genre."""
        genre_pacing = {
            "fiction": {
                "hook": "Open with an intriguing scene or quote from the book — something that makes listeners go 'wait, what?'",
                "build": "Set up the world, characters, and narrative stakes. Give listeners the context they need to care.",
                "core": "Deep thematic analysis — what is the author really saying through this story? Explore character arcs, symbolism, and narrative choices.",
                "climax": "The 'aha' connection — where all the themes come together and the book's deeper meaning crystallizes.",
                "close": "Why this story matters. What it reveals about human nature, society, or ourselves.",
            },
            "business": {
                "hook": "Open with a counterintuitive claim or surprising statistic that challenges conventional thinking.",
                "build": "Introduce the core framework or model the book proposes. Explain WHY this matters for the listener.",
                "core": "Walk through case studies, evidence, and real-world examples. Show the framework in action.",
                "climax": "The strategic insight — the key takeaway that could actually change how someone works or leads.",
                "close": "Actionable takeaways. Specific things listeners can do THIS WEEK based on what they've learned.",
            },
            "self_help": {
                "hook": "Start with a relatable pain point — a situation every listener has been in.",
                "build": "Introduce the author's approach and why it's different from what people usually try.",
                "core": "Walk through the techniques with vivid examples. Make each step feel achievable.",
                "climax": "The transformation moment — paint a picture of what changes when you actually apply this.",
                "close": "Personal action plan. Not vague inspiration, but 'here's exactly what to do next.'",
            },
            "philosophy": {
                "hook": "Open with a provocative question that has no easy answer.",
                "build": "Historical context — who was asking this question before, and why does it matter now?",
                "core": "Dissect the arguments. Follow the logic carefully but make it accessible.",
                "climax": "The paradigm shift — the moment where the idea fundamentally changes how you see something.",
                "close": "Implications for how we actually live. Philosophy isn't abstract — bring it home.",
            },
            "history": {
                "hook": "Dramatic scene-setting — put the listener in the moment. What did it feel like to be there?",
                "build": "Context and key players. Who were these people, and what drove them?",
                "core": "Events unfolding — tell the story with narrative tension, not just chronology.",
                "climax": "The turning point — the moment everything changed and why it mattered.",
                "close": "Modern relevance. Why should someone in 2026 care about this?",
            },
            "science": {
                "hook": "A mind-blowing fact or question that makes listeners curious.",
                "build": "The backstory — how did we come to understand this? What mystery were scientists solving?",
                "core": "The discovery or concept explained clearly, with analogies that make it click.",
                "climax": "The 'whoa' moment — the implication that changes how you see the world.",
                "close": "What this means for the future and why every listener should care.",
            },
        }

        pacing = genre_pacing.get(genre_cat, genre_pacing["business"])

        def w(pct):
            return int(target_words * pct)

        return f"""## EPISODE PACING (Follow this emotional arc!)

**1. HOOK (~{w(0.10)} words, ~10%)**
{pacing['hook']}

**2. BUILD (~{w(0.25)} words, ~25%)**
{pacing['build']}

**3. CORE (~{w(0.35)} words, ~35%)**
{pacing['core']}

**4. CLIMAX (~{w(0.15)} words, ~15%)**
{pacing['climax']}

**5. CLOSE (~{w(0.15)} words, ~15%)**
{pacing['close']}

DO NOT just linearly walk through the content. Follow this emotional arc — build tension, create revelations, land with impact."""

    def _build_discussion_pacing(self, target_words: int) -> str:
        def w(pct):
            return int(target_words * pct)

        return f"""## EPISODE PACING (Follow this conversational arc!)

**1. SPARK (~{w(0.10)} words, ~10%)**
"Something about this completely changed how I think about..." — Open with genuine enthusiasm or intrigue. Set up why this book grabbed you.

**2. EXPLORATION (~{w(0.25)} words, ~25%)**
Unpack initial reactions. Both speakers share what struck them. Surface the interesting tensions in the material. "What I found fascinating was..." / "See, I read that differently..."

**3. TENSION (~{w(0.20)} words, ~20%)**
"But here's where it gets complicated..." — Find the genuinely hard questions. Where does the author's argument break down? What did they get wrong or oversimplify? Push each other.

**4. BREAKTHROUGH (~{w(0.25)} words, ~25%)**
Work through the tension. New understanding emerges. "Oh wait — I think I see what you mean now..." Genuine intellectual progress, not just agreeing to agree.

**5. REFLECTION (~{w(0.20)} words, ~20%)**
What does this mean for the listener? Personal takeaways. "If I had to tell someone one thing from this book..." End with something that sticks.

DO NOT have a flat conversation where both speakers just agree the whole time. Find the genuine tensions and work through them."""

    def _build_debate_pacing(self, target_words: int) -> str:
        def w(pct):
            return int(target_words * pct)

        return f"""## EPISODE PACING (Follow this debate arc!)

**1. OPENING SALVOS (~{w(0.10)} words, ~10%)**
Both sides state their position clearly and STRONGLY. No hedging. The audience should immediately know where each speaker stands and feel the voltage between them.

**2. EVIDENCE EXCHANGE (~{w(0.25)} words, ~25%)**
Each side presents their strongest arguments with SPECIFIC evidence. From the book, from real-world examples, from personal reasoning. Build the case before tearing down the other side.

**3. ESCALATION (~{w(0.25)} words, ~25%)**
Direct challenges, rebuttals, getting heated. "That's exactly the problem with your argument..." / "You're completely missing the point..." Each exchange more intense than the last.

**4. CLIMAX (~{w(0.20)} words, ~20%)**
The critical exchange where the core disagreement crystallizes. The audience should feel the tension. This is the moment everyone will remember.

**5. RESOLUTION (~{w(0.20)} words, ~20%)**
Land the plane — how does this debate resolve? Not a cop-out ending. A genuine conclusion that reflects the outcome."""

    def _build_chunk_position_instructions(
        self,
        chunk_num: int,
        total_chunks: int,
        words_per_chunk: int,
        episode_type: str,
        content_scope: str,
        book_title: str,
        chapter_title: Optional[str] = None,
    ) -> str:
        """Build position-specific instructions for chunked generation."""
        is_first = chunk_num == 1
        is_last = chunk_num == total_chunks

        if is_first:
            return f"""## CHUNK POSITION: Part {chunk_num} of {total_chunks} — INTRODUCTION
This is the OPENING of the episode. You MUST:
- Start with an engaging hook to grab listeners
- Introduce "{book_title}" and clearly state you're covering {content_scope}{f" — specifically {chapter_title}" if chapter_title else ""}
- Set up the key themes you'll be discussing
- Begin exploring the first key concepts from the content
- Write approximately {words_per_chunk} words
- Do NOT conclude or wrap up — this continues in the next part
- End naturally mid-discussion — NOT with "see you next time" or any closing remarks"""
        elif is_last:
            return f"""## CHUNK POSITION: Part {chunk_num} of {total_chunks} — CONCLUSION
This is the FINAL part of the episode. You MUST:
- Continue naturally from where the previous part left off (NO "welcome back" — this is seamless)
- Discuss any remaining insights and concepts that haven't been covered yet
- Provide a thorough conclusion summarizing key takeaways
- End with a compelling closing thought for listeners
- Write approximately {words_per_chunk} words"""
        else:
            return f"""## CHUNK POSITION: Part {chunk_num} of {total_chunks} — CONTINUATION
This is a MIDDLE section of the episode. You MUST:
- Continue naturally from where the previous part left off (NO "welcome back" — this is seamless)
- Dive deeper into NEW concepts from the source (not ones already covered!)
- Add examples, analysis, and personal insights
- Write approximately {words_per_chunk} words
- Do NOT conclude or wrap up — the episode continues after this
- End naturally mid-discussion — NOT with any closing remarks"""

    def _build_chunk_context(
        self,
        previous_summary: Optional[str] = None,
        topics_covered: Optional[list[str]] = None,
    ) -> str:
        """Build context from previous chunks for anti-repetition."""
        sections = []

        if topics_covered:
            topics_list = "\n".join(f"  - {topic}" for topic in topics_covered)
            sections.append(f"""## ALREADY COVERED — DO NOT REPEAT!
The following topics, examples, and references were used in previous parts.
DO NOT repeat them or use similar examples. Use FRESH illustrations:
{topics_list}""")

        if previous_summary:
            sections.append(f"""## PREVIOUS CONTEXT (continue from here)
The previous part ended with:
{previous_summary}

Continue naturally from this point — do NOT re-introduce the topic.""")

        return "\n\n".join(sections) + "\n" if sections else ""

    def _build_conclusion_requirement(self, episode_theme: str, episode_type: str) -> str:
        """Build theme-specific conclusion requirement for MANDATORY STRUCTURE."""
        is_multi = episode_type in ("DUO", "GROUP")

        if episode_theme == "DEBATE":
            if is_multi:
                return (
                    "DEBATE RESOLUTION: The debate MUST reach a resolution. Do NOT end while speakers "
                    "are still arguing. After the climax, both speakers MUST deliver closing statements "
                    "with final reflections on the topic."
                )
            return (
                "DEBATE RESOLUTION: After wrestling with both sides, you MUST arrive at a clear "
                "conclusion. Do NOT end mid-deliberation. State your final position and why."
            )
        elif episode_theme == "DISCUSSION":
            if is_multi:
                return (
                    "DISCUSSION WRAP-UP: Both speakers MUST share final reflections and key takeaways. "
                    "Do NOT end while still exploring a point. Wrap up naturally — 'So if there's one thing "
                    "to take away from this...' — and give the listener a clear closing thought."
                )
            return (
                "DISCUSSION WRAP-UP: End with a synthesis of what you explored and your main takeaway. "
                "Do NOT trail off mid-thought. Give the listener a clear, memorable closing."
            )
        else:  # LECTURE
            if is_multi:
                return (
                    "LECTURE CLOSE: End with a summary of key insights and actionable takeaways. "
                    "Both speakers should contribute to the wrap-up. Do NOT stop mid-explanation. "
                    "Give listeners a clear 'here's what to remember' moment."
                )
            return (
                "LECTURE CLOSE: Summarize the key insights and end with actionable takeaways. "
                "Do NOT stop mid-explanation. Give the listener a clear, memorable conclusion."
            )

    def build_conversation_flow(
        self,
        episode_type: str,
        episode_theme: str,
        chaos_factor: int,
        cohost_archetype: Optional[CoHostArchetype] = None,
    ) -> str:
        """Build conversation flow instructions for DUO episodes.

        Addresses the ping-pong problem: real conversations have varied turn lengths,
        clear leadership per topic, callbacks to earlier points, and natural reactions.
        """
        if episode_type == "MONOLOGUE":
            return ""

        # Determine conversation leader pattern
        # Randomly assign leadership for variety
        leader_pattern = random.choice([
            "HOST leads most topics, GUEST adds depth and challenges",
            "Leadership alternates — HOST leads odd topics, GUEST leads even topics",
            "GUEST leads the opening and closing topics, HOST leads the middle",
        ])

        # Build interruption style based on chaos
        if chaos_factor <= 3:
            interruption_style = "Rare interruptions — let each person finish their thought. When you do interrupt, it should feel purposeful."
        elif chaos_factor <= 6:
            interruption_style = "Natural interruptions when something is too interesting to wait — 'Oh wait, that reminds me of—' or 'Hold on, I need to push back on that.'"
        elif chaos_factor <= 8:
            interruption_style = "Frequent, energetic interruptions — talking over each other, finishing each other's sentences, 'No no no, let me stop you right there—'"
        else:  # 9-10
            interruption_style = "RELENTLESS interruptions — cutting each other off mid-word, shouting over each other, personal jabs, 'Oh PLEASE, you can't seriously believe—', '[laughing] That is the MOST ridiculous thing I've ever heard', refusing to let the other finish a single point"

        cohost_section = ""
        if cohost_archetype:
            cohost_section = f"""
## CO-HOST CHARACTER
{cohost_archetype.role_description}

The HOST and GUEST should sound like GENUINELY DIFFERENT PEOPLE — not two versions of the same personality taking turns. Their reactions, vocabulary, and thought patterns should be clearly distinct.
"""

        return f"""{cohost_section}
## CONVERSATION FLOW (CRITICAL FOR NATURAL DIALOGUE)

**Turn Length — VARY IT:**
- LONG turns (3-5 sentences): When a speaker is making a complete point, telling an anecdote, or explaining a concept. Let them FINISH their thought without interruption.
- MEDIUM turns (1-2 sentences): Adding a perspective, asking a substantive question, or making a specific observation.
- SHORT turns (partial sentence): Reactions, interruptions, backchannels — "That's wild", "Wait—", "Exactly!"
- DO NOT make every turn the same length. A conversation where both speakers always say 2 sentences each is robotic.

**Leadership Pattern: {leader_pattern}**
- The "leader" of a topic makes the main point (3-5 sentences).
- The other speaker reacts, asks follow-ups, challenges, or adds (1-2 sentences).
- Then leadership can shift. Neither person should dominate the ENTIRE episode.

**Callbacks & Threading:**
- Reference earlier points: "Going back to what you said about X..."
- Build on previous disagreements: "I've been thinking about your earlier point..."
- Create continuity: ideas from early in the conversation should echo later.

**Natural Reactions (NOT just "Mm-hmm"):**
- "That's wild", "I never thought of it that way", "Okay wait—", "See, this is what I mean"
- Let reactions sometimes interrupt, sometimes come after a [short pause]
- Match reactions to personality — analytical hosts react differently than energetic hosts

**Genuine Thinking Moments:**
- When one speaker makes a point that genuinely challenges the other, the other should NOT respond with an instant, polished rebuttal. They should think:
  - "I... [medium pause] hm, that's actually..." then regroup
  - "[uhm] Well... okay, if you look at it that way... [short pause] but consider this—"
  - "[sigh] That's fair. I hadn't thought of it like that. But here's where I push back..."
- This should happen 2-3 times per episode — at the moments where a point genuinely lands.
- The speaker who's thinking should sometimes concede partially before pivoting to their counter.

**{interruption_style}**

REMEMBER: The goal is a conversation that sounds like two real people who actually care about this topic, not a scripted dialogue where both speakers politely take turns."""

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

    def build_episode_type_instructions(self, episode_type: str, episode_theme: str = "LECTURE") -> str:
        """Get instructions based on episode type and theme combination.

        All 6 combinations are supported:
        - MONOLOGUE + LECTURE: Single host teaching
        - MONOLOGUE + DISCUSSION: Thinking out loud, exploring ideas
        - MONOLOGUE + DEBATE: Internal deliberation, wrestling with ideas
        - DUO + LECTURE: Teacher/student dynamic
        - DUO + DISCUSSION: Two people exploring together
        - DUO + DEBATE: Two people with opposing views
        """
        tts_markup_guide = """
## TTS Markup Tags (OFFICIAL TAGS ONLY - others will be spoken aloud!)
Include ONLY these official markup tags throughout the script:

**Non-Speech Sounds (acted out, not spoken):**
- [sigh] - Frustration, relief, contemplation
- [laughing] - Natural laughter
- [uhm] - Thinking hesitation

**Style Modifiers (affect delivery, not spoken):**
- [whispering] - Quiet, intimate delivery
- [sarcasm] - Sarcastic tone on following phrase
- [shouting] - Raised volume for passionate moments
- [extremely fast] - Rapid delivery for excited tangents

**Pacing:**
- [short pause] - Brief beat (~250ms)
- [medium pause] - Sentence break (~500ms)
- [long pause] - Dramatic pause (~1s)

**DO NOT use:** [nodding], [smiling], [thoughtful], [excited], [curious], [scared], [bored],
[leaning in], [gesturing], or any physical/visual actions. These will be spoken aloud or produce
unpredictable results.

Example:
"So I was reading this [short pause] and honestly [sigh] it completely changed how I think about this."
"[uhm] Let me think about that [medium pause] yeah, I think you're right."
"[sarcasm] Oh sure, because that always works perfectly."
"""

        if episode_type == "MONOLOGUE":
            if episode_theme == "DISCUSSION":
                return f"""
Format: Single host thinking out loud — exploratory, questioning your own assumptions.
Structure: No speaker labels. Write as continuous first-person prose.
Style: Intimate and vulnerable. You're working through ideas in real-time, not presenting polished conclusions.
- "Let me work through this... on one hand... but then again..."
- Question yourself genuinely. Change your mind mid-thought sometimes.
- Share moments of genuine confusion or surprise.
- This should feel like the audience is inside your head as you process the book.
{tts_markup_guide}"""
            elif episode_theme == "DEBATE":
                return f"""
Format: Single host in internal deliberation — genuinely wrestling with the book's ideas.
Structure: No speaker labels. Write as continuous first-person prose.
Style: You are arguing BOTH SIDES honestly with yourself. Not performing objectivity — actually struggling.
- "Part of me agrees with the author here, but I can't shake the feeling that..."
- "Okay, so the strongest argument FOR this is... but then the strongest argument AGAINST..."
- Include moments of genuine uncertainty: "I honestly don't know where I land on this."
- The audience should feel like they're watching someone think critically in real-time.
- Do NOT just present the book's view then mildly object. BOTH sides must be argued with conviction.
{tts_markup_guide}"""
            else:  # LECTURE
                return f"""
Format: Single host teaching — structured, authoritative, engaging.
Structure: No speaker labels. Write as continuous first-person prose.
Style: First person, intimate, as if explaining to a close friend who's genuinely interested.
- Speak directly to the audience.
- Use "you" language: "Here's what you need to understand..."
- Build concepts on top of each other.
{tts_markup_guide}"""

        else:  # DUO
            if episode_theme == "LECTURE":
                return f"""
Format: Teacher/student dynamic between HOST (the explainer) and GUEST (the learner).
Structure: Use "HOST:" and "GUEST:" labels for every speaking turn.
Style: HOST explains and teaches. GUEST asks the questions the audience is thinking.
- GUEST is NOT passive — they ask smart questions, push back on unclear explanations, and make connections.
- "Wait, slow down — what do you mean by that exactly?"
- "Okay, so if I'm understanding this right..."
- "But how does that actually work in practice?"
- GUEST should NOT be sycophantic. Genuine curiosity, not fake enthusiasm.
{tts_markup_guide}"""
            elif episode_theme == "DEBATE":
                return f"""
Format: Two speakers with genuinely opposing views.
Structure: Use "HOST:" and "GUEST:" labels for every speaking turn.
Style: Both speakers COMMIT to their positions. This is not a polite disagreement — it's a real debate.
- Each speaker must sound genuinely convinced of their position.
- Direct challenges: "That's exactly the kind of thinking the author warns against..."
- Don't hedge: avoid "well, you make a good point" unless you're about to demolish it.
- The audience should be able to clearly identify which side each speaker is on at ALL times.
{tts_markup_guide}"""
            else:  # DISCUSSION
                return f"""
Format: Two people exploring ideas together in genuine conversation.
Structure: Use "HOST:" and "GUEST:" labels for every speaking turn.
Style: Natural dialogue. Both speakers bring their own perspective and react genuinely.
- Include natural reactions: agreement, surprise, pushback, excitement.
- Build on each other's points rather than just alternating monologues.
- Find genuine tensions in the material and explore them together.
{tts_markup_guide}"""

    def build_theme_instructions(
        self,
        episode_theme: str,
        chaos_factor: int = 5,
        debate_config: Optional[DebateConfig] = None,
        episode_type: str = "DUO",
    ) -> str:
        """Get instructions based on episode theme and chaos factor.

        Supports all 6 combinations of type × theme.
        """
        if episode_theme == "LECTURE":
            if episode_type == "MONOLOGUE":
                return """
Tone: Educational and authoritative, but warm. You're the expert and the audience trusts you.
Goal: Teach the audience about the book's key concepts. Make complex ideas accessible.
Build from simple to complex. Use analogies, examples, and "here's why this matters" framing."""
            else:  # DUO LECTURE
                return """
Tone: Educational with genuine curiosity. HOST teaches, GUEST learns and challenges.
Goal: Make the book's concepts clear and memorable through the teacher/student dynamic.
The GUEST's questions should elevate the HOST's explanations — good questions make good answers."""

        elif episode_theme == "DISCUSSION":
            backchannel_guidance = self._build_backchannel_guidance(chaos_factor, is_debate=False)
            if episode_type == "MONOLOGUE":
                return """
Tone: Exploratory and reflective. You're thinking out loud, not presenting conclusions.
Goal: Take the audience on your intellectual journey through the book's ideas.
Include genuine moments of: surprise, confusion, disagreement, excitement, connection.
Don't be afraid to say "I'm not sure about this" or "this challenges what I used to think." """
            else:  # DUO DISCUSSION
                return f"""
Tone: Exploratory and collaborative. Two people genuinely curious about the same ideas.
Goal: Have a real conversation — not two prepared speeches taking turns.
Find the genuine tensions in the material. Where do you see things differently?
{backchannel_guidance}"""

        else:  # DEBATE
            if episode_type == "MONOLOGUE":
                return """
Tone: Internal deliberation — genuinely wrestling, not performing balance.
Goal: Argue both sides of the book's ideas with real conviction. The audience should feel
your genuine uncertainty about where you land.

CRITICAL RULES FOR MONOLOGUE DEBATE:
- Argue the FOR side with genuine passion: "Here's why this is brilliant..."
- Then argue the AGAINST side with equal conviction: "But here's why that might be completely wrong..."
- Don't just present then dismiss. Both sides must be compelling.
- Include moments of genuine uncertainty: "I keep going back and forth on this..."
- The resolution should feel earned, not predetermined.
- Use self-interruption: "Wait, actually — no, let me rethink that..."
"""
            else:  # DUO DEBATE
                if debate_config:
                    return self.build_debate_instructions(debate_config, episode_type)
                else:
                    backchannel_guidance = self._build_backchannel_guidance(chaos_factor, is_debate=True)
                    return f"""
Tone: Genuinely argumentative. Not polite disagreement — real intellectual conflict.
Goal: Explore the book through OPPOSING viewpoints. Both sides must be compelling.
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
            (7, 8): "passionate and fiery",
            (9, 10): "UNHINGED — throws verbal grenades, gets personally offended, refuses to concede ANYTHING, laughs mockingly at opposing points, goes on passionate rants",
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
**CRITICAL — POSITION COMMITMENT:**
- Speakers must COMMIT to their positions. Do NOT hedge with "well you make a good point."
- If you concede a point, it should COST you something — only concede when the argument is genuinely irresistible, and immediately pivot to your counterattack.
- Each position must sound genuinely convincing — listeners should change their mind MULTIPLE times.
- The audience must be able to clearly identify which side each speaker is on at ALL times.
- This is NOT a polite discussion with a sprinkle of disagreement. It is a DEBATE. The speakers fundamentally disagree.
- Direct challenges are expected: "That's exactly the problem with your thinking..." / "You're assuming X, but what if that's completely wrong?"
""")

        return "\n".join(lines)

    def _build_debate_structure(self, formality: int, outcome: DebateOutcome) -> str:
        """Build debate structure instructions based on formality level."""

        # At extreme chaos, AGREE_TO_DISAGREE means stubborn warfare, not polite respect
        if formality >= 9:
            agree_to_disagree_text = (
                "Neither speaker concedes an INCH. Both walk away absolutely convinced they're right. "
                "The ending should feel like the argument could restart at any moment — not a polite "
                "'agree to disagree' but a stubborn 'I STILL think you're completely wrong and nothing "
                "you said changed my mind.' One speaker might even get the last word with a mocking "
                "laugh or a 'whatever you say' dismissal. The audience should feel the tension NEVER resolved."
            )
        else:
            agree_to_disagree_text = (
                "The debate crystallizes a fundamental VALUES difference that can't be resolved with more evidence. "
                "Both speakers respect each other but acknowledge: 'We just see the world differently on this.' "
                "The audience should understand exactly where the fault line is."
            )

        outcome_instructions = {
            DebateOutcome.ADVOCATE_WINS: "The advocate makes a specific argument that the critic genuinely cannot counter. The critic visibly struggles — not because they're weak, but because the argument is that good. The critic doesn't fully surrender but acknowledges 'okay, I can't argue with that.'",
            DebateOutcome.CRITIC_WINS: "The critic dismantles a core assumption the advocate relies on. The advocate realizes their position had a blind spot they hadn't considered. The advocate doesn't flip completely but admits 'that's... actually a fair point I need to sit with.'",
            DebateOutcome.SYNTHESIS: "Both speakers realize they were arguing past each other — they actually agree on the CORE issue but disagree on the approach. The moment of realization should feel genuine: 'Wait, are we actually saying the same thing?'",
            DebateOutcome.AGREE_TO_DISAGREE: agree_to_disagree_text,
            DebateOutcome.UNEXPECTED_ALLIANCE: "One speaker makes a point so compelling that the other has a genuine 'damn, you're right' moment. This should feel earned — built up through the debate, not sudden. The converted speaker should be surprised at their own change of heart.",
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

        elif combined_chaos <= 8:
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

        else:  # combined_chaos > 8
            return """## INTERACTION STYLE (Explosive)

**Interruption Frequency:** CONSTANT — barely let the other person finish a sentence
- "STOP. Stop right there—", "Are you HEARING yourself?!", "That's—no. Just no."
- Talk over each other, voices rising, neither willing to back down
- "You're COMPLETELY missing the point!", "Oh, so NOW you're an expert?"

**Verbal Warfare:**
- Personal jabs: "With all due respect, that's absurd", "You clearly haven't thought this through"
- Mocking: "[laughing] Oh that's RICH", "Sure, and I'm the Queen of England"
- Exasperation: "[sigh] I can't BELIEVE we're still arguing about this"
- Stubbornness: "I don't care what you say, I'm RIGHT about this"
- Disbelief: "Did you seriously just say that?!", "I'm sorry, WHAT?"

**Energy:**
- START hot and STAY hot — no cooling down periods
- Both speakers should sound like they're genuinely fired up
- Long [laughing] at absurd points — not polite chuckles, REAL belly laughs
- Controversial takes that make the listener go "oh damn"
- Wild analogies and tangents: "you know what, that's like saying..."

**The Vibe:**
- Think heated bar argument between two smart people who REFUSE to lose
- Personal stakes — they take the disagreement personally
- Unpredictable — sudden tangents, wild comparisons, dramatic reactions
- This should make listeners laugh, gasp, and pick sides
- Neither speaker gives the other an inch — EVER"""

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
            elif chaos <= 8:
                frequency = "frequently (7+ times)"
                style = "passionate interruptions and heated exchanges"
                examples = '"—hold on, that\'s not quite right—", "—I completely disagree—", "Right right right, but—!", "See, THIS is where I think—", "[laughing] Oh come on—"'
            else:  # chaos 9-10
                frequency = "CONSTANTLY (10+ times)"
                style = "aggressive, mocking, relentless verbal combat"
                examples = '"—STOP. That is RIDICULOUS—", "[laughing] Oh PLEASE, you can\'t be serious!", "Are you even LISTENING to yourself?!", "No no NO, you\'re WRONG and here\'s why—", "[sigh] I genuinely cannot believe you just said that"'

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
        words_per_minute: int = 148,  # Gemini TTS ~148 wpm at default speed 5
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
        chaos_factor = request.podcaster_personality.chaos_factor
        type_instructions = self.build_episode_type_instructions(request.episode_type, request.episode_theme)
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

        # Build emotional pacing structure
        pacing_section = self.build_pacing_structure(
            episode_theme=request.episode_theme,
            book_genres=request.book_genres,
            target_words=target_words,
        )

        # Build conversation flow for DUO episodes
        cohost_archetype = None
        conversation_flow_section = ""
        if request.episode_type == "DUO":
            cohost_archetype = self.generate_cohost_archetype(
                host_personality=request.podcaster_personality,
                episode_theme=request.episode_theme,
                book_genres=request.book_genres,
            )
            conversation_flow_section = self.build_conversation_flow(
                episode_type=request.episode_type,
                episode_theme=request.episode_theme,
                chaos_factor=chaos_factor,
                cohost_archetype=cohost_archetype,
            )
        # Store for later retrieval by script_generator
        self._last_cohost_archetype = cohost_archetype

        # Build deep dive instructions if content is limited or this is a retry
        deep_dive_section = ""
        if request.content_is_limited or request.retry_count > 0 or request.expansion_ratio >= 1.5:
            deep_dive_section = self.build_deep_dive_instructions(
                retry_count=request.retry_count,
                expansion_ratio=request.expansion_ratio,
                target_words=target_words,
            )

        # Determine effective word target
        is_chunked = request.chunk_num is not None and request.total_chunks is not None
        if is_chunked:
            # Chunked generation: use per-chunk target
            adjusted_target = request.chunk_target_words or target_words
        else:
            # Single-call generation: adjust for retries
            adjusted_target = target_words
            if request.retry_count >= 2:
                adjusted_target = int(target_words * 1.5)
                logger.info(f"Second retry: increased target from {target_words} to {adjusted_target} words")
            elif request.retry_count == 1:
                adjusted_target = int(target_words * 1.3)
                logger.info(f"First retry: increased target from {target_words} to {adjusted_target} words")
            elif request.content_is_limited or request.expansion_ratio >= 1.5:
                adjusted_target = int(target_words * 1.15)

        # Build chunk-specific sections
        chunk_position_section = ""
        chunk_context_section = ""
        if is_chunked:
            chunk_position_section = self._build_chunk_position_instructions(
                chunk_num=request.chunk_num,
                total_chunks=request.total_chunks,
                words_per_chunk=adjusted_target,
                episode_type=request.episode_type,
                content_scope=request.content_scope,
                book_title=request.book_title,
                chapter_title=request.chapter_title,
            )
            if request.topics_covered or request.previous_summary:
                chunk_context_section = self._build_chunk_context(
                    previous_summary=request.previous_summary,
                    topics_covered=request.topics_covered,
                )

        # Build requirements section (different for chunks vs single-call)
        if is_chunked:
            is_first = request.chunk_num == 1
            is_last = request.chunk_num == request.total_chunks

            # Build chunk-specific requirement lines
            intro_lines = ""
            if is_first:
                scope_detail = f" - specifically {request.chapter_title}" if request.chapter_title else ""
                intro_lines = (
                    f'- **INTRODUCTION MUST STATE SCOPE**: Clearly state what you are covering '
                    f'(e.g., "Today we are diving into {request.content_scope} from {request.book_title}"{scope_detail})\n'
                    f'- Hook the listener in the first 100 words.'
                )

            ending_line = (
                "- **ENDING IS NON-NEGOTIABLE**: End with a thorough conclusion. NEVER end abruptly or mid-conversation."
                if is_last
                else "- Do NOT conclude or wrap up — this part continues in the next segment."
            )

            requirements_section = f"""## Requirements
- **CRITICAL: LENGTH**: Write approximately {adjusted_target} words for this part.
- **NEVER BE REPETITIVE** - Each paragraph must add NEW value.
{intro_lines}
- Cover key ideas from the source — discuss each with depth, examples, and commentary.
- Add original real-world examples, insights, and analysis (NOT from the source).
- Use meaningful transitions, not "next, let's talk about..."
{ending_line}"""
        else:
            requirements_section = f"""## Requirements
- **CRITICAL: MINIMUM LENGTH**: The script MUST be at least {adjusted_target} words (~{request.target_length_min}-{request.target_length_max} minutes at ~150 wpm).
- DO NOT write a short script. Episodes under {request.target_length_min} minutes will be rejected.
- **NEVER BE REPETITIVE** - Each paragraph must add NEW value.
- **INTRODUCTION MUST STATE SCOPE**: Clearly state what you're covering (e.g., "Today we're diving into {request.content_scope} from {request.book_title}"{f' - specifically {request.chapter_title}' if request.chapter_title else ''})
- Hook the listener in the first 100 words.
- Cover ALL key ideas from the source — discuss each with depth, examples, and commentary.
- Add original real-world examples, insights, and analysis (NOT from the source).
- Use meaningful transitions, not "next, let's talk about..."
- **ENDING IS NON-NEGOTIABLE**: End with a thorough conclusion. NEVER end abruptly or mid-conversation."""

        # Build structure section (different for chunks vs single-call)
        if is_chunked:
            structure_section = chunk_position_section
        else:
            structure_section = f"""## MANDATORY STRUCTURE — PLAN YOUR ENDING BEFORE WRITING!
BEFORE you start writing, plan your script in three acts:
1. OPENING (10%): Hook the listener
2. MIDDLE (70%): Core content — explore, debate, discuss
3. CONCLUSION (20%, at least {int(adjusted_target * 0.20)} words): Proper wrap-up with closing thoughts

CRITICAL RULES:
- NEVER end mid-discussion, mid-argument, or mid-sentence. Your script MUST have a complete ending.
- The LAST 3-5 speaking turns MUST be dedicated to wrapping up and concluding.
- {self._build_conclusion_requirement(request.episode_theme, request.episode_type)}
- If you're running long, CUT middle content — NEVER cut the ending.
- A script without a proper conclusion is REJECTED. Always finish the conversation."""

        prompt = f"""You are {request.podcaster_name}, a podcast host creating an episode about "{request.book_title}"{author_line}.

## Your Personality
{personality_desc}

{genre_expertise_section}

## Episode Format
{type_instructions}

## Episode Theme
{theme_instructions}

{pacing_section}

{conversation_flow_section}
{deep_dive_section}
{requirements_section}

## Book Content to Discuss (THIS IS THE ONLY CONTENT YOU CAN REFERENCE!)
{request.book_content}

## STRICT CONTENT BOUNDARIES
You are discussing ONLY the content shown above:
- NEVER mention concepts, chapter titles, or law numbers NOT in the source above.
- NEVER reference other parts of this book.
- NEVER say "as we'll see later" or "in other chapters."
- If you know this book, COMPLETELY IGNORE that knowledge.

## AVOIDING REPETITION
Once you've explained a concept, MOVE ON. Do not circle back.
When content is limited, use CREATIVE EXPANSION instead of repeating:
1. Original real-world examples (history, business, sports, pop culture)
2. Hypothetical scenarios ("Imagine you're in a meeting and...")
3. Personal anecdotes ("someone I know..." / "a friend once told me...")
4. Deeper psychological analysis (WHY does this work?)
5. Practical step-by-step applications
6. Counterarguments ("But some might argue...")
7. Historical parallels and modern applications
8. Thought experiments ("What if everyone followed this?")
{chunk_context_section}
## Episode Title
"{request.episode_title}"

{structure_section}

Now write {"Part " + str(request.chunk_num) + " of " + str(request.total_chunks) + " of " if is_chunked else ""}the {"complete " if not is_chunked else ""}podcast script:
"""
        return prompt, cohost_archetype
