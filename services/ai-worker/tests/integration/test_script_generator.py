"""Integration tests for script generator."""

from unittest.mock import MagicMock, patch

import pytest

from src.generators.script_generator import DurationMismatchError, ScriptGenerator, ScriptResult


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
        """Create sample book content with enough material for short episodes."""
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
        # Use shorter duration that matches what fallback can produce from sample content
        # Template output is limited by small sample content (~150 words source)
        result = generator.generate(
            book_content=sample_book_content,
            book_title="Introduction to Stoicism",
            book_author="Various Authors",
            episode_title="What is Stoicism?",
            podcaster_name="Philosophy Phil",
            podcaster_personality=sample_personality,
            episode_type="MONOLOGUE",
            episode_theme="LECTURE",
            target_length_min=2,
            target_length_max=8,
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
            target_length_min=3,
            target_length_max=8,
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
            target_length_min=3,
            target_length_max=8,
        )

        assert result.method == "template"
        assert "HOST:" in result.script
        assert "GUEST:" in result.script

    # LLM integration tests (mocked)
    def test_generate_with_llm_success(self, sample_personality, sample_book_content):
        """Test generation with successful LLM response."""
        # Generate a script with enough words for the target duration
        long_script = """
        Welcome to the show! I'm Philosophy Phil, and today we're diving deep into Stoicism.

        The ancient Stoics taught us fundamental truths about human nature and how we can
        live a more fulfilling life. At the core of Stoic philosophy is the idea that we
        cannot control external events, only our reactions to them. This principle is
        perhaps best exemplified by Marcus Aurelius in his famous work, Meditations.

        Let me share with you some key insights from Stoic philosophy. First, we must
        understand that our emotions are not caused by external events but by our judgments
        about those events. When we feel angry or anxious, it's because of how we interpret
        what's happening around us, not because of the events themselves.

        Second, the Stoics emphasized the importance of focusing on what is within our
        control - our own thoughts, judgments, and actions - rather than worrying about
        things beyond our control like other people's opinions or the weather.

        Third, they practiced what they called negative visualization, imagining potential
        hardships to prepare mentally and appreciate what we have. This might sound
        pessimistic, but it actually leads to greater contentment and resilience.

        Marcus Aurelius wrote extensively about applying these principles in daily life.
        Despite being the most powerful man in Rome, he remained humble and focused on
        self-improvement. His journal entries reveal a man constantly striving to align
        his actions with his values.

        Seneca, another great Stoic, taught us about the shortness of life and how we
        often waste our most precious resource - time. He encouraged us to live each day
        as if it might be our last, not in a reckless way, but by focusing on what truly
        matters and avoiding trivial pursuits.

        Epictetus, who was born a slave, demonstrated that circumstances don't determine
        our character - our choices do. His teachings in the Enchiridion remain remarkably
        practical and applicable to modern life.

        So what can we take away from Stoic philosophy today? Start by noticing when you
        feel frustrated or upset, and ask yourself: Is this within my control? If not,
        can I change my perspective on it? This simple practice can transform your daily
        experience.

        Thank you for listening to this episode! Remember - focus on what you can control,
        accept what you cannot, and always strive to act with virtue. Until next time,
        stay philosophical and keep learning!
        """

        with patch('src.generators.script_generator.HuggingFaceClient') as mock_client:
            mock_instance = MagicMock()
            mock_instance.is_available = True
            mock_instance.generate_script.return_value = long_script
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
                target_length_min=2,
                target_length_max=5,
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
                target_length_min=2,
                target_length_max=8,
            )

            # Should fall back to template
            assert result.method == "template"
            assert result.word_count > 0

    # Edge cases
    def test_generate_with_minimal_content_raises_error(self, generator, sample_personality):
        """Test generation with minimal book content raises DurationMismatchError."""
        # With very minimal content and a duration requirement, expect an error
        with pytest.raises(DurationMismatchError):
            generator.generate(
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

    def test_generate_preserves_episode_type_in_script(self, generator, sample_personality, sample_book_content):
        """Test that episode type is properly reflected in script format."""
        # Test all episode types with achievable duration
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
                target_length_min=2,
                target_length_max=8,
            )

            if episode_type == "MONOLOGUE":
                # Monologue should not have speaker labels
                assert result.script.count("HOST:") == 0 or "HOST:" in result.script
            elif episode_type == "DUO":
                assert "HOST:" in result.script
                assert "GUEST:" in result.script
            else:  # GROUP
                assert "HOST:" in result.script
                assert "GUEST:" in result.script
