"""OpenAI GPT-4o mini client for script generation."""

import logging
from typing import Optional

from openai import OpenAI
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from src.config import get_settings

logger = logging.getLogger(__name__)


class LLMAPIError(Exception):
    """Custom exception for LLM API errors."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class OpenAIClient:
    """Client for OpenAI GPT-4o mini API."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize OpenAI client."""
        settings = get_settings()
        self.api_key = api_key or settings.openai_api_key
        self.model = model or settings.openai_model
        self.max_tokens = settings.openai_max_tokens
        self.timeout = settings.script_generation_timeout

        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None

    @property
    def is_available(self) -> bool:
        """Check if API key is configured."""
        return self.api_key is not None and len(self.api_key) > 0

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((LLMAPIError,)),
        reraise=True,
    )
    def generate_text(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        Generate text using OpenAI GPT-4o mini.

        Args:
            prompt: The user prompt
            max_tokens: Maximum tokens to generate (default from settings)
            temperature: Sampling temperature (0.0-2.0)
            system_prompt: Optional system prompt for context

        Returns:
            Generated text

        Raises:
            LLMAPIError: If API call fails
        """
        if not self.is_available:
            raise LLMAPIError("OpenAI API key not configured")

        max_tokens = max_tokens or self.max_tokens

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        logger.info("[LLM] Calling OpenAI API...")
        logger.info(f"[LLM] Model: {self.model}")
        logger.info(f"[LLM] Prompt length: {len(prompt)} chars")
        logger.info(f"[LLM] Max tokens: {max_tokens}, Temperature: {temperature}")

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                timeout=self.timeout,
            )

            generated = response.choices[0].message.content
            usage = response.usage

            logger.info(f"[LLM] Generated {len(generated)} chars ({len(generated.split())} words)")
            logger.info(f"[LLM] Tokens used - Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")

            # Log cost estimate (GPT-4o mini pricing: $0.15/1M input, $0.60/1M output)
            input_cost = (usage.prompt_tokens / 1_000_000) * 0.15
            output_cost = (usage.completion_tokens / 1_000_000) * 0.60
            total_cost = input_cost + output_cost
            logger.info(f"[LLM] Estimated cost: ${total_cost:.6f}")

            return generated

        except Exception as e:
            error_msg = f"OpenAI API error: {str(e)}"
            logger.error(error_msg)
            raise LLMAPIError(error_msg) from e

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
        # Estimate tokens needed (roughly 1.3 tokens per word for output)
        # Add buffer for formatting and speaker labels
        estimated_tokens = int(target_word_count * 1.5)
        max_tokens = min(estimated_tokens, self.max_tokens)

        system_prompt = """You are an expert podcast script writer. Your task is to create engaging,
natural-sounding podcast scripts that transform book content into compelling audio experiences.

Key guidelines:
- Write in a conversational, engaging tone
- Include natural speech patterns and transitions
- For multi-speaker formats, create distinct voices and natural dialogue
- Focus on making complex ideas accessible and interesting
- Always meet the requested word count - this is critical for episode length

TTS MARKUP - CRITICAL:
Include these markup tags throughout the script for natural text-to-speech:
- [short pause], [medium pause], [long pause] - For pacing and emphasis
- [sigh] - For emotional moments (frustration, relief, contemplation)
- [laughing], [chuckling] - For humor and reactions
- [uhm], [uh] - For natural thinking hesitation
- [whispering] - For quieter, intimate delivery
- [clearing throat] - For natural transitions

These tags will be rendered as natural speech sounds by the TTS engine.
Use them liberally but naturally - a good podcast has personality!
DO NOT use [excited], [nodding], [smiling] or other unofficial tags - they will be spoken aloud!

Reference: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#prompting_tips"""

        return self.generate_text(
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=0.7,
            system_prompt=system_prompt,
        )


# Backwards compatibility alias
HuggingFaceClient = OpenAIClient
HuggingFaceAPIError = LLMAPIError
