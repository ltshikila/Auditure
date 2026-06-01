"""Unit tests for the forced-alignment text helpers.

These cover the deterministic, torch-free logic: script -> display lines,
word normalization to the model vocab, regrouping spans, and assembling the
final segment list (gap-filling + monotonic ordering). The torch-backed
alignment itself is exercised in integration/manual runs, not here.
"""

import pytest

from src.tts.alignment.aligner import (
    _unflatten,
    assemble_segments,
    normalize_word,
    split_into_lines,
)


class TestNormalizeWord:
    def test_uppercases_and_keeps_letters(self):
        assert normalize_word("Hello") == "HELLO"

    def test_strips_punctuation(self):
        assert normalize_word("world,") == "WORLD"
        assert normalize_word("(yes)") == "YES"

    def test_keeps_internal_apostrophe(self):
        assert normalize_word("don't") == "DON'T"

    def test_strips_surrounding_quotes_but_keeps_word(self):
        # A leading/trailing apostrophe (smart-quote artifact) is trimmed.
        assert normalize_word("'hello'") == "HELLO"

    def test_strips_accents(self):
        assert normalize_word("café") == "CAFE"

    def test_digits_only_becomes_empty(self):
        assert normalize_word("2024") == ""

    def test_symbol_only_becomes_empty(self):
        assert normalize_word("—") == ""


class TestSplitIntoLines:
    def test_splits_on_sentence_boundaries(self):
        lines = split_into_lines("Hello there. How are you? I am fine!")
        assert lines == ["Hello there.", "How are you?", "I am fine!"]

    def test_strips_bracket_markup(self):
        lines = split_into_lines("Welcome [pause] to the show.")
        assert lines == ["Welcome to the show."]
        assert "[" not in lines[0]

    def test_strips_leading_speaker_labels(self):
        lines = split_into_lines("HOST: Welcome back. GUEST: Glad to be here.")
        assert lines[0] == "Welcome back."
        assert lines[1] == "Glad to be here."
        assert all("HOST" not in line and "GUEST" not in line for line in lines)

    def test_long_sentence_split_at_clauses(self):
        long_sentence = (
            "This is a very long sentence, which keeps going and going, "
            "well beyond the comfortable length, so it should be broken up."
        )
        lines = split_into_lines(long_sentence)
        assert len(lines) > 1
        assert all(len(line) <= 100 for line in lines)

    def test_empty_script_returns_empty(self):
        assert split_into_lines("") == []
        assert split_into_lines("   \n  ") == []

    def test_short_sentence_kept_whole(self):
        assert split_into_lines("A short line.") == ["A short line."]


class TestUnflatten:
    def test_regroups_by_lengths(self):
        assert _unflatten([1, 2, 3, 4, 5], [2, 1, 2]) == [[1, 2], [3], [4, 5]]

    def test_empty(self):
        assert _unflatten([], []) == []

    def test_zero_length_group(self):
        assert _unflatten([1, 2], [0, 2]) == [[], [1, 2]]


class TestAssembleSegments:
    def test_basic_passthrough(self):
        lines = ["one", "two"]
        segments = assemble_segments(lines, {0: 0.0, 1: 1.5}, {0: 1.4, 1: 3.0})
        assert segments == [
            {"text": "one", "start": 0.0, "end": 1.4},
            {"text": "two", "start": 1.5, "end": 3.0},
        ]

    def test_monotonic_non_decreasing(self):
        # Even if raw times overlap/regress, output never goes backwards.
        lines = ["a", "b", "c"]
        segments = assemble_segments(
            lines, {0: 0.0, 1: 2.0, 2: 1.0}, {0: 2.5, 1: 3.0, 2: 4.0}
        )
        starts = [s["start"] for s in segments]
        ends = [s["end"] for s in segments]
        assert starts == sorted(starts)
        for seg in segments:
            assert seg["end"] >= seg["start"]

    def test_fills_gap_for_untimed_line(self):
        # Middle line has no timing (e.g. a number-only line) -> inherits neighbours.
        lines = ["first", "123", "third"]
        segments = assemble_segments(lines, {0: 0.0, 2: 5.0}, {0: 2.0, 2: 7.0})
        # The untimed middle line should sit between its neighbours, in order.
        assert segments[1]["start"] >= segments[0]["start"]
        assert segments[2]["start"] >= segments[1]["start"]
        assert len(segments) == 3

    def test_rounds_to_milliseconds(self):
        segments = assemble_segments(["x"], {0: 1.23456}, {0: 2.98765})
        assert segments[0]["start"] == 1.235
        assert segments[0]["end"] == 2.988

    def test_empty_lines(self):
        assert assemble_segments([], {}, {}) == []
