"""HuggingFace Inference API client."""

import logging
from typing import Optional, Dict, Any

import requests
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from src.config import get_settings

logger = logging.getLogger(__name__)


class HuggingFaceAPIError(Exception):
    """Custom exception for HuggingFace API errors."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class HuggingFaceClient:
    """Client for HuggingFace Inference API."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize HuggingFace client."""
        settings = get_settings()
        self.api_key = api_key or settings.huggingface_api_key
        self.model = model or settings.huggingface_model
        self.timeout = settings.script_generation_timeout
        self.base_url = "https://api-inference.huggingface.co/models"

    @property
    def is_available(self) -> bool:
        """Check if API key is configured."""
        return self.api_key is not None and len(self.api_key) > 0

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((requests.RequestException, HuggingFaceAPIError)),
        reraise=True,
    )
    def generate_text(
        self,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text using HuggingFace Inference API.

        Args:
            prompt: The input prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0-1.0)

        Returns:
            Generated text

        Raises:
            HuggingFaceAPIError: If API call fails
        """
        if not self.is_available:
            raise HuggingFaceAPIError("HuggingFace API key not configured")

        url = f"{self.base_url}/{self.model}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": max_tokens,
                "temperature": temperature,
                "do_sample": True,
                "return_full_text": False,
            },
        }

        logger.info(f"Calling HuggingFace API: {self.model}")

        try:
            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=self.timeout,
            )

            if response.status_code == 503:
                # Model is loading, retry
                logger.warning("Model is loading, will retry...")
                raise HuggingFaceAPIError("Model is loading", status_code=503)

            if response.status_code == 429:
                # Rate limited
                logger.warning("Rate limited, will retry...")
                raise HuggingFaceAPIError("Rate limited", status_code=429)

            if not response.ok:
                error_msg = f"API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise HuggingFaceAPIError(error_msg, status_code=response.status_code)

            result = response.json()

            # Handle different response formats
            if isinstance(result, list) and len(result) > 0:
                if "generated_text" in result[0]:
                    return result[0]["generated_text"]
                return str(result[0])
            elif isinstance(result, dict):
                if "generated_text" in result:
                    return result["generated_text"]
                if "error" in result:
                    raise HuggingFaceAPIError(result["error"])

            logger.error(f"Unexpected response format: {result}")
            raise HuggingFaceAPIError("Unexpected response format")

        except requests.RequestException as e:
            logger.error(f"Request failed: {e}")
            raise HuggingFaceAPIError(f"Request failed: {e}")

    def generate_script(
        self,
        prompt: str,
        target_word_count: int = 2000,
    ) -> str:
        """
        Generate a podcast script.

        Args:
            prompt: The full prompt including book content and instructions
            target_word_count: Target number of words

        Returns:
            Generated podcast script
        """
        # Estimate tokens (roughly 1.3 tokens per word)
        max_tokens = int(target_word_count * 1.5)
        max_tokens = min(max_tokens, 4000)  # API limit

        return self.generate_text(
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=0.7,
        )
