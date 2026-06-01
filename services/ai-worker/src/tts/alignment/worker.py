"""Subprocess entry point for forced alignment.

Run as: python -m src.tts.alignment.worker --audio A --text T --out O

Runs in an isolated process so that a crash, hang, or out-of-memory event
during alignment cannot take down the main worker (which would otherwise cause
RabbitMQ to redeliver the job and re-run expensive TTS). On success it writes
the JSON segment list to ``--out`` and exits 0; on any failure it logs to
stderr and exits non-zero, and the parent treats that as "no segments".
"""

from __future__ import annotations

import argparse
import json
import os
import sys


def _limit_threads() -> None:
    """Keep CPU usage modest; this is a background, non-vital task."""
    threads = os.environ.get("ALIGNMENT_NUM_THREADS", "1")
    for var in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS"):
        os.environ.setdefault(var, threads)
    try:
        import torch

        torch.set_num_threads(int(threads))
    except Exception:
        pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Forced-alignment worker")
    parser.add_argument("--audio", required=True, help="Path to the audio file")
    parser.add_argument("--text", required=True, help="Path to the script text file")
    parser.add_argument("--out", required=True, help="Path to write JSON segments")
    args = parser.parse_args()

    _limit_threads()

    try:
        with open(args.text, encoding="utf-8") as f:
            script = f.read()

        from .aligner import align

        segments = align(args.audio, script)

        # Write atomically-ish: only create --out on full success.
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(segments, f)

        print(f"alignment ok: {len(segments)} segments", file=sys.stderr)
        return 0
    except Exception as exc:  # noqa: BLE001 - any failure must be non-fatal upstream
        print(f"alignment failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
