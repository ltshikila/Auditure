"""Unit tests for prompt builder."""

import pytest

from src.generators.prompt_builder import (
    PodcasterPersonality,
    PromptBuilder,
    ScriptRequest,
)


class TestPromptBuilder:
    """Test cases for PromptBuilder class."""

    @pytest.fixture
    def builder(self):
        """Create PromptBuilder instance."""
        return PromptBuilder()

    @pytest.fixture
    def sample_personality(self):
        """Create sample personality."""
        return PodcasterPersonality(
            tone=7,
            communication_style=4,
            humor_level=6,
            conversational_depth=8,
            chaos_factor=3,
            intellectual_angle="Skeptical",
            expertise_tags=["Philosophy", "Psychology"],
        )

    # Trait description tests
    def test_get_trait_description_low(self, builder):
        """Low tone values describe calm energy."""
        desc = builder._get_trait_description(2, builder.TONE_MAP)
        assert "calm" in desc.lower()

    def test_get_trait_description_mid(self, builder):
        """Mid tone values describe balanced energy."""
        desc = builder._get_trait_description(5, builder.TONE_MAP)
        assert "balanced" in desc.lower()

    def test_get_trait_description_high(self, builder):
        """High tone values describe energetic delivery."""
        desc = builder._get_trait_description(8, builder.TONE_MAP)
        assert "enthusiastic" in desc.lower() or "energetic" in desc.lower()

    def test_get_trait_description_extreme(self, builder):
        """Extreme tone value (9) describes peak energy."""
        desc = builder._get_trait_description(9, builder.TONE_MAP)
        assert "ELECTRIC" in desc

    def test_trait_descriptions_distinct_per_value(self, builder):
        """Every slider value 1-10 produces a distinct description."""
        for trait_map in (
            builder.TONE_MAP, builder.COMMUNICATION_MAP, builder.HUMOR_MAP,
            builder.DEPTH_MAP, builder.CHAOS_MAP, builder.SENTENCE_STRUCTURE_MAP,
            builder.EMOTIONAL_EXPRESSION_MAP, builder.VIEWPOINT_BEHAVIOR_MAP,
        ):
            descs = [builder._get_trait_description(v, trait_map) for v in range(1, 11)]
            assert len(set(descs)) == 10

    def test_trait_description_clamps_out_of_range(self, builder):
        """Out-of-range values clamp to nearest endpoint without error."""
        assert builder._get_trait_description(0, builder.TONE_MAP) == builder.TONE_MAP[1]
        assert builder._get_trait_description(11, builder.TONE_MAP) == builder.TONE_MAP[10]

    # Personality description tests
    def test_build_personality_description(self, builder, sample_personality):
        """Test building complete personality description."""
        desc = builder.build_personality_description(sample_personality)

        assert "Speaking style:" in desc
        assert "Communication approach:" in desc
        assert "Humor:" in desc
        assert "Depth:" in desc
        assert "Flow:" in desc
        assert "Sentence shape:" in desc
        assert "Emotional delivery:" in desc
        assert "Stance toward the book:" in desc
        assert "Skeptical" in desc
        # Expertise tags are now handled by build_genre_and_expertise_instructions()
        assert "Areas of expertise" not in desc

    def test_build_personality_description_without_optional(self, builder):
        """Test personality description without optional fields."""
        personality = PodcasterPersonality(
            tone=5,
            communication_style=5,
            humor_level=5,
            conversational_depth=5,
            chaos_factor=5,
        )

        desc = builder.build_personality_description(personality)

        assert "Speaking style:" in desc
        assert "Intellectual lens:" not in desc
        assert "Areas of expertise:" not in desc

    # Episode type instructions tests
    def test_episode_type_monologue(self, builder):
        """Test monologue instructions."""
        instructions = builder.build_episode_type_instructions("MONOLOGUE")

        assert "Single host" in instructions
        assert "continuous prose" in instructions.lower() or "no speaker labels" in instructions.lower()

    def test_episode_type_duo(self, builder):
        """Test duo instructions."""
        instructions = builder.build_episode_type_instructions("DUO")

        assert "HOST" in instructions
        assert "GUEST" in instructions
        assert "teacher" in instructions.lower() or "two" in instructions.lower()

    # Episode theme instructions tests
    def test_episode_theme_lecture(self, builder):
        """Test lecture theme instructions."""
        instructions = builder.build_theme_instructions("LECTURE")

        assert "Educational" in instructions or "educational" in instructions.lower()
        assert "teach" in instructions.lower() or "informative" in instructions.lower()

    def test_episode_theme_discussion(self, builder):
        """Test discussion theme instructions."""
        instructions = builder.build_theme_instructions("DISCUSSION")

        assert "Exploratory" in instructions or "conversation" in instructions.lower()

    def test_episode_theme_debate(self, builder):
        """Test debate theme instructions."""
        instructions = builder.build_theme_instructions("DEBATE", episode_type="DUO")

        assert "argumentative" in instructions.lower() or "opposing" in instructions.lower()

    # Target word calculation tests
    def test_calculate_target_words(self, builder):
        """Test word count calculation."""
        # 15-25 minutes, aims for MIDPOINT: 20 minutes at 150 wpm = 3000 words
        words = builder.calculate_target_words(15, 25, 150)
        assert words == 3000

    def test_calculate_target_words_short(self, builder):
        """Test word count for short episode."""
        # 5-10 minutes, aims for MIDPOINT: 7.5 minutes at 150 wpm = 1125 words
        words = builder.calculate_target_words(5, 10, 150)
        assert words == 1125

    # Full prompt building tests
    def test_build_prompt_complete(self, builder, sample_personality):
        """Test building complete prompt."""
        request = ScriptRequest(
            book_content="This is the book content about philosophy.",
            book_title="The Great Philosophy",
            book_author="John Smith",
            episode_title="Understanding Stoicism",
            podcaster_name="Phil the Philosopher",
            podcaster_personality=sample_personality,
            episode_type="MONOLOGUE",
            episode_theme="LECTURE",
            target_length_min=15,
            target_length_max=25,
        )

        prompt, cohost_archetype = builder.build_prompt(request)

        # Check all components are present
        assert "Phil the Philosopher" in prompt
        assert "The Great Philosophy" in prompt
        assert "John Smith" in prompt
        assert "Understanding Stoicism" in prompt
        assert "This is the book content" in prompt
        assert "15-25 minutes" in prompt or "3000 words" in prompt
        # MONOLOGUE should not produce a cohost archetype
        assert cohost_archetype is None

    def test_build_prompt_without_author(self, builder, sample_personality):
        """Test building prompt without author."""
        request = ScriptRequest(
            book_content="Book content here.",
            book_title="Mystery Book",
            book_author=None,
            episode_title="Episode One",
            podcaster_name="Host Name",
            podcaster_personality=sample_personality,
            episode_type="DUO",
            episode_theme="DISCUSSION",
            target_length_min=10,
            target_length_max=15,
        )

        prompt, cohost_archetype = builder.build_prompt(request)

        assert "Mystery Book" in prompt
        assert " by " not in prompt.split("Mystery Book")[1].split("\n")[0]
        # DUO should produce a cohost archetype
        assert cohost_archetype is not None


class TestPodcasterPersonality:
    """Test cases for PodcasterPersonality dataclass."""

    def test_personality_creation_full(self):
        """Test creating personality with all fields."""
        personality = PodcasterPersonality(
            tone=7,
            communication_style=4,
            humor_level=6,
            conversational_depth=8,
            chaos_factor=3,
            intellectual_angle="Pragmatic",
            expertise_tags=["Science", "Technology"],
        )

        assert personality.tone == 7
        assert personality.communication_style == 4
        assert personality.intellectual_angle == "Pragmatic"
        assert len(personality.expertise_tags) == 2

    def test_personality_creation_minimal(self):
        """Test creating personality with minimal fields."""
        personality = PodcasterPersonality(
            tone=5,
            communication_style=5,
            humor_level=5,
            conversational_depth=5,
            chaos_factor=5,
        )

        assert personality.tone == 5
        assert personality.intellectual_angle is None
        assert personality.expertise_tags is None


class TestGenreAndExpertiseInstructions:
    """Test cases for genre-aware, expertise-weighted instructions."""

    @pytest.fixture
    def builder(self):
        """Create PromptBuilder instance."""
        return PromptBuilder()

    def test_genre_with_expertise(self, builder):
        """Genre + expertise produces both sections."""
        result = builder.build_genre_and_expertise_instructions(
            book_genres=["Business & Economics"],
            expertise_tags=["Business", "Finance"],
            book_title="The Lean Startup",
        )
        assert "BOOK GENRE" in result
        assert "Business & Economics" in result
        assert "EXPERTISE WEIGHTING" in result
        assert "High overlap" in result

    def test_genre_without_expertise(self, builder):
        """Genre with no expertise tags only shows genre section."""
        result = builder.build_genre_and_expertise_instructions(
            book_genres=["Fiction / Fantasy"],
            expertise_tags=None,
            book_title="The Name of the Wind",
        )
        assert "BOOK GENRE" in result
        assert "Fiction / Fantasy" in result
        assert "EXPERTISE" not in result

    def test_no_genre_with_expertise(self, builder):
        """No genre but expertise present gives fallback + expertise."""
        result = builder.build_genre_and_expertise_instructions(
            book_genres=None,
            expertise_tags=["Philosophy"],
            book_title="Unknown Book",
        )
        assert "No genre information" in result
        assert "Philosophy" in result
        assert "YOUR EXPERTISE" in result

    def test_no_genre_no_expertise(self, builder):
        """Neither genre nor expertise gives fallback only."""
        result = builder.build_genre_and_expertise_instructions(
            book_genres=None,
            expertise_tags=None,
            book_title="Unknown Book",
        )
        assert "No genre information" in result
        assert "EXPERTISE" not in result

    def test_empty_genres_treated_as_no_genre(self, builder):
        """Empty genre list is treated as no genre."""
        result = builder.build_genre_and_expertise_instructions(
            book_genres=[],
            expertise_tags=["Business"],
            book_title="Test Book",
        )
        assert "No genre information" in result

    def test_genre_in_full_prompt(self, builder):
        """Genre section appears in complete build_prompt output."""
        personality = PodcasterPersonality(
            tone=5, communication_style=5, humor_level=5,
            conversational_depth=5, chaos_factor=5,
            expertise_tags=["Business"],
        )
        request = ScriptRequest(
            book_content="Content about fantasy worlds...",
            book_title="Test Book",
            book_author="Author",
            episode_title="Episode",
            podcaster_name="Host",
            podcaster_personality=personality,
            episode_type="MONOLOGUE",
            episode_theme="LECTURE",
            target_length_min=10,
            target_length_max=15,
            book_genres=["Fiction / Fantasy"],
        )
        prompt, _ = builder.build_prompt(request)
        assert "BOOK GENRE" in prompt
        assert "Fiction / Fantasy" in prompt
        assert "EXPERTISE WEIGHTING" in prompt
