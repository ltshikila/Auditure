"""Crash-safe driver for forced alignment.

``run_alignment_safe`` is the only function the rest of the worker should call.
It spawns the alignment work in an isolated subprocess with a hard timeout, and
returns ``None`` on any failure so callers can treat live-transcript timing as a
best-effort enhancement that never blocks or breaks episode generation.
"""

from __future__ import annotations

import json
import logging
import subprocess
import sys
import uuid
from pathlib import Path

from src.config import get_settings

logger = logging.getLogger(__name__)


def run_alignment_safe(
    audio_bytes: bytes,
    audio_format: str,
    script: str,
    timeout_s: int | None = None,
) -> list[dict] | None:
    """Force-align ``audio_bytes`` to ``script`` and return line segments.

    Args:
        audio_bytes: The generated episode audio (e.g. MP3 bytes).
        audio_format: File extension for the audio, e.g. "mp3" or "wav".
        script: The raw script text (markup/speaker labels are stripped inside).
        timeout_s: Hard wall-clock cap; defaults to settings.alignment_timeout_s.

    Returns:
        A list of ``{"text": str, "start": float, "end": float}`` (seconds),
        or ``None`` if alignment is disabled, fails, times out, or produces
        nothing usable. Never raises.
    """
    settings = get_settings()

    if not getattr(settings, "alignment_enabled", True):
        logger.info("[ALIGN] Disabled via settings; skipping")
        return None

    if not audio_bytes or not script or not script.strip():
        return None

    timeout = timeout_s or getattr(settings, "alignment_timeout_s", 600)
    temp_dir = Path(getattr(settings, "tts_temp_dir", "./temp/tts"))
    temp_dir.mkdir(parents=True, exist_ok=True)

    stem = uuid.uuid4().hex
    fmt = (audio_format or "mp3").lstrip(".")
    audio_path = temp_dir / f"align_{stem}.{fmt}"
    text_path = temp_dir / f"align_{stem}.txt"
    out_path = temp_dir / f"align_{stem}.json"

    try:
        audio_path.write_bytes(audio_bytes)
        text_path.write_text(script, encoding="utf-8")

        cmd = [
            sys.executable,
            "-m",
            "src.tts.alignment.worker",
            "--audio", str(audio_path),
            "--text", str(text_path),
            "--out", str(out_path),
        ]

        logger.info(f"[ALIGN] Starting alignment subprocess (timeout={timeout}s)")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        if result.returncode != 0:
            logger.warning(
                f"[ALIGN] Subprocess exited {result.returncode} (non-vital): "
                f"{(result.stderr or '').strip()[:300]}"
            )
            return None

        if not out_path.exists():
            logger.warning("[ALIGN] Subprocess produced no output file")
            return None

        segments = json.loads(out_path.read_text(encoding="utf-8"))
        if not isinstance(segments, list) or not segments:
            logger.info("[ALIGN] No segments produced")
            return None

        return segments

    except subprocess.TimeoutExpired:
        logger.warning(f"[ALIGN] Alignment timed out after {timeout}s (non-vital)")
        return None
    except Exception as exc:  # noqa: BLE001 - never let alignment break the caller
        logger.warning(f"[ALIGN] Alignment skipped (non-vital): {type(exc).__name__}: {exc}")
        return None
    finally:
        for path in (audio_path, text_path, out_path):
            try:
                if path.exists():
                    path.unlink()
            except Exception:
                pass
