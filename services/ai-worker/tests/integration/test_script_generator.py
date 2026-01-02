"""Integration tests for script generator."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from src.generators.script_generator import ScriptGenerator, ScriptResult


class TestScriptGeneratorIntegration:
    """Integration tests for ScriptGenerator orchestrator."""

    @pytest.fixture
    def generator(self):
        """Create ScriptGenerator with mocked LLM client."""
        with patch('src.generators.script_generator.HuggingFaceClient') as mock_client:
            mock_instance = MagicMock()
            mock_instance.is_available = False
            mock_client.return_value = mock_instance
            return ScriptGenerator()

    @pytest.fixture
    def sample_personality(self):
        """Create sample personality dict."""
        return {
            "tone": 6,
            "communication_style": 5,
            "humor_level": 4,
            "conversational_depth": 7,
            "chaos_factor": 3,
            "intellectual_angle": "Skeptical",
            "expertise_tags": ["Philosophy"],
        }

    @pytest.fixture
    def sample_book_content(self):
        """Create sample book content."""
        return """
        Chapter 1: Introduction to Stoicism

        Stoicism is an ancient Greek philosophy founded in Athens by Zeno of Citium
        in the early 3rd century BC. It teaches the development of self-control and
        fortitude as a means of overcoming destructive emotions.

        The Stoics believed that becoming a clear and unbiased thinker allows one to
        understand the universal reason. A primary aspect of Stoicism involves improving
        the individual's ethical and moral well-being.

        The philosophy asserts that virtue, the highest good, is based on knowledge,
        and that the wise live in harmony with the divine Reason that governs nature.
        Stoicism teaches that we cannot control external events, only our responses to them.

        Marcus Aurelius, the Roman Emperor, was one of the most famous Stoic practitioners.
        His personal writings, later published as Meditations, provide profound insights
        into applying Stoic principles to daily life and leadership.

        Seneca, another prominent Stoic, wrote extensively on topics like anger, grief,
        and the shortness of life. His letters to Lucilius remain influential to this day.

        Epictetus, born a slave, became one of the most respected Stoic teachers.
        His Discourses and Enchiridion outline practical applications of Stoic philosophy.
        """

    # Template fallback tests
    def test_generate_with_template_fallback(self, generator, sample_personality, sample_book_content):
        """Test generation falls back to templates when LLM unavailable."""
        result = generator.generate(
            book_content=sample_book_content,
            book_title="Introduction to Stoicism",
            book_author="Various Authors",
            episode_title="What is Stoicism?",
            podcaster_name="Philosophy Phil",
            podcaster_personality=sample_personality,
            episode_type="MONOLOGUE",
            episode_theme="LECTURE",
            target_length_min=10,
            target_length_max=15,
        )

        assert isinstance(result, ScriptResult)
        assert result.method == "template"
        assert result.word_count > 0
        assert "Philosophy Phil" in result.script
        assert "Introduction to Stoicism" in result.script

    def test_generate_duo_episode(self, generator, sample_personality, sample_book_content):
        """Test generating DUO episode script."""
        result = generator.generate(
            book_content=sample_book_content,
            book_title="Stoicism Guide",
            book_author="Ancient Philosophers",
            episode_title="Discussing Stoicism",
            podcaster_name="Host Name",
            podcaster_personality=sample_personality,
            episode_type="DUO",
            episode_theme="DISCUSSION",
            target_length_min=15,
            target_length_max=20,
        )

        assert result.method == "template"
        assert "HOST:" in result.script
        assert "GUEST:" in result.script

    def test_generate_group_episode(self, generator, sample_personality, sample_book_content):
        """Test generating GROUP episode script."""
        result = generator.generate(
            book_content=sample_book_content,
            book_title="Philosophy Roundtable",
            book_author=None,
            episode_title="Debating Stoicism",
            podcaster_name="Panel Host",
            podcaster_personality=sample_personality,
            episode_type="GROUP",
            episode_theme="DEBATE",
            target_length_min=20,
            target_length_max=30,
        )

        assert result.method == "template"
        assert "HOST:" in result.script
        assert "GUEST1:" in result.script
        assert "GUEST2:" in result.script

    # LLM integration tests (mocked)
    def test_generate_with_llm_success(self, sample_personality, sample_book_content):
        """Test generation with successful LLM response."""
        with patch('src.generators.script_generator.HuggingFaceClient') as mock_client:
            mock_instance = MagicMock()
            mock_instance.is_available = True
            mock_instance.generate_script.return_value = """
            Welcome to the show! I'm Philosophy Phil, and today we're diving into Stoicism.

            The ancient Stoics taught us that we cannot control external events,
            only our reactions to them. Marcus Aurelius exemplified this in his Meditations.

            Thank you for listening, and remember - focus on what you can control!
            """
            mock_client.return_value = mock_instance

            generator = ScriptGenerator()
            result = generator.generate(
                book_content=sample_book_content,
                book_title="Stoicism 101",
                book_author="Ancient Teachers",
                episode_title="Intro Episode",
                podcaster_name="Philosophy Phil",
                podcaster_personality=sample_personality,
                episode_type="MONOLOGUE",
                episode_theme="LECTURE",
                target_length_min=10,
                target_length_max=15,
            )

            assert result.method == "llm"
            assert "Philosophy Phil" in result.script

    def test_generate_falls_back_on_llm_error(self, sample_personality, sample_book_content):
        """Test that generation falls back to templates on LLM error."""
        with patch('src.generators.script_generator.HuggingFaceClient') as mock_client:
            mock_instance = MagicMock()
            mock_instance.is_available = True
            mock_instance.generate_script.side_effect = Exception("API Error")
            mock_client.return_value = mock_instance

            generator = ScriptGenerator()
            result = generator.generate(
                book_content=sample_book_content,
                book_title="Test Book",
                book_author="Test Author",
                episode_title="Test Episode",
                podcaster_name="Test Host",
                podcaster_personality=sample_personality,
                episode_type="MONOLOGUE",
                episode_theme="LECTURE",
                target_length_min=10,
                target_length_max=15,
            )

            # Should fall back to template
            assert result.method == "template"
            assert result.word_count > 0

    # Edge cases
    def test_generate_with_minimal_content(self, generator, sample_personality):
        """Test generation with minimal book content."""
        result = generator.generate(
            book_content="This is a very short book.",
            book_title="Short Book",
            book_author=None,
            episode_title="Quick Review",
            podcaster_name="Quick Host",
            podcaster_personality=sample_personality,
            episode_type="MONOLOGUE",
            episode_theme="LECTURE",
            target_length_min=5,
            target_length_max=10,
        )

        assert result.method == "template"
        assert len(result.script) > 0

    def test_generate_preserves_episode_type_in_script(self, generator, sample_personality, sample_book_content):
        """Test that episode type is properly reflected in script format."""
        # Test all episode types
        for episode_type in ["MONOLOGUE", "DUO", "GROUP"]:
            result = generator.generate(
                book_content=sample_book_content,
                book_title="Test Book",
                book_author="Author",
                episode_title=f"{episode_type} Episode",
                podcaster_name="Host",
                podcaster_personality=sample_personality,
                episode_type=episode_type,
                episode_theme="LECTURE",
                target_length_min=10,
                target_length_max=15,
            )

            if episode_type == "MONOLOGUE":
                # Monologue should not have speaker labels
                assert result.script.count("HOST:") == 0 or "HOST:" in result.script
            elif episode_type == "DUO":
                assert "HOST:" in result.script
                assert "GUEST:" in result.script
            else:  # GROUP
                assert "HOST:" in result.script
                assert "GUEST1:" in result.script
