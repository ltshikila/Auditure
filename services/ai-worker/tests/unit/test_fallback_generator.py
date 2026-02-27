"""Unit tests for fallback template generator."""

import pytest

from src.generators.templates.fallback_generator import FallbackGenerator, FallbackRequest


class TestFallbackGenerator:
    """Test cases for FallbackGenerator class."""

    @pytest.fixture
    def generator(self):
        """Create FallbackGenerator instance."""
        return FallbackGenerator()

    @pytest.fixture
    def sample_request(self):
        """Create sample generation request."""
        return FallbackRequest(
            book_content="""
            The philosophy of stoicism teaches us to focus on what we can control.
            Marcus Aurelius wrote extensively about accepting fate with grace.
            Seneca emphasized the importance of time and how we spend it.
            Epictetus taught that our reactions determine our experience.
            The dichotomy of control is central to stoic practice.
            Virtue is the only true good according to stoic philosophers.
            External circumstances cannot harm the wise person.
            Daily reflection is a key stoic practice for self-improvement.
            The stoics valued logic and rational thinking above emotions.
            Death was seen as a natural part of life, not something to fear.
            Stoicism influenced many later philosophical movements.
            Modern applications of stoicism include cognitive behavioral therapy.
            """,
            book_title="Meditations",
            book_author="Marcus Aurelius",
            episode_title="Understanding Stoic Philosophy",
            podcaster_name="Philosophy Phil",
            episode_type="MONOLOGUE",
            episode_theme="LECTURE",
            target_word_count=1500,
        )

    # Sentence extraction tests
    def test_extract_key_sentences(self, generator):
        """Test extracting key sentences from content."""
        content = """
        This is a short sentence. This is a much longer sentence that has enough
        words to be considered meaningful for our extraction process. Another short one.
        Here is yet another longer sentence that should definitely be extracted by our
        quality filter because it meets the minimum requirements.
        """

        sentences = generator.extract_key_sentences(content, count=5)

        # Should filter out short sentences
        assert len(sentences) <= 5
        for sentence in sentences:
            assert len(sentence.split()) >= 8

    def test_extract_key_sentences_limited_count(self, generator):
        """Test that extraction respects count limit."""
        content = " ".join([
            f"This is sentence number {i} with enough words to be extracted."
            for i in range(20)
        ])

        sentences = generator.extract_key_sentences(content, count=10)

        assert len(sentences) <= 10

    # Intro generation tests
    def test_generate_intro_monologue(self, generator, sample_request):
        """Test generating monologue intro."""
        intro = generator.generate_intro(sample_request)

        assert "Philosophy Phil" in intro
        assert "Meditations" in intro
        assert "Marcus Aurelius" in intro

    def test_generate_intro_duo(self, generator, sample_request):
        """Test generating duo intro."""
        sample_request.episode_type = "DUO"
        intro = generator.generate_intro(sample_request)

        assert "HOST:" in intro
        assert "GUEST:" in intro
        assert "Philosophy Phil" in intro

    def test_generate_intro_without_author(self, generator, sample_request):
        """Test generating intro without author."""
        sample_request.book_author = None
        intro = generator.generate_intro(sample_request)

        assert "Meditations" in intro
        assert "written by" not in intro

    # Body generation tests
    def test_generate_body_monologue(self, generator, sample_request):
        """Test generating monologue body."""
        sentences = ["First key insight.", "Second key insight."]
        body = generator.generate_body(sample_request, sentences)

        # Should not have speaker labels
        assert "HOST:" not in body
        assert "First key insight" in body

    def test_generate_body_duo(self, generator, sample_request):
        """Test generating duo body."""
        sample_request.episode_type = "DUO"
        sentences = ["First insight.", "Second insight.", "Third insight."]
        body = generator.generate_body(sample_request, sentences)

        assert "HOST:" in body
        assert "GUEST:" in body

    # Conclusion generation tests
    def test_generate_conclusion_monologue(self, generator, sample_request):
        """Test generating monologue conclusion."""
        conclusion = generator.generate_conclusion(sample_request)

        assert "Philosophy Phil" in conclusion
        assert "Meditations" in conclusion

    def test_generate_conclusion_duo(self, generator, sample_request):
        """Test generating duo conclusion."""
        sample_request.episode_type = "DUO"
        conclusion = generator.generate_conclusion(sample_request)

        assert "HOST:" in conclusion
        assert "GUEST:" in conclusion

    # Full script generation tests
    def test_generate_script_complete(self, generator, sample_request):
        """Test generating complete script."""
        script = generator.generate_script(sample_request)

        # Should have intro, body, and conclusion
        assert len(script) > 100
        assert "Philosophy Phil" in script
        assert "Meditations" in script

    def test_generate_script_word_count_scaling(self, generator, sample_request):
        """Test that script scales with target word count."""
        sample_request.target_word_count = 500
        short_script = generator.generate_script(sample_request)

        sample_request.target_word_count = 3000
        long_script = generator.generate_script(sample_request)

        # Longer target should produce longer script
        assert len(long_script) > len(short_script)

    def test_generate_script_minimal_content(self, generator, sample_request):
        """Test generating script with minimal book content."""
        sample_request.book_content = "Short content only."
        script = generator.generate_script(sample_request)

        # Should still produce a valid script
        assert len(script) > 50
        assert "Philosophy Phil" in script


class TestFallbackRequest:
    """Test cases for FallbackRequest dataclass."""

    def test_request_creation(self):
        """Test creating FallbackRequest."""
        request = FallbackRequest(
            book_content="Content here.",
            book_title="Test Book",
            book_author="Test Author",
            episode_title="Test Episode",
            podcaster_name="Test Host",
            episode_type="MONOLOGUE",
            episode_theme="LECTURE",
            target_word_count=1000,
        )

        assert request.book_title == "Test Book"
        assert request.episode_type == "MONOLOGUE"
        assert request.target_word_count == 1000

    def test_request_without_author(self):
        """Test creating request without author."""
        request = FallbackRequest(
            book_content="Content here.",
            book_title="Unknown Book",
            book_author=None,
            episode_title="Mystery Episode",
            podcaster_name="Host",
            episode_type="DUO",
            episode_theme="DISCUSSION",
            target_word_count=2000,
        )

        assert request.book_author is None
