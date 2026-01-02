"""Unit tests for script parser."""

import pytest
from src.tts.script_parser import ScriptParser, SpeakerSegment


class TestScriptParser:
    """Test cases for ScriptParser class."""

    @pytest.fixture
    def parser(self):
        """Create ScriptParser instance."""
        return ScriptParser()

    # Monologue parsing tests
    def test_parse_monologue_single_segment(self, parser):
        """Test parsing monologue returns single segment."""
        script = "Welcome to the show. Today we discuss an amazing book."
        segments = parser.parse(script, "MONOLOGUE")

        assert len(segments) == 1
        assert segments[0].speaker == "HOST"
        assert "Welcome to the show" in segments[0].text

    def test_parse_monologue_strips_labels(self, parser):
        """Test that monologue strips any speaker labels."""
        script = "HOST: Welcome to the show.\nThis is great content."
        segments = parser.parse(script, "MONOLOGUE")

        assert len(segments) == 1
        assert "HOST:" not in segments[0].text

    # Labeled script parsing tests
    def test_parse_labeled_duo_script(self, parser):
        """Test parsing DUO script with labels."""
        script = """HOST: Welcome to the show!
GUEST: Thanks for having me.
HOST: Let's talk about the book.
GUEST: It's a fantastic read."""

        segments = parser.parse(script, "DUO")

        assert len(segments) == 4
        assert segments[0].speaker == "HOST"
        assert segments[1].speaker == "GUEST"
        assert segments[2].speaker == "HOST"
        assert segments[3].speaker == "GUEST"

    def test_parse_labeled_group_script(self, parser):
        """Test parsing GROUP script with labels."""
        script = """HOST: Welcome everyone!
GUEST1: Happy to be here.
GUEST2: Same here!
HOST: Let's dive in."""

        segments = parser.parse(script, "GROUP")

        assert len(segments) == 4
        speakers = [s.speaker for s in segments]
        assert "HOST" in speakers
        assert "GUEST1" in speakers
        assert "GUEST2" in speakers

    def test_parse_case_insensitive_labels(self, parser):
        """Test that parsing handles case-insensitive labels."""
        script = """host: Welcome!
Guest: Thanks!"""

        segments = parser.parse(script, "DUO")

        assert len(segments) >= 2

    # Unlabeled script parsing tests
    def test_parse_unlabeled_duo_alternates(self, parser):
        """Test that unlabeled DUO alternates HOST/GUEST."""
        script = """First paragraph here.

Second paragraph here.

Third paragraph here."""

        segments = parser.parse(script, "DUO")

        assert len(segments) == 3
        assert segments[0].speaker == "HOST"
        assert segments[1].speaker == "GUEST"
        assert segments[2].speaker == "HOST"

    def test_parse_unlabeled_group_cycles_speakers(self, parser):
        """Test that unlabeled GROUP cycles through speakers."""
        script = """First paragraph.

Second paragraph.

Third paragraph.

Fourth paragraph."""

        segments = parser.parse(script, "GROUP")

        speakers = [s.speaker for s in segments]
        assert speakers == ["HOST", "GUEST1", "GUEST2", "HOST"]

    # Helper method tests
    def test_get_unique_speakers(self, parser):
        """Test getting unique speakers in order."""
        segments = [
            SpeakerSegment(speaker="HOST", text="Hello"),
            SpeakerSegment(speaker="GUEST", text="Hi"),
            SpeakerSegment(speaker="HOST", text="Welcome"),
            SpeakerSegment(speaker="GUEST", text="Thanks"),
        ]

        speakers = parser.get_unique_speakers(segments)

        assert speakers == ["HOST", "GUEST"]

    def test_get_unique_speakers_group(self, parser):
        """Test getting unique speakers for group."""
        segments = [
            SpeakerSegment(speaker="HOST", text="Hello"),
            SpeakerSegment(speaker="GUEST1", text="Hi"),
            SpeakerSegment(speaker="GUEST2", text="Hey"),
            SpeakerSegment(speaker="HOST", text="Welcome"),
        ]

        speakers = parser.get_unique_speakers(segments)

        assert speakers == ["HOST", "GUEST1", "GUEST2"]

    def test_estimate_duration(self, parser):
        """Test duration estimation."""
        # 150 words = 1 minute = 60 seconds
        segments = [
            SpeakerSegment(speaker="HOST", text=" ".join(["word"] * 150))
        ]

        duration = parser.estimate_duration(segments, words_per_minute=150)

        assert duration == 60

    def test_estimate_duration_multiple_segments(self, parser):
        """Test duration estimation with multiple segments."""
        segments = [
            SpeakerSegment(speaker="HOST", text=" ".join(["word"] * 75)),
            SpeakerSegment(speaker="GUEST", text=" ".join(["word"] * 75)),
        ]

        duration = parser.estimate_duration(segments, words_per_minute=150)

        assert duration == 60


class TestSpeakerSegment:
    """Test cases for SpeakerSegment dataclass."""

    def test_speaker_segment_creation(self):
        """Test SpeakerSegment creation."""
        segment = SpeakerSegment(
            speaker="HOST",
            text="Welcome to the show!",
        )

        assert segment.speaker == "HOST"
        assert segment.text == "Welcome to the show!"
