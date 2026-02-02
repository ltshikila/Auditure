"""Application settings using Pydantic."""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Allow extra env vars without validation errors
    )

    # RabbitMQ
    rabbitmq_url: str = "amqp://localhost:5672"
    episode_generation_queue: str = "episode_generation"
    episode_generation_dlq: str = "episode_generation_dlq"

    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/auditure"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379

    # LLM - OpenAI GPT-4o mini
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    openai_max_tokens: int = 16000  # GPT-4o mini supports up to 16,384 output tokens

    # Google Cloud TTS (Standard voices - $4/1M chars)
    google_cloud_project_id: Optional[str] = None
    google_cloud_credentials_path: Optional[str] = None  # Path to service account JSON

    # Gemini 2.5 Pro TTS (Multi-speaker - ~$0.32/10-min episode)
    gemini_api_key: Optional[str] = None

    # TTS Configuration
    # Voice tier options:
    #   - "standard": Google Cloud Standard ($4/1M chars) - free tier
    #   - "gemini": Gemini 2.5 Pro (~$0.32/10-min) - paid tiers, multi-speaker
    tts_voice_tier: str = "gemini"  # Default to Gemini Pro for paying users

    # Storage
    local_storage_path: str = "./storage"

    # Processing
    # Note: Gemini TTS speaks at ~180-185 wpm, faster than typical 150 wpm
    # Using 185 ensures scripts have enough words for minimum duration
    words_per_minute: int = 185
    max_book_content_chars: int = 8000
    script_generation_timeout: int = 120  # Increased for GPT-4o mini

    # TTS
    tts_temp_dir: str = "./temp/tts"

    # Logging
    log_level: str = "INFO"

    # Retry settings
    max_retries: int = 3
    retry_delay_base: int = 5  # seconds

    @property
    def has_llm_api(self) -> bool:
        """Check if OpenAI API is configured."""
        return self.openai_api_key is not None and len(self.openai_api_key) > 0

    @property
    def has_google_tts(self) -> bool:
        """Check if Google Cloud TTS is configured."""
        return (
            self.google_cloud_project_id is not None
            and len(self.google_cloud_project_id) > 0
        )

    @property
    def has_gemini_tts(self) -> bool:
        """Check if Gemini TTS is configured."""
        return self.gemini_api_key is not None and len(self.gemini_api_key) > 0


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
