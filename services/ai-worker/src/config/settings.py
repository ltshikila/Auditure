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

    # LLM (optional)
    huggingface_api_key: Optional[str] = None
    huggingface_model: str = "mistralai/Mistral-7B-Instruct-v0.2"

    # Storage
    local_storage_path: str = "./storage"

    # Processing
    words_per_minute: int = 150
    max_book_content_chars: int = 8000
    script_generation_timeout: int = 60

    # TTS
    tts_temp_dir: str = "./temp/tts"

    # Logging
    log_level: str = "INFO"

    # Retry settings
    max_retries: int = 3
    retry_delay_base: int = 5  # seconds

    @property
    def has_llm_api(self) -> bool:
        """Check if HuggingFace API is configured."""
        return self.huggingface_api_key is not None and len(self.huggingface_api_key) > 0


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
