"""Main entry point for Auditure AI Worker."""

import logging
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import get_settings
from src.consumers import EpisodeConsumer
from src.health import start_health_server
from src.utils import setup_logging

logger = logging.getLogger(__name__)


def main() -> None:
    """Main entry point."""
    # Load settings and setup logging
    settings = get_settings()
    setup_logging(settings.log_level)

    logger.info("=" * 60)
    logger.info("Auditure AI Worker starting...")
    logger.info("=" * 60)
    logger.info(f"RabbitMQ URL: {settings.rabbitmq_url}")
    logger.info(f"Database URL: {settings.database_url.split('@')[-1]}")  # Hide credentials
    logger.info(f"Redis: {settings.redis_host}:{settings.redis_port}")
    logger.info(f"Storage path: {settings.local_storage_path}")
    logger.info(f"LLM available: {settings.has_llm_api}")
    if settings.has_llm_api:
        logger.info(f"  OpenAI Model: {settings.openai_model}")
        logger.info(f"  API Key: {settings.openai_api_key[:10]}...{settings.openai_api_key[-4:]}")
    else:
        logger.warning("  No OpenAI API key configured - will use template fallback")
        logger.warning("  Set OPENAI_API_KEY environment variable to enable LLM generation")
    logger.info(f"TTS Voice Tier: {settings.tts_voice_tier}")
    logger.info(f"  Google TTS available: {settings.has_google_tts}")
    logger.info(f"  Gemini TTS available: {settings.has_gemini_tts}")
    logger.info("=" * 60)

    # Ensure directories exist
    Path(settings.local_storage_path).mkdir(parents=True, exist_ok=True)
    Path(settings.tts_temp_dir).mkdir(parents=True, exist_ok=True)

    # Network connectivity diagnostics
    if settings.has_llm_api:
        logger.info("[DIAG] Running OpenAI API connectivity test...")
        try:
            import httpx
            r = httpx.get("https://api.openai.com/v1/models", timeout=15.0, headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
            })
            logger.info(f"[DIAG] OpenAI API connectivity OK: HTTP {r.status_code}")
        except Exception as diag_e:
            logger.error(f"[DIAG] OpenAI API connectivity FAILED: {type(diag_e).__name__}: {diag_e}")

    # Start health check server for Cloud Run
    start_health_server()

    # Create and start consumer
    consumer = EpisodeConsumer()

    try:
        logger.info("Starting episode generation consumer...")
        consumer.start()
    except KeyboardInterrupt:
        logger.info("Shutdown requested by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

    logger.info("AI Worker stopped")


if __name__ == "__main__":
    main()
