"""Forced-alignment package for live transcript timing.

Produces per-line timestamps by aligning the generated audio against the
known script text (forced alignment, NOT transcription). This powers the
mobile transcript "live tracking" feature: highlight the spoken line and
tap-to-seek.

Design notes:
- This is an OPTIONAL, non-vital enhancement. Every entry point is built to
  degrade quietly: if alignment fails for any reason, callers get ``None``
  and the episode is unaffected.
- The heavy ML dependencies (torch/torchaudio) are imported lazily inside the
  worker subprocess, so importing this package never pulls them into the
  main worker process.

Public API:
    run_alignment_safe(audio_bytes, audio_format, script) -> list[dict] | None
"""

from .runner import run_alignment_safe

__all__ = ["run_alignment_safe"]
