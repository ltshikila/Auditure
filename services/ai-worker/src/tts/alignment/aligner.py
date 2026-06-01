"""Core forced-alignment logic (runs inside the isolated worker subprocess).

Aligns generated audio to the known script using torchaudio's CTC forced
alignment with the English ``WAV2VEC2_ASR_BASE_960H`` model. We already have the
exact words, so this is alignment, not transcription — high accuracy, and the
base English model (~360MB) keeps memory within the worker's 2Gi budget.

torch/torchaudio/numpy are imported lazily inside the functions that need them,
so importing this module (e.g. for unit tests of the text helpers) stays light.
"""

from __future__ import annotations

import io
import logging
import re
import subprocess
import unicodedata
import wave

logger = logging.getLogger(__name__)

# Sample rate expected by the wav2vec2 bundle.
SAMPLE_RATE = 16000

# Process the model over windows of audio to keep peak memory bounded. wav2vec2
# uses full self-attention (O(T^2)), so feeding a full 10+ minute episode in one
# pass would explode memory. 15s windows keep each pass small; we concatenate the
# per-window emissions before aligning. Minor boundary effects are acceptable for
# line-level (sentence) timing.
WINDOW_SECONDS = 15
_MIN_CHUNK_SAMPLES = 400  # pad shorter trailing chunks so the model accepts them

# Lines longer than this get split at clause boundaries so the UI shows
# digestible, karaoke-style lines rather than walls of text.
_MAX_LINE_CHARS = 100

_BRACKET_TAG = re.compile(r"\[[^\]]*\]")
_SPEAKER_LABEL = re.compile(
    r"^(?:HOST|GUEST|NARRATOR|SPEAKER)\d?\s*:\s*", re.IGNORECASE
)
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")
_CLAUSE_SPLIT = re.compile(r"(?<=[,;:])\s+")

# Cached (model, char->index dict) so a backfill run aligning many episodes in
# one process doesn't reload the model each time.
_MODEL = None
_DICT = None


# --------------------------------------------------------------------------- #
# Pure helpers (no torch) — unit-tested directly.
# --------------------------------------------------------------------------- #

def _strip_markup(text: str) -> str:
    """Remove TTS bracket tags like [pause]/[sigh] that aren't spoken words."""
    return _BRACKET_TAG.sub(" ", text)


def normalize_word(word: str) -> str:
    """Reduce a display word to the model's uppercase A-Z (+ apostrophe) vocab.

    Strips accents and any other characters (punctuation, digits). Returns "" for
    words with no alignable letters (e.g. "2024"), which the caller drops from the
    token stream.
    """
    folded = unicodedata.normalize("NFKD", word).encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^A-Z']", "", folded.upper())
    return cleaned.strip("'")


def split_into_lines(script: str) -> list[str]:
    """Split a script into display-sized lines (sentences, clauses if long).

    Mirrors the granularity the mobile transcript wants: roughly one sentence
    per line, with long sentences broken at clause boundaries.
    """
    text = _strip_markup(script)
    lines: list[str] = []

    for raw in _SENTENCE_SPLIT.split(text):
        sentence = _SPEAKER_LABEL.sub("", raw.strip()).strip()
        # Collapse whitespace left behind by stripped markup so display text is clean.
        sentence = re.sub(r"\s+", " ", sentence).strip()
        if not sentence:
            continue

        if len(sentence) <= _MAX_LINE_CHARS:
            lines.append(sentence)
            continue

        # Break long sentences at clause boundaries, packing clauses up to the
        # line length budget.
        buffer = ""
        for clause in _CLAUSE_SPLIT.split(sentence):
            clause = clause.strip()
            if not clause:
                continue
            if buffer and len(buffer) + 1 + len(clause) > _MAX_LINE_CHARS:
                lines.append(buffer)
                buffer = clause
            else:
                buffer = f"{buffer} {clause}".strip()
        if buffer:
            lines.append(buffer)

    return lines


def _unflatten(items: list, lengths: list[int]) -> list[list]:
    """Split a flat list into sublists of the given lengths (in order)."""
    out: list[list] = []
    i = 0
    for length in lengths:
        out.append(items[i:i + length])
        i += length
    return out


def assemble_segments(
    lines: list[str],
    line_start: dict[int, float],
    line_end: dict[int, float],
) -> list[dict]:
    """Build the final segment list, filling timing gaps and enforcing order.

    A line with no alignable words (e.g. only a number) inherits timing from its
    neighbours so the transcript still advances smoothly. Times are clamped to be
    monotonically non-decreasing.
    """
    n = len(lines)

    # Forward-fill a start for any line missing one.
    starts: list[float] = [0.0] * n
    last = 0.0
    for i in range(n):
        if i in line_start:
            last = line_start[i]
        starts[i] = last

    # Backward-fill an end for any line missing one.
    ends: list[float] = [0.0] * n
    nxt = line_end.get(n - 1, starts[-1] if n else 0.0)
    for i in range(n - 1, -1, -1):
        if i in line_end:
            nxt = line_end[i]
        ends[i] = nxt

    segments: list[dict] = []
    prev_end = 0.0
    for i, text in enumerate(lines):
        start = max(starts[i], prev_end)
        end = max(ends[i], start)
        prev_end = end
        segments.append({"text": text, "start": round(start, 3), "end": round(end, 3)})

    return segments


# --------------------------------------------------------------------------- #
# torch-backed pieces.
# --------------------------------------------------------------------------- #

def _get_model_and_dict():
    """Load and cache the wav2vec2 model and its char->token-index dictionary."""
    global _MODEL, _DICT
    if _MODEL is None:
        import torchaudio  # lazy, heavy

        bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
        model = bundle.get_model()
        model.eval()
        _MODEL = model
        _DICT = {char: idx for idx, char in enumerate(bundle.get_labels())}
    return _MODEL, _DICT


def _load_waveform(audio_path: str):
    """Decode any audio file to a mono 16kHz float32 tensor via ffmpeg.

    Using ffmpeg (already in the image) sidesteps torchaudio backend ambiguity
    for MP3 decoding. We pull 16-bit PCM WAV and parse it with the stdlib.
    """
    import numpy as np
    import torch

    cmd = [
        "ffmpeg",
        "-i", audio_path,
        "-ac", "1",
        "-ar", str(SAMPLE_RATE),
        "-f", "wav",
        "-acodec", "pcm_s16le",
        "-hide_banner",
        "-loglevel", "error",
        "pipe:1",
    ]
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg decode failed: {proc.stderr.decode('utf-8', 'ignore')[:300]}"
        )

    with wave.open(io.BytesIO(proc.stdout), "rb") as wf:
        frames = wf.readframes(wf.getnframes())

    samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if samples.size == 0:
        raise RuntimeError("Decoded audio is empty")
    return torch.from_numpy(samples).unsqueeze(0)


def _emit(model, waveform):
    """Run the model over the waveform in windows; concatenate log-prob emissions."""
    import torch

    window = WINDOW_SECONDS * SAMPLE_RATE
    total = waveform.size(1)
    emissions = []

    with torch.inference_mode():
        for start in range(0, total, window):
            chunk = waveform[:, start:start + window]
            if chunk.size(1) < _MIN_CHUNK_SAMPLES:
                pad = torch.zeros(1, _MIN_CHUNK_SAMPLES - chunk.size(1))
                chunk = torch.cat([chunk, pad], dim=1)
            emission, _ = model(chunk)
            emissions.append(emission)

    # forced_align expects log-probabilities.
    return torch.log_softmax(torch.cat(emissions, dim=1), dim=-1)


def align(audio_path: str, script: str) -> list[dict]:
    """Force-align audio to script. Returns line segments with start/end seconds.

    Output: [{"text": str, "start": float, "end": float}, ...] in seconds,
    monotonically non-decreasing. Raises on failure (the subprocess wrapper turns
    that into ``None`` so callers degrade gracefully).
    """
    import torch
    import torchaudio.functional as AF

    lines = split_into_lines(script)
    if not lines:
        return []

    model, dictionary = _get_model_and_dict()

    # Build the per-word token lists, remembering each word's owning line.
    owner_line: list[int] = []
    word_token_lists: list[list[int]] = []
    for line_idx, line in enumerate(lines):
        for raw_word in line.split():
            tokens = [dictionary[c] for c in normalize_word(raw_word) if c in dictionary]
            if tokens:
                owner_line.append(line_idx)
                word_token_lists.append(tokens)

    if not word_token_lists:
        return []

    flat_tokens = [tok for word in word_token_lists for tok in word]

    waveform = _load_waveform(audio_path)
    emission = _emit(model, waveform)

    targets = torch.tensor([flat_tokens], dtype=torch.int32)
    with torch.inference_mode():
        aligned, scores = AF.forced_align(emission, targets, blank=0)
        token_spans = AF.merge_tokens(aligned[0], scores[0].exp())

    # One merged span per target token, in order → regroup into words.
    word_spans = _unflatten(token_spans, [len(w) for w in word_token_lists])

    # Seconds per emission frame.
    ratio = waveform.size(1) / emission.size(1) / SAMPLE_RATE

    line_start: dict[int, float] = {}
    line_end: dict[int, float] = {}
    for spans, line_idx in zip(word_spans, owner_line):
        if not spans:
            continue
        start = spans[0].start * ratio
        end = spans[-1].end * ratio
        line_start.setdefault(line_idx, start)
        line_end[line_idx] = end

    return assemble_segments(lines, line_start, line_end)
