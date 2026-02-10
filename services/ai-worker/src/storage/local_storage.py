"""Local file storage for audio files."""

import logging
from pathlib import Path
from typing import Optional

from src.config import get_settings

logger = logging.getLogger(__name__)


class StorageError(Exception):
    """Custom exception for storage errors."""

    pass


class LocalStorage:
    """Local file system storage for audio files."""

    def __init__(self, base_path: Optional[str] = None):
        """
        Initialize local storage.

        Args:
            base_path: Base directory for storage (default from settings)
        """
        settings = get_settings()
        self.base_path = Path(base_path or settings.local_storage_path)
        self._ensure_base_path()

    def _ensure_base_path(self) -> None:
        """Ensure base storage directory exists."""
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Storage initialized at: {self.base_path}")

    def save(
        self,
        data: bytes,
        key: str,
    ) -> str:
        """
        Save data to storage.

        Args:
            data: Binary data to save
            key: Storage key (path relative to base)

        Returns:
            Full path to saved file

        Raises:
            StorageError: If save fails
        """
        file_path = self.base_path / key

        try:
            # Ensure parent directory exists
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Write file
            with open(file_path, "wb") as f:
                f.write(data)

            logger.info(f"Saved {len(data)} bytes to: {key}")
            return str(file_path)

        except Exception as e:
            logger.error(f"Failed to save file: {e}")
            raise StorageError(f"Failed to save file: {e}") from e

    def get(self, key: str) -> bytes:
        """
        Get data from storage.

        Args:
            key: Storage key

        Returns:
            File contents as bytes

        Raises:
            StorageError: If file not found or read fails
        """
        file_path = self.base_path / key

        if not file_path.exists():
            raise StorageError(f"File not found: {key}")

        try:
            with open(file_path, "rb") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Failed to read file: {e}")
            raise StorageError(f"Failed to read file: {e}") from e

    def delete(self, key: str) -> bool:
        """
        Delete file from storage.

        Args:
            key: Storage key

        Returns:
            True if deleted, False if not found
        """
        file_path = self.base_path / key

        if not file_path.exists():
            return False

        try:
            file_path.unlink()
            logger.info(f"Deleted: {key}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete file: {e}")
            return False

    def exists(self, key: str) -> bool:
        """Check if file exists in storage."""
        return (self.base_path / key).exists()

    def get_path(self, key: str) -> Path:
        """Get full path for a storage key."""
        return self.base_path / key

    def get_size(self, key: str) -> int:
        """Get file size in bytes."""
        file_path = self.base_path / key

        if not file_path.exists():
            return 0

        return file_path.stat().st_size

    def list_keys(self, prefix: str = "") -> list:
        """
        List all keys with optional prefix.

        Args:
            prefix: Key prefix to filter by

        Returns:
            List of storage keys
        """
        base = self.base_path / prefix if prefix else self.base_path
        keys = []

        if not base.exists():
            return keys

        for path in base.rglob("*"):
            if path.is_file():
                relative_path = path.relative_to(self.base_path)
                keys.append(str(relative_path))

        return keys
