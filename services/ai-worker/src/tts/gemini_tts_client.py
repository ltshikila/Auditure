"""Gemini 2.5 TTS client for multi-speaker podcast synthesis.

Uses the official google-genai SDK for text-to-speech.

Gemini TTS Features:
- Native multi-speaker synthesis (up to 9 distinct voices)
- Natural dialogue with expressive speech
- Podcast-optimized output quality
- 24 language support
- 30 prebuilt voice options

Available Models:
- gemini-2.5-flash-preview-tts: Fast, multi-speaker
- gemini-2.5-pro-preview-tts: Higher quality for podcasts

Voice Selection:
- 30 distinct voices with unique characteristics
- Voices mapped by perceived speed, pitch, and gender

Reference: https://ai.google.dev/gemini-api/docs/speech-generation
"""

import base64
import io
import logging
import re
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Dict, Any

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from src.config import get_settings

logger = logging.getLogger(__name__)


class GeminiTTSError(Exception):
    """Custom exception for Gemini TTS errors."""
    pass


@dataclass
class GeminiVoiceConfig:
    """Voice configuration for Gemini TTS multi-speaker synthesis."""

    speaker_id: str  # e.g., "Kore", "Charon", "Fenrir", etc.
    style: str  # Voice style descriptor
    language_code: str = "en-US"  # Regional accent
    style_prompt: Optional[str] = None  # Custom style guidance


# Complete list of 30 Gemini TTS voices with characteristics
# Reference: https://ai.google.dev/gemini-api/docs/speech-generation
#
# Each voice is mapped with:
#   (perceived_speed, perceived_pitch, gender)
# where speed/pitch are 1-10 scale to match frontend inputs
#
GEMINI_VOICES: Dict[str, Dict[str, Any]] = {
    # FEMALE voices
    "Zephyr": {"gender": "FEMALE", "style": "Bright", "speed": 6, "pitch": 8},
    "Kore": {"gender": "FEMALE", "style": "Firm", "speed": 5, "pitch": 5},
    "Aoede": {"gender": "FEMALE", "style": "Breezy", "speed": 6, "pitch": 7},
    "Leda": {"gender": "FEMALE", "style": "Youthful", "speed": 5, "pitch": 9},
    "Callirrhoe": {"gender": "FEMALE", "style": "Easy-going", "speed": 4, "pitch": 5},
    "Autonoe": {"gender": "FEMALE", "style": "Bright", "speed": 6, "pitch": 8},
    "Despina": {"gender": "FEMALE", "style": "Smooth", "speed": 4, "pitch": 5},
    "Erinome": {"gender": "FEMALE", "style": "Clear", "speed": 5, "pitch": 6},
    "Laomedeia": {"gender": "FEMALE", "style": "Upbeat", "speed": 7, "pitch": 7},
    "Achernar": {"gender": "FEMALE", "style": "Soft", "speed": 2, "pitch": 4},
    "Gacrux": {"gender": "FEMALE", "style": "Mature", "speed": 4, "pitch": 2},
    "Pulcherrima": {"gender": "FEMALE", "style": "Forward", "speed": 6, "pitch": 6},
    "Vindemiatrix": {"gender": "FEMALE", "style": "Gentle", "speed": 3, "pitch": 4},
    "Sulafat": {"gender": "FEMALE", "style": "Warm", "speed": 4, "pitch": 3},

    # MALE voices
    "Puck": {"gender": "MALE", "style": "Upbeat", "speed": 7, "pitch": 7},
    "Charon": {"gender": "MALE", "style": "Informative", "speed": 5, "pitch": 3},
    "Fenrir": {"gender": "MALE", "style": "Excitable", "speed": 8, "pitch": 6},
    "Orus": {"gender": "MALE", "style": "Firm", "speed": 5, "pitch": 4},
    "Enceladus": {"gender": "MALE", "style": "Breathy", "speed": 4, "pitch": 4},
    "Iapetus": {"gender": "MALE", "style": "Clear", "speed": 5, "pitch": 5},
    "Umbriel": {"gender": "MALE", "style": "Easy-going", "speed": 4, "pitch": 5},
    "Algieba": {"gender": "MALE", "style": "Smooth", "speed": 4, "pitch": 5},
    "Algenib": {"gender": "MALE", "style": "Gravelly", "speed": 4, "pitch": 2},
    "Rasalgethi": {"gender": "MALE", "style": "Informative", "speed": 5, "pitch": 4},
    "Alnilam": {"gender": "MALE", "style": "Firm", "speed": 5, "pitch": 4},
    "Schedar": {"gender": "MALE", "style": "Even", "speed": 5, "pitch": 5},
    "Achird": {"gender": "MALE", "style": "Friendly", "speed": 6, "pitch": 6},
    "Zubenelgenubi": {"gender": "MALE", "style": "Casual", "speed": 5, "pitch": 5},
    "Sadachbia": {"gender": "MALE", "style": "Lively", "speed": 7, "pitch": 6},
    "Sadaltager": {"gender": "MALE", "style": "Knowledgeable", "speed": 5, "pitch": 4},
}

# Supported English language codes for regional accents
ACCENT_TO_LANGUAGE_CODE: Dict[str, str] = {
    "United States": "en-US",
    "United Kingdom": "en-GB",
    "Australia": "en-AU",
    "India": "en-IN",
    # Fallbacks for other English accents
    "Canada": "en-US",
    "Ireland": "en-GB",
    "New Zealand": "en-AU",
    "South Africa": "en-GB",
    "default": "en-US",
}


def _pcm_to_wav(
    pcm_data: bytes,
    channels: int = 1,
    rate: int = 24000,
    sample_width: int = 2,
    trailing_silence_sec: float = 1.0,
) -> bytes:
    """Convert raw PCM data to WAV format.

    Gemini TTS outputs PCM 16-bit 24kHz audio without WAV headers.
    This function adds the proper WAV headers and optional trailing silence.

    Args:
        pcm_data: Raw PCM audio bytes
        channels: Number of audio channels (1=mono)
        rate: Sample rate in Hz (24000 for Gemini)
        sample_width: Bytes per sample (2=16-bit)
        trailing_silence_sec: Seconds of silence to add at the end
    """
    # Add trailing silence for natural ending
    if trailing_silence_sec > 0:
        silence_bytes = int(rate * sample_width * channels * trailing_silence_sec)
        pcm_data = pcm_data + bytes(silence_bytes)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm_data)
    return buffer.getvalue()


class GeminiTTSClient:
    """Client for Gemini TTS API using google-genai SDK.

    Supports native multi-speaker dialogue synthesis with natural
    conversational qualities optimized for podcast content.

    Voice selection algorithm:
    1. Filter by gender (from podcaster config)
    2. Map accent to language_code (en-US, en-GB, en-AU, en-IN)
    3. Select voice closest to desired speakingSpeed and vocalPitch

    Reference: https://ai.google.dev/gemini-api/docs/speech-generation
    """

    # Gemini model for TTS
    MODEL_NAME = "gemini-2.5-flash-preview-tts"

    # Audio output configuration (Gemini outputs PCM 16-bit 24kHz)
    SAMPLE_RATE = 24000
    SAMPLE_WIDTH = 2  # 16-bit
    CHANNELS = 1

    # Pricing (per 1M tokens) - Gemini 2.5 Flash TTS
    # Reference: https://ai.google.dev/gemini-api/docs/pricing
    # Updated 2026-01-09: Corrected to actual API pricing
    INPUT_PRICE_PER_M = 0.50    # $0.50 per 1M text tokens
    OUTPUT_PRICE_PER_M = 10.00  # $10.00 per 1M audio tokens
    TOKENS_PER_SECOND = 25      # Audio tokens per second of output

    # Chunking configuration - Gemini TTS has ~10-11 min output limit
    # Use conservative 8 min chunks to ensure we stay within limits
    MAX_CHUNK_DURATION_SEC = 480  # 8 minutes per chunk
    MAX_CHUNK_CHARS = 12000       # ~8 min at ~270 wpm ≈ 2160 words ≈ 12k chars

    def __init__(self, temp_dir: Optional[str] = None):
        """Initialize Gemini TTS client."""
        settings = get_settings()
        self.temp_dir = Path(temp_dir or settings.tts_temp_dir)
        self._ensure_temp_dir()

        # Configure Gemini API with new SDK
        self.api_key = settings.gemini_api_key
        self.client = None

        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                logger.info("Gemini TTS client initialized with google-genai SDK")
            except ImportError:
                logger.error("google-genai package not installed. Run: pip install google-genai")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
        else:
            logger.warning("Gemini TTS not configured - no API key found")

    @property
    def is_available(self) -> bool:
        """Check if Gemini TTS is configured."""
        return self.client is not None

    def _ensure_temp_dir(self) -> None:
        """Ensure temp directory exists."""
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def get_language_code(self, accent: str) -> str:
        """
        Map accent string to Gemini TTS language code.

        Args:
            accent: Accent from frontend (e.g., "United Kingdom", "Australia")

        Returns:
            Language code (e.g., "en-GB", "en-AU")
        """
        return ACCENT_TO_LANGUAGE_CODE.get(accent, ACCENT_TO_LANGUAGE_CODE["default"])

    def select_best_voice(
        self,
        gender: str,
        speaking_speed: int = 5,
        vocal_pitch: int = 5,
    ) -> str:
        """
        Select the Gemini voice that best matches desired characteristics.

        Maps frontend speakingSpeed (1-10) and vocalPitch (1-10) to the
        voice with the closest natural characteristics.

        Args:
            gender: "MALE" or "FEMALE"
            speaking_speed: 1-10 scale (1=slow, 10=fast)
            vocal_pitch: 1-10 scale (1=low, 10=high)

        Returns:
            Voice name (e.g., "Kore", "Charon")
        """
        # Filter by gender
        candidates = [
            (name, info) for name, info in GEMINI_VOICES.items()
            if info["gender"] == gender
        ]

        if not candidates:
            candidates = list(GEMINI_VOICES.items())
            logger.warning(f"No voices found for gender '{gender}', using all voices")

        # Clamp input values
        speed = max(1, min(10, speaking_speed))
        pitch = max(1, min(10, vocal_pitch))

        # Find voice with minimum Euclidean distance
        def distance(voice_info: Dict) -> float:
            speed_diff = abs(voice_info["speed"] - speed)
            pitch_diff = abs(voice_info["pitch"] - pitch)
            return (speed_diff ** 2 + pitch_diff ** 2) ** 0.5

        best_voice = min(candidates, key=lambda v: distance(v[1]))
        voice_name = best_voice[0]
        voice_info = best_voice[1]

        logger.info(
            f"Selected voice '{voice_name}' ({voice_info['style']}) for "
            f"speed={speed}, pitch={pitch} (voice: speed={voice_info['speed']}, pitch={voice_info['pitch']})"
        )

        return voice_name

    def get_voice_for_speaker(
        self,
        speaker_type: str,
        gender: str,
        speaking_speed: int = 5,
        vocal_pitch: int = 5,
        speaker_index: int = 0,
    ) -> GeminiVoiceConfig:
        """
        Get appropriate Gemini voice configuration for a speaker.

        Args:
            speaker_type: "HOST", "GUEST1", "GUEST2", etc.
            gender: "MALE" or "FEMALE"
            speaking_speed: 1-10 scale from frontend
            vocal_pitch: 1-10 scale from frontend
            speaker_index: Index for variety selection (guests)

        Returns:
            GeminiVoiceConfig with voice settings
        """
        if speaker_type.upper() in ["HOST", "HOST1", "NARRATOR"]:
            voice_name = self.select_best_voice(gender, speaking_speed, vocal_pitch)
        else:
            # For guests, shift speed/pitch slightly for variety
            speed_offset = (speaker_index % 3) - 1
            pitch_offset = ((speaker_index + 1) % 3) - 1

            adjusted_speed = max(1, min(10, speaking_speed + speed_offset * 2))
            adjusted_pitch = max(1, min(10, vocal_pitch + pitch_offset * 2))

            voice_name = self.select_best_voice(gender, adjusted_speed, adjusted_pitch)

        voice_info = GEMINI_VOICES[voice_name]

        return GeminiVoiceConfig(
            speaker_id=voice_name,
            style=voice_info["style"],
            style_prompt=f"Speak in a {voice_info['style'].lower()} manner",
        )

    def _build_speaker_configs(
        self,
        voice_assignments: Dict[str, str],
    ) -> list:
        """Build speaker voice configs for multi-speaker TTS."""
        from google.genai import types

        configs = []
        for speaker, voice_name in voice_assignments.items():
            configs.append(
                types.SpeakerVoiceConfig(
                    speaker=speaker,
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_name,
                        )
                    )
                )
            )
        return configs

    def _format_script_for_gemini(
        self,
        script: str,
        voice_assignments: Dict[str, str],
    ) -> str:
        """
        Format script with speaker labels for multi-speaker TTS.

        Converts:
            HOST: Hello everyone!
            GUEST: Great to be here!

        To format expected by Gemini multi-speaker:
            Host: Hello everyone!
            Guest: Great to be here!
        """
        formatted_lines = []

        for line in script.split('\n'):
            line = line.strip()
            if not line:
                formatted_lines.append('')
                continue

            # Check for speaker label pattern
            match = re.match(r'^([A-Z0-9_]+):\s*(.+)$', line)
            if match:
                speaker = match.group(1)
                dialogue = match.group(2)
                # Use speaker name as-is for multi-speaker config
                formatted_lines.append(f"{speaker}: {dialogue}")
            else:
                formatted_lines.append(line)

        return '\n'.join(formatted_lines)

    def _needs_chunking(self, script: str) -> bool:
        """Check if script needs to be split into chunks."""
        return len(script) > self.MAX_CHUNK_CHARS

    def _split_script_into_chunks(self, script: str) -> List[str]:
        """
        Split a long script into chunks that fit within Gemini's output limit.

        Splits at speaker turn boundaries to maintain dialogue flow.
        Each chunk stays under MAX_CHUNK_CHARS.

        Returns:
            List of script chunks
        """
        if len(script) <= self.MAX_CHUNK_CHARS:
            return [script]

        chunks = []
        current_chunk = []
        current_length = 0

        # Split by speaker turns (lines starting with SPEAKER:)
        lines = script.split('\n')

        for line in lines:
            line_length = len(line) + 1  # +1 for newline

            # If adding this line would exceed limit, save current chunk
            if current_length + line_length > self.MAX_CHUNK_CHARS and current_chunk:
                chunks.append('\n'.join(current_chunk))
                current_chunk = []
                current_length = 0

            current_chunk.append(line)
            current_length += line_length

        # Don't forget the last chunk
        if current_chunk:
            chunks.append('\n'.join(current_chunk))

        logger.info(f"[Gemini TTS] Split script into {len(chunks)} chunks "
                   f"({len(script)} chars total)")
        for i, chunk in enumerate(chunks):
            logger.info(f"[Gemini TTS] Chunk {i+1}: {len(chunk)} chars")

        return chunks

    def _generate_single_chunk(
        self,
        script: str,
        voice_assignments: Dict[str, str],
        episode_type: str,
        language_code: str,
    ) -> bytes:
        """
        Generate audio for a single chunk of script.

        Returns:
            Raw PCM audio data (not WAV)
        """
        from google.genai import types

        formatted_script = self._format_script_for_gemini(script, voice_assignments)

        # Determine if multi-speaker or single-speaker
        unique_speakers = set(voice_assignments.keys())
        is_multi_speaker = len(unique_speakers) > 1 and episode_type != "MONOLOGUE"

        if is_multi_speaker:
            speaker_configs = self._build_speaker_configs(voice_assignments)
            speech_config = types.SpeechConfig(
                multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                    speaker_voice_configs=speaker_configs
                )
            )
            prompt = formatted_script
        else:
            main_voice = voice_assignments.get("HOST", voice_assignments.get("NARRATOR", "Kore"))
            speech_config = types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=main_voice,
                    )
                )
            )
            clean_script = re.sub(r'^[A-Z0-9_]+:\s*', '', formatted_script, flags=re.MULTILINE)
            prompt = clean_script

        # Generate audio
        response = self.client.models.generate_content(
            model=self.MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=speech_config,
            )
        )

        # Extract PCM audio data
        if response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and candidate.content.parts:
                for part in candidate.content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data:
                        raw_data = part.inline_data.data

                        # Handle base64-encoded data
                        if isinstance(raw_data, str):
                            return base64.b64decode(raw_data)
                        elif isinstance(raw_data, bytes):
                            sample = raw_data[:100]
                            is_likely_base64 = all(
                                (43 <= b <= 122) or b in (10, 13, 32, 61)
                                for b in sample
                            )
                            if is_likely_base64:
                                return base64.b64decode(raw_data)
                            return raw_data
                        return raw_data

        raise GeminiTTSError("No audio data in chunk response")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((GeminiTTSError,)),
        reraise=True,
    )
    def generate_audio(
        self,
        script: str,
        voice_assignments: Optional[Dict[str, str]] = None,
        voice_configs: Optional[Dict[str, GeminiVoiceConfig]] = None,
        episode_type: str = "MONOLOGUE",
        language_code: str = "en-US",
        style_prompt: Optional[str] = None,
    ) -> bytes:
        """
        Generate audio from podcast script using Gemini TTS.

        Args:
            script: The podcast script with speaker labels
            voice_assignments: Map of speaker labels to Gemini voice names
                e.g., {"HOST": "Kore", "GUEST": "Charon"}
            voice_configs: Full voice configurations (overrides voice_assignments)
            episode_type: MONOLOGUE, DUO, or GROUP
            language_code: Language/accent code (en-US, en-GB, en-AU, en-IN)
            style_prompt: Optional override for style guidance

        Returns:
            Audio data as bytes (WAV format, 24kHz)

        Reference: https://ai.google.dev/gemini-api/docs/speech-generation
        """
        if not self.is_available:
            raise GeminiTTSError("Gemini TTS client not configured")

        from google.genai import types

        # Default voice assignments if not provided
        if voice_assignments is None and voice_configs is None:
            voice_assignments = {
                "HOST": "Kore",
                "HOST1": "Kore",
                "NARRATOR": "Kore",
                "GUEST": "Charon",
                "GUEST1": "Charon",
                "GUEST2": "Fenrir",
                "GUEST3": "Puck",
            }

        # Build voice assignments from configs if provided
        if voice_configs and not voice_assignments:
            voice_assignments = {
                speaker: config.speaker_id
                for speaker, config in voice_configs.items()
            }

        logger.info(f"[Gemini TTS] Generating audio for script ({len(script)} chars)")
        logger.info(f"[Gemini TTS] Language: {language_code}")
        logger.info(f"[Gemini TTS] Speakers: {list(set(voice_assignments.values()))}")

        try:
            # Check if script needs chunking (exceeds ~10 min output limit)
            if self._needs_chunking(script):
                logger.info(f"[Gemini TTS] Script exceeds {self.MAX_CHUNK_CHARS} chars, using chunked generation")
                chunks = self._split_script_into_chunks(script)

                # Generate audio for each chunk
                all_pcm_data = []
                total_cost = 0.0

                for i, chunk in enumerate(chunks):
                    logger.info(f"[Gemini TTS] Generating chunk {i+1}/{len(chunks)} ({len(chunk)} chars)...")
                    pcm_data = self._generate_single_chunk(
                        chunk, voice_assignments, episode_type, language_code
                    )
                    all_pcm_data.append(pcm_data)

                    # Calculate cost for this chunk
                    duration_sec = len(pcm_data) / (self.SAMPLE_RATE * self.SAMPLE_WIDTH)
                    audio_tokens = int(duration_sec * self.TOKENS_PER_SECOND)
                    input_tokens = len(chunk) // 4
                    chunk_cost = (input_tokens / 1_000_000) * self.INPUT_PRICE_PER_M + \
                                 (audio_tokens / 1_000_000) * self.OUTPUT_PRICE_PER_M
                    total_cost += chunk_cost
                    logger.info(f"[Gemini TTS] Chunk {i+1} generated: {duration_sec:.1f}s, cost: ${chunk_cost:.4f}")

                # Concatenate all PCM data
                combined_pcm = b''.join(all_pcm_data)
                total_duration = len(combined_pcm) / (self.SAMPLE_RATE * self.SAMPLE_WIDTH)

                logger.info(f"[Gemini TTS] Combined {len(chunks)} chunks: {total_duration:.1f}s total")
                logger.info(f"[Gemini TTS] Total estimated cost: ${total_cost:.4f}")

                # Convert combined PCM to WAV
                audio_data = _pcm_to_wav(combined_pcm)
                logger.info(f"[Gemini TTS] Generated {len(audio_data)} bytes")
                return audio_data

            # Single-call generation for shorter scripts
            # Format script
            formatted_script = self._format_script_for_gemini(script, voice_assignments)

            # Determine if multi-speaker or single-speaker
            unique_speakers = set(voice_assignments.keys())
            is_multi_speaker = len(unique_speakers) > 1 and episode_type != "MONOLOGUE"

            if is_multi_speaker:
                # Multi-speaker configuration
                speaker_configs = self._build_speaker_configs(voice_assignments)
                speech_config = types.SpeechConfig(
                    multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                        speaker_voice_configs=speaker_configs
                    )
                )
                # Pass script directly without instruction prefix to avoid repetition bug
                prompt = formatted_script
            else:
                # Single-speaker configuration
                main_voice = voice_assignments.get("HOST", voice_assignments.get("NARRATOR", "Kore"))
                speech_config = types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=main_voice,
                        )
                    )
                )
                # For monologue, strip speaker labels and pass directly
                # Note: Avoid instruction prefixes as Gemini TTS may read them or cause repetition
                clean_script = re.sub(r'^[A-Z0-9_]+:\s*', '', formatted_script, flags=re.MULTILINE)
                prompt = clean_script

            # Generate audio
            response = self.client.models.generate_content(
                model=self.MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=speech_config,
                )
            )

            # Extract audio data
            if response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                if hasattr(candidate, 'content') and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            raw_data = part.inline_data.data
                            mime_type = getattr(part.inline_data, 'mime_type', 'unknown')

                            # Log diagnostic info
                            logger.info(f"[Gemini TTS] MIME type: {mime_type}")
                            logger.info(f"[Gemini TTS] Data type: {type(raw_data).__name__}")
                            logger.info(f"[Gemini TTS] Data length: {len(raw_data)} bytes")

                            # Log first 50 bytes as hex for debugging
                            if isinstance(raw_data, bytes):
                                first_bytes = raw_data[:50].hex()
                                logger.info(f"[Gemini TTS] First 50 bytes (hex): {first_bytes}")
                                # Also show as ASCII if printable
                                try:
                                    ascii_preview = raw_data[:50].decode('ascii', errors='replace')
                                    logger.info(f"[Gemini TTS] First 50 bytes (ascii): {ascii_preview[:50]}")
                                except:
                                    pass

                            # Handle base64-encoded data
                            if isinstance(raw_data, str):
                                logger.info("[Gemini TTS] Decoding base64 string data")
                                pcm_data = base64.b64decode(raw_data)
                            elif isinstance(raw_data, bytes):
                                # Check if bytes are actually base64-encoded ASCII
                                # Base64 chars are A-Z, a-z, 0-9, +, /, = (ASCII 43-122 range)
                                sample = raw_data[:100]
                                is_likely_base64 = all(
                                    (43 <= b <= 122) or b in (10, 13, 32, 61)  # base64 chars + whitespace + =
                                    for b in sample
                                )

                                if is_likely_base64:
                                    logger.info("[Gemini TTS] Detected base64-encoded bytes, decoding...")
                                    pcm_data = base64.b64decode(raw_data)
                                    logger.info(f"[Gemini TTS] Decoded to {len(pcm_data)} bytes")
                                else:
                                    logger.info("[Gemini TTS] Using raw PCM bytes directly")
                                    pcm_data = raw_data
                            else:
                                pcm_data = raw_data

                            # Convert PCM to WAV
                            audio_data = _pcm_to_wav(pcm_data)

                            # Log metrics
                            duration_estimate = len(pcm_data) / (self.SAMPLE_RATE * self.SAMPLE_WIDTH)
                            audio_tokens = int(duration_estimate * self.TOKENS_PER_SECOND)
                            input_tokens = len(prompt) // 4

                            input_cost = (input_tokens / 1_000_000) * self.INPUT_PRICE_PER_M
                            output_cost = (audio_tokens / 1_000_000) * self.OUTPUT_PRICE_PER_M
                            total_cost = input_cost + output_cost

                            logger.info(f"[Gemini TTS] Generated {len(audio_data)} bytes")
                            logger.info(f"[Gemini TTS] Duration: ~{duration_estimate:.1f}s")
                            logger.info(f"[Gemini TTS] Estimated cost: ${total_cost:.4f}")

                            return audio_data

            raise GeminiTTSError("No audio data in response")

        except GeminiTTSError:
            raise
        except Exception as e:
            error_msg = f"Gemini TTS generation failed: {str(e)}"
            logger.error(error_msg)
            raise GeminiTTSError(error_msg)

    def generate_audio_to_file(
        self,
        script: str,
        output_path: Path,
        voice_assignments: Optional[Dict[str, str]] = None,
        episode_type: str = "MONOLOGUE",
        language_code: str = "en-US",
        style_prompt: Optional[str] = None,
    ) -> int:
        """
        Generate audio and save to file.

        Returns:
            Size of generated file in bytes
        """
        audio_data = self.generate_audio(
            script,
            voice_assignments,
            episode_type=episode_type,
            language_code=language_code,
            style_prompt=style_prompt,
        )

        with open(output_path, "wb") as f:
            f.write(audio_data)

        return len(audio_data)

    def generate_monologue(
        self,
        text: str,
        voice: str = "Kore",
        language_code: str = "en-US",
        style_prompt: Optional[str] = None,
    ) -> bytes:
        """
        Generate single-speaker audio for monologue episodes.

        Args:
            text: The monologue text
            voice: Gemini voice name to use
            language_code: Language/accent code
            style_prompt: Optional style guidance

        Returns:
            Audio data as bytes
        """
        script = f"NARRATOR: {text}"
        return self.generate_audio(
            script,
            voice_assignments={"NARRATOR": voice},
            episode_type="MONOLOGUE",
            language_code=language_code,
            style_prompt=style_prompt,
        )

    def estimate_cost(self, script: str, target_duration_seconds: int) -> float:
        """
        Estimate TTS cost for a script.

        Args:
            script: The podcast script
            target_duration_seconds: Expected audio duration

        Returns:
            Estimated cost in USD
        """
        input_tokens = len(script) // 4
        audio_tokens = target_duration_seconds * self.TOKENS_PER_SECOND

        input_cost = (input_tokens / 1_000_000) * self.INPUT_PRICE_PER_M
        output_cost = (audio_tokens / 1_000_000) * self.OUTPUT_PRICE_PER_M

        return input_cost + output_cost
