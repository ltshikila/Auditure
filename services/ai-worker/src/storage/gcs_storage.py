"""Google Cloud Storage backend for audio files."""

import logging

from google.cloud import storage

from src.config import get_settings

logger = logging.getLogger(__name__)


class GcsStorage:
    """Google Cloud Storage backend matching LocalStorage interface."""

    def __init__(self, bucket_name: str = None):
        settings = get_settings()
        self.bucket_name = bucket_name or settings.gcs_bucket_name
        if not self.bucket_name:
            raise ValueError("GCS bucket name is required (set GCS_BUCKET_NAME env var)")

        self.client = storage.Client()
        self.bucket = self.client.bucket(self.bucket_name)
        logger.info(f"GCS Storage initialized with bucket: {self.bucket_name}")

    def save(self, data: bytes, key: str) -> str:
        blob = self.bucket.blob(key)
        blob.upload_from_string(data)
        logger.info(f"Saved {len(data)} bytes to GCS: {key}")
        return f"gs://{self.bucket_name}/{key}"

    def get(self, key: str) -> bytes:
        blob = self.bucket.blob(key)
        if not blob.exists():
            raise FileNotFoundError(f"File not found in GCS: {key}")
        data = blob.download_as_bytes()
        logger.info(f"Downloaded {len(data)} bytes from GCS: {key}")
        return data

    def delete(self, key: str) -> bool:
        blob = self.bucket.blob(key)
        if not blob.exists():
            return False
        blob.delete()
        logger.info(f"Deleted from GCS: {key}")
        return True

    def exists(self, key: str) -> bool:
        return self.bucket.blob(key).exists()

    def list_keys(self, prefix: str = "") -> list[str]:
        blobs = self.client.list_blobs(self.bucket_name, prefix=prefix)
        return [blob.name for blob in blobs]
