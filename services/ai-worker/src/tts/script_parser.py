"""Script parser for multi-voice episodes."""

import logging
import re
from dataclasses import dataclass
from typing import List

logger = logging.getLogger(__name__)


@dataclass
class SpeakerSegment:
    """A segment of script with speaker identification."""

    speaker: str
    text: str


class ScriptParser:
    """Parse podcast scripts into speaker segments."""

    # Pattern to match speaker labels like "HOST:", "GUEST1:", "SPEAKER2:", etc.
    SPEAKER_PATTERN = re.compile(
        r"^(HOST\d?|GUEST\d?|SPEAKER\d?|NARRATOR):\s*",
        re.IGNORECASE | re.MULTILINE,
    )

    def parse(
        self,
        script: str,
        episode_type: str,
    ) -> List[SpeakerSegment]:
        """
        Parse script into speaker segments.

        For MONOLOGUE: Returns single segment with all text.
        For DUO/GROUP: Parses speaker labels or alternates by paragraph.

        Args:
            script: The podcast script text
            episode_type: MONOLOGUE, DUO, or GROUP

        Returns:
            List of SpeakerSegment objects
        """
        if episode_type == "MONOLOGUE":
            return self._parse_monologue(script)

        # Try to parse speaker labels
        segments = self._parse_labeled_script(script)

        if len(segments) > 1:
            return segments

        # No labels found, alternate by paragraphs
        logger.info("No speaker labels found, alternating by paragraphs")
        return self._parse_by_paragraphs(script, episode_type)

    def _parse_monologue(self, script: str) -> List[SpeakerSegment]:
        """Parse monologue script (single speaker)."""
        # Remove any speaker labels that might be present
        clean_script = self.SPEAKER_PATTERN.sub("", script)
        clean_script = clean_script.strip()

        return [SpeakerSegment(speaker="HOST", text=clean_script)]

    def _parse_labeled_script(self, script: str) -> List[SpeakerSegment]:
        """Parse script with speaker labels."""
        segments: List[SpeakerSegment] = []

        # Split by speaker pattern while keeping the delimiter
        parts = self.SPEAKER_PATTERN.split(script)

        # Parts will be: [text_before, speaker1, text1, speaker2, text2, ...]
        # Skip any text before first speaker label
        i = 0
        while i < len(parts):
            part = parts[i].strip()

            # Check if this part is a speaker label
            if self._is_speaker_label(part):
                speaker = part.upper()
                # Next part is the text
                if i + 1 < len(parts):
                    text = parts[i + 1].strip()
                    if text:
                        segments.append(SpeakerSegment(speaker=speaker, text=text))
                    i += 2
                else:
                    i += 1
            else:
                i += 1

        return segments

    def _is_speaker_label(self, text: str) -> bool:
        """Check if text is a speaker label."""
        text = text.upper().strip()
        return bool(re.match(r"^(HOST\d?|GUEST\d?|SPEAKER\d?|NARRATOR)$", text))

    def _parse_by_paragraphs(
        self,
        script: str,
        episode_type: str,
    ) -> List[SpeakerSegment]:
        """Parse script by alternating paragraphs between speakers."""
        segments: List[SpeakerSegment] = []

        # Define speakers based on episode type
        if episode_type == "DUO":
            speakers = ["HOST", "GUEST"]
        else:  # GROUP
            speakers = ["HOST", "GUEST1", "GUEST2"]

        # Split into paragraphs
        paragraphs = [p.strip() for p in script.split("\n\n") if p.strip()]

        # If very few paragraphs, try splitting by single newlines
        if len(paragraphs) < 3:
            paragraphs = [p.strip() for p in script.split("\n") if p.strip()]

        for i, paragraph in enumerate(paragraphs):
            speaker = speakers[i % len(speakers)]
            segments.append(SpeakerSegment(speaker=speaker, text=paragraph))

        return segments

    def get_unique_speakers(self, segments: List[SpeakerSegment]) -> List[str]:
        """Get list of unique speakers in order of appearance."""
        seen = set()
        speakers = []
        for segment in segments:
            if segment.speaker not in seen:
                seen.add(segment.speaker)
                speakers.append(segment.speaker)
        return speakers

    def estimate_duration(
        self,
        segments: List[SpeakerSegment],
        words_per_minute: int = 150,
    ) -> int:
        """
        Estimate total duration in seconds.

        Args:
            segments: List of speaker segments
            words_per_minute: Speaking rate

        Returns:
            Estimated duration in seconds
        """
        total_words = sum(len(seg.text.split()) for seg in segments)
        minutes = total_words / words_per_minute
        return int(minutes * 60)
