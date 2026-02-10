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
        """Test low value trait description."""
        desc = builder._get_trait_description(2, builder.TONE_MAP)
        assert desc == "calm, measured, and thoughtful"

    def test_get_trait_description_mid(self, builder):
        """Test mid value trait description."""
        desc = builder._get_trait_description(5, builder.TONE_MAP)
        assert desc == "balanced and conversational"

    def test_get_trait_description_high(self, builder):
        """Test high value trait description."""
        desc = builder._get_trait_description(9, builder.TONE_MAP)
        assert desc == "energetic, enthusiastic, and dynamic"

    # Personality description tests
    def test_build_personality_description(self, builder, sample_personality):
        """Test building complete personality description."""
        desc = builder.build_personality_description(sample_personality)

        assert "Speaking style:" in desc
        assert "Communication approach:" in desc
        assert "Humor:" in desc
        assert "Depth:" in desc
        assert "Flow:" in desc
        assert "Skeptical" in desc
        assert "Philosophy" in desc

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
        assert "Two-person" in instructions or "two" in instructions.lower()

    def test_episode_type_group(self, builder):
        """Test group instructions."""
        instructions = builder.build_episode_type_instructions("GROUP")

        assert "GUEST" in instructions
        assert "HOST" in instructions

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
        instructions = builder.build_theme_instructions("DEBATE")

        assert "Argumentative" in instructions or "perspectives" in instructions.lower()

    # Target word calculation tests
    def test_calculate_target_words(self, builder):
        """Test word count calculation."""
        # 15-25 minutes, always aims for MAX duration: 25 minutes at 150 wpm = 3750 words
        words = builder.calculate_target_words(15, 25, 150)
        assert words == 3750

    def test_calculate_target_words_short(self, builder):
        """Test word count for short episode."""
        # 5-10 minutes, always aims for MAX duration: 10 minutes at 150 wpm = 1500 words
        words = builder.calculate_target_words(5, 10, 150)
        assert words == 1500

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

        prompt = builder.build_prompt(request)

        # Check all components are present
        assert "Phil the Philosopher" in prompt
        assert "The Great Philosophy" in prompt
        assert "John Smith" in prompt
        assert "Understanding Stoicism" in prompt
        assert "This is the book content" in prompt
        assert "15-25 minutes" in prompt or "3000 words" in prompt

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

        prompt = builder.build_prompt(request)

        assert "Mystery Book" in prompt
        assert " by " not in prompt.split("Mystery Book")[1].split("\n")[0]


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
