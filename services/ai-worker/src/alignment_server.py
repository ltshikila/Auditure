"""HTTP server for the alignment worker (Pub/Sub push target).

A dedicated Cloud Run service that receives Pub/Sub push messages ({episodeId}),
force-aligns the episode's audio to its script with a warm in-process model, and
stores the per-line timestamps. Decoupled from generation: the worker just
publishes; this service does the CPU-heavy alignment, autoscales on push load,
and scales to zero when idle.

Served via:
    gunicorn --bind :8080 --workers 1 --threads 1 --timeout 0 src.alignment_server:app

Concurrency is 1 (alignment is CPU-bound), so one episode is aligned per
instance at a time; Cloud Run adds instances as the Pub/Sub backlog grows.

Response contract (controls Pub/Sub ack/retry):
- 204: handled (done, skipped, or cleanly produced no segments) -> ack
- 400/204 on a malformed message -> drop (never retry a poison message)
- 500: transient failure -> Pub/Sub retries with backoff, then dead-letters
"""

from __future__ import annotations

import base64
import json
import logging
import os
import uuid
from pathlib import Path

from flask import Flask, request

from src.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("alignment_server")

# Bound CPU threads for torch (read before any alignment runs).
_THREADS = os.environ.get("ALIGNMENT_NUM_THREADS", "1")
for _var in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS"):
    os.environ.setdefault(_var, _THREADS)

app = Flask(__name__)

_repo = None
_storage = None
_threads_set = False


def _repository():
    global _repo
    if _repo is None:
        from src.database import EpisodeRepository, get_database_client

        _repo = EpisodeRepository(get_database_client())
    return _repo


def _get_storage():
    global _storage
    if _storage is None:
        from src.storage import get_storage

        _storage = get_storage()
    return _storage


def _ensure_torch_threads():
    global _threads_set
    if not _threads_set:
        try:
            import torch

            torch.set_num_threads(int(_THREADS))
        except Exception:
            pass
        _threads_set = True


@app.get("/health")
def health():
    return ("ok", 200)


@app.post("/")
def handle_push():
    envelope = request.get_json(force=True, silent=True)
    if not isinstance(envelope, dict) or "message" not in envelope:
        logger.warning("[ALIGN] Invalid Pub/Sub envelope")
        return ("bad request", 400)

    # Decode the {episodeId} payload. A malformed message is never retryable.
    try:
        raw = base64.b64decode(envelope["message"].get("data", "")).decode("utf-8")
        episode_id = json.loads(raw)["episodeId"]
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[ALIGN] Undecodable message (dropping): {e}")
        return ("", 204)

    repo = _repository()
    episode = repo.get_episode(episode_id)
    if not episode:
        logger.warning(f"[ALIGN] Episode not found (dropping): {episode_id}")
        return ("", 204)
    if episode.transcript_segments:
        logger.info(f"[ALIGN] Already aligned (skip): {episode_id}")
        return ("", 204)
    if not episode.audio_file_key or not episode.script_content:
        logger.info(f"[ALIGN] Missing audio/script (skip): {episode_id}")
        return ("", 204)

    tmp_path = None
    try:
        from src.tts.alignment.aligner import align

        _ensure_torch_threads()
        audio_bytes = _get_storage().get(episode.audio_file_key)
        fmt = (episode.audio_format or "mp3").lstrip(".")
        tmp_dir = Path(get_settings().tts_temp_dir)
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp_path = tmp_dir / f"align_{uuid.uuid4().hex}.{fmt}"
        tmp_path.write_bytes(audio_bytes)

        logger.info(f"[ALIGN] Aligning {episode_id} ({len(audio_bytes)} bytes)...")
        segments = align(str(tmp_path), episode.script_content)

        if segments:
            repo.update_segments(episode_id, segments)
            logger.info(f"[ALIGN] Stored {len(segments)} segments for {episode_id}")
        else:
            logger.info(f"[ALIGN] No segments produced for {episode_id}")
        return ("", 204)  # done — ack even if empty (don't retry a clean no-op)
    except Exception as e:  # noqa: BLE001
        logger.error(f"[ALIGN] Alignment failed for {episode_id}: {type(e).__name__}: {e}")
        # Transient (e.g. storage blip) -> let Pub/Sub retry; dead-letters after max.
        return ("alignment error", 500)
    finally:
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass
