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
    )

    # RabbitMQ
    rabbitmq_url: str = "amqp://localhost:5672"
    episode_generation_queue: str = "episode_generation"
    episode_generation_dlq: str = "episode_generation_dlq"

    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/bookcast"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379

    # LLM - OpenAI GPT-4o mini
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    openai_max_tokens: int = 16000  # GPT-4o mini supports up to 16,384 output tokens

    # Google Cloud TTS
    google_cloud_project_id: Optional[str] = None
    google_cloud_credentials_path: Optional[str] = None  # Path to service account JSON
    # Voice tier: "standard" ($4/1M chars) or "neural" ($16/1M chars)
    tts_voice_tier: str = "neural"  # Default to Neural2 for paying users

    # Storage
    local_storage_path: str = "./storage"

    # Processing
    words_per_minute: int = 150
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


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
