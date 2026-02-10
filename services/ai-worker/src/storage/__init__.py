"""Storage module."""

import logging

from .local_storage import LocalStorage

__all__ = ["LocalStorage", "get_storage"]

logger = logging.getLogger(__name__)


def get_storage():
    """Factory: returns GCS or Local storage based on config."""
    from src.config import get_settings

    settings = get_settings()

    if settings.storage_backend == "gcs":
        try:
            from .gcs_storage import GcsStorage
        except ImportError as e:
            logger.error(
                "Failed to import GcsStorage. STORAGE_BACKEND=gcs but "
                "google-cloud-storage may not be installed: %s",
                e,
            )
            raise ImportError(
                f"GCS storage backend requires google-cloud-storage package: {e}"
            ) from e
        return GcsStorage()

    return LocalStorage()
