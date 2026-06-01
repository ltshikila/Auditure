"""Backfill live-transcript timing for already-generated episodes.

Re-runs forced alignment against the stored audio + script for COMPLETED
episodes that don't yet have ``transcriptSegments``, and writes the results
back. Safe to run repeatedly: it only touches episodes still missing segments,
and each alignment is the same crash-safe, isolated subprocess used at
generation time (a failure just leaves that episode without sync).

Run from the ai-worker directory (so ``src`` is importable):

    python -m scripts.backfill_segments              # process up to 100 episodes
    python -m scripts.backfill_segments --limit 500  # process more
    python -m scripts.backfill_segments --dry-run    # list what would run
    python -m scripts.backfill_segments --batch 25   # DB page size

Requires the same env as the worker (DATABASE_URL, STORAGE_BACKEND/GCS bucket,
TORCH_HOME pointing at the baked model) and torch/torchaudio installed.
"""

from __future__ import annotations

import argparse
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("backfill_segments")


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill transcript segments")
    parser.add_argument("--limit", type=int, default=100, help="Max episodes to process")
    parser.add_argument("--batch", type=int, default=25, help="DB page size per query")
    parser.add_argument("--dry-run", action="store_true", help="List candidates, do not align")
    args = parser.parse_args()

    # Imported here so --help works without DB/torch configured.
    from src.database import EpisodeRepository, get_database_client
    from src.storage import get_storage
    from src.tts.alignment import run_alignment_safe

    repository = EpisodeRepository(get_database_client())
    storage = get_storage()

    processed = 0
    succeeded = 0

    while processed < args.limit:
        page_size = min(args.batch, args.limit - processed)
        episodes = repository.get_episodes_needing_alignment(limit=page_size)
        if not episodes:
            break

        for ep in episodes:
            episode_id = ep["id"]
            processed += 1

            if args.dry_run:
                logger.info(f"[DRY-RUN] would align episode {episode_id}")
                continue

            try:
                audio_bytes = storage.get(ep["audio_file_key"])
            except Exception as e:
                logger.warning(f"[{episode_id}] could not load audio ({e}); skipping")
                continue

            segments = run_alignment_safe(
                audio_bytes=audio_bytes,
                audio_format=ep["audio_format"],
                script=ep["script_content"],
            )

            if segments:
                repository.update_segments(episode_id, segments)
                succeeded += 1
                logger.info(f"[{episode_id}] aligned: {len(segments)} segments ({processed}/{args.limit})")
            else:
                logger.info(f"[{episode_id}] no segments produced; left unsynced")

        # Dry-run would loop forever on the same page (nothing gets updated), so stop.
        if args.dry_run:
            break

    logger.info(f"Done. Processed {processed}, aligned {succeeded}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
