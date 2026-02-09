"""Storage module."""

from .local_storage import LocalStorage

__all__ = ["LocalStorage", "get_storage"]


def get_storage():
    """Factory: returns GCS or Local storage based on config."""
    from src.config import get_settings

    settings = get_settings()

    if settings.storage_backend == "gcs":
        from .gcs_storage import GcsStorage
        return GcsStorage()

    return LocalStorage()
