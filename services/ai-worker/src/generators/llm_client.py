"""OpenAI client for script generation.

Primary model is gpt-5.4-mini; prompts whose counted input tokens exceed the
272K short-context/input cap are routed to the 1M-context fallback model
(gpt-4.1-mini) so oversized full-book episodes keep working.
"""

import logging
import traceback
from typing import Optional

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from src.config import get_settings

logger = logging.getLogger(__name__)

# (input, cached_input, output) USD per 1M tokens — for cost logging only.
MODEL_PRICING = {
    "gpt-5.4-mini": (0.75, 0.075, 4.50),
    "gpt-4.1-mini": (0.40, 0.10, 1.60),
}

_TOKEN_ENCODER = None


def _count_tokens(text: str) -> int:
    """Count tokens with tiktoken (o200k_base, shared by 4.1/5.x families).

    Falls back to a conservative chars/3 estimate if tiktoken is unavailable —
    conservative here means over-counting, which can only route a borderline
    episode to the big-context fallback model, never overflow the primary.
    """
    global _TOKEN_ENCODER
    try:
        if _TOKEN_ENCODER is None:
            import tiktoken
            _TOKEN_ENCODER = tiktoken.get_encoding("o200k_base")
        return len(_TOKEN_ENCODER.encode(text))
    except Exception:
        return len(text) // 3


class LLMAPIError(Exception):
    """Custom exception for LLM API errors."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class OpenAIClient:
    """Client for the OpenAI Chat Completions API with size-based model routing."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize OpenAI client."""
        settings = get_settings()
        self.api_key = api_key or settings.openai_api_key
        self.model = model or settings.openai_model
        self.fallback_model = settings.openai_fallback_model
        self.reasoning_effort = settings.openai_reasoning_effort
        self.long_context_threshold = settings.openai_long_context_threshold_tokens
        self.max_tokens = settings.openai_max_tokens
        self.timeout = settings.script_generation_timeout

        self._last_finish_reason: Optional[str] = None

        if self.api_key:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.api_key)
            logger.info(
                f"OpenAI client initialized (model: {self.model}, "
                f"fallback: {self.fallback_model})"
            )
        else:
            self.client = None
            logger.warning("OpenAI client not configured - no API key found")

    def _select_model(self, input_text: str) -> str:
        """Pick primary or big-context fallback based on counted input tokens."""
        tokens = _count_tokens(input_text)
        if tokens > self.long_context_threshold:
            logger.info(
                f"[LLM] Input is {tokens} tokens (> {self.long_context_threshold}) — "
                f"routing to fallback model {self.fallback_model}"
            )
            return self.fallback_model
        return self.model

    def _completion_params(self, model: str, max_tokens: int, temperature: float) -> dict:
        """Model-family-specific request params.

        gpt-5.x are reasoning models on Chat Completions: they take
        max_completion_tokens (which also counts reasoning tokens, hence the
        headroom) and reasoning_effort, and they ONLY accept the default
        temperature (1) — sending any other value 400s, so we omit it entirely.
        gpt-4.1.x keep the legacy max_tokens and honor temperature.
        """
        if model.startswith("gpt-5"):
            params: dict = {"max_completion_tokens": max_tokens + 2000}
            if self.reasoning_effort:
                params["reasoning_effort"] = self.reasoning_effort
            return params
        return {"max_tokens": max_tokens, "temperature": temperature}

    @property
    def is_available(self) -> bool:
        """Check if API key is configured and client initialized."""
        return self.client is not None

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
        Generate text using OpenAI GPT-4.1-mini.

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

        model = self._select_model((system_prompt or "") + prompt)

        temp_note = "default(1)" if model.startswith("gpt-5") else temperature
        logger.info("[LLM] Calling OpenAI API...")
        logger.info(f"[LLM] Model: {model}")
        logger.info(f"[LLM] Prompt length: {len(prompt)} chars")
        logger.info(f"[LLM] Max tokens: {max_tokens}, Temperature: {temp_note}")

        try:
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    timeout=self.timeout,
                    **self._completion_params(model, max_tokens, temperature),
                )
            except Exception as e:
                # Safety net: if the primary model rejects the request for
                # context length (token counting drifted), retry once on the
                # 1M-context fallback rather than failing the episode.
                if (
                    model != self.fallback_model
                    and "context" in str(e).lower()
                ):
                    logger.warning(
                        f"[LLM] {model} rejected request ({e}); retrying on "
                        f"fallback model {self.fallback_model}"
                    )
                    model = self.fallback_model
                    response = self.client.chat.completions.create(
                        model=model,
                        messages=messages,
                        timeout=self.timeout,
                        **self._completion_params(model, max_tokens, temperature),
                    )
                else:
                    raise

            choice = response.choices[0]
            generated = choice.message.content
            if not generated:
                raise LLMAPIError("OpenAI returned empty response")

            # Check for truncation
            finish_reason = choice.finish_reason
            if finish_reason == "length":
                logger.warning(f"[LLM] Response TRUNCATED (finish_reason=length, max_tokens={max_tokens})")

            usage = response.usage
            word_count = len(generated.split())
            logger.info(f"[LLM] Generated {len(generated)} chars ({word_count} words), finish_reason={finish_reason}")

            if usage:
                cached_tokens = 0
                details = getattr(usage, "prompt_tokens_details", None)
                if details is not None:
                    cached_tokens = getattr(details, "cached_tokens", 0) or 0

                logger.info(
                    f"[LLM] Tokens used - Prompt: {usage.prompt_tokens} "
                    f"(cached: {cached_tokens}), "
                    f"Completion: {usage.completion_tokens}, Total: {usage.total_tokens}"
                )

                input_rate, cached_rate, output_rate = MODEL_PRICING.get(
                    model, MODEL_PRICING["gpt-4.1-mini"]
                )
                fresh_tokens = usage.prompt_tokens - cached_tokens
                input_cost = (fresh_tokens / 1_000_000) * input_rate
                cached_cost = (cached_tokens / 1_000_000) * cached_rate
                output_cost = (usage.completion_tokens / 1_000_000) * output_rate
                total_cost = input_cost + cached_cost + output_cost
                logger.info(f"[LLM] Estimated cost: ${total_cost:.6f} ({model})")

            self._last_finish_reason = finish_reason
            return generated

        except LLMAPIError:
            raise
        except Exception as e:
            error_msg = f"OpenAI API error: {str(e)}"
            logger.error(error_msg)
            logger.error(f"Exception type: {type(e).__name__}")
            logger.error(f"Exception chain: {repr(e)}")
            cause = e.__cause__
            depth = 0
            while cause and depth < 5:
                logger.error(f"  Caused by [{depth}]: {type(cause).__name__}: {cause}")
                cause = getattr(cause, '__cause__', None) or getattr(cause, '__context__', None)
                depth += 1
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
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
        # Estimate tokens needed — podcast scripts with speaker labels (HOST:, GUEST:),
        # TTS markup tags ([sigh], [medium pause]), and dialogue formatting use ~2 tokens/word.
        # 1.8x gives enough headroom for markup without letting the LLM massively overshoot
        # word count targets (2.4x caused 80% overshoot on chunked generation).
        estimated_tokens = int(target_word_count * 1.8)
        max_tokens = min(estimated_tokens, self.max_tokens)

        system_prompt = """You are an expert podcast script writer. Your task is to create engaging,
natural-sounding podcast scripts that transform book content into compelling audio experiences.

Key guidelines:
- Write in a conversational, engaging tone
- Include natural speech patterns and transitions
- For multi-speaker formats, create genuinely distinct voices and natural dialogue
- Focus on making complex ideas accessible and interesting
- Always meet the requested word count - this is critical for episode length

TTS MARKUP - CRITICAL:
Include these markup tags throughout the script for natural text-to-speech rendering.

Non-speech sounds (rendered as natural audio):
- [sigh] - Frustration, relief, contemplation
- [laughing], [chuckling] - Humor and reactions
- [uhm], [uh] - Natural thinking hesitation
- [clearing throat] - Transitions

Style modifiers (affect delivery style):
- [whispering] - Quiet, intimate delivery
- [sarcasm] - Sarcastic tone on the following phrase
- [shouting] - Raised volume for passionate moments
- [extremely fast] - Rapid delivery for excited tangents

Pacing:
- [short pause] - Brief beat (~250ms)
- [medium pause] - Standard pause (~500ms)
- [long pause] - Dramatic pause (~1000ms+)

Use them naturally throughout - a good podcast has personality and dynamic delivery!
DO NOT use [excited], [nodding], [smiling], [scared], [curious], [bored] or other unofficial tags.
These will either be spoken aloud or produce unpredictable results.

NATURAL THINKING MOMENTS (multi-speaker episodes):
When a speaker is hit with a tough question, a strong counterpoint, or a perspective
they hadn't considered — DON'T have them immediately fire back a polished response.
Real people need a moment to think. Show this through:
- Verbal hesitation: "I... [medium pause] hm, that's..." or "Well... [uhm] okay, if you put it that way..."
- Incomplete restarts: "I think— no, actually... I think the real issue is..."
- Genuine concessions before pivoting: "[sigh] Okay, fair point. But here's what bugs me about that..."
- Trailing off to think: "That's... [short pause] yeah, I hadn't thought about it like that."

This should happen 2-3 times per episode — not every exchange. Save it for the moments
where a point genuinely lands. The contrast between confident delivery and genuine
uncertainty makes both speakers sound human."""

        return self.generate_text(
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=0.7,
            system_prompt=system_prompt,
        )


# Backwards compatibility aliases
GeminiTextClient = OpenAIClient
HuggingFaceClient = OpenAIClient
HuggingFaceAPIError = LLMAPIError
