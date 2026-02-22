"""Gemini 2.5 TTS client for multi-speaker podcast synthesis.

Uses the official google-genai SDK for text-to-speech.

Gemini TTS Features:
- Native multi-speaker synthesis (exactly 2 voices supported by API)
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
import random
import re
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
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
GEMINI_VOICES: dict[str, dict[str, Any]] = {
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
# Map language codes to Director's Notes accent descriptions
LANGUAGE_CODE_TO_ACCENT_DESCRIPTION = {
    "en-US": None,  # No notes needed - voices are American by default
    "en-GB": "British English accent",
    "en-AU": "Australian English accent",
    "en-IN": "Indian English accent",
}
ACCENT_TO_LANGUAGE_CODE: dict[str, str] = {
    "United States": "en-US",
    "United Kingdom": "en-GB",
    "Australia": "en-AU",
    "India": "en-IN",
    "default": "en-US",
}

# Voice model to preferred Gemini voice styles mapping
# Each voice model maps to a list of preferred styles (in order of preference)
VOICE_MODEL_TO_STYLES: dict[str, list[str]] = {
    "CONVERSATIONAL": ["Easy-going", "Friendly", "Casual", "Warm", "Breezy"],
    "ENERGETIC": ["Bright", "Upbeat", "Excitable", "Lively", "Forward"],
    "CALM": ["Smooth", "Gentle", "Soft", "Even", "Mature"],
    "SARCASTIC": ["Firm", "Gravelly", "Clear", "Forward"],
    "ACADEMIC": ["Informative", "Knowledgeable", "Clear", "Firm", "Even"],
    "CUSTOM": [],  # No style preference, use speed/pitch only
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


def _crossfade_pcm_chunks(
    chunks: list[bytes],
    sample_rate: int = 24000,
    sample_width: int = 2,
    crossfade_ms: int = 50,
) -> bytes:
    """Crossfade multiple PCM audio chunks to eliminate clicks and pops.

    This prevents audio artifacts at chunk boundaries by smoothly
    blending the end of one chunk with the beginning of the next.

    Args:
        chunks: List of raw PCM audio data (16-bit signed)
        sample_rate: Audio sample rate in Hz
        sample_width: Bytes per sample (2 for 16-bit)
        crossfade_ms: Crossfade duration in milliseconds

    Returns:
        Combined PCM data with smooth transitions
    """
    import struct

    if not chunks:
        return b''

    if len(chunks) == 1:
        return chunks[0]

    # Calculate crossfade samples
    crossfade_samples = int(sample_rate * crossfade_ms / 1000)
    bytes_per_sample = sample_width

    # Ensure sample alignment for all chunks
    aligned_chunks = []
    for chunk in chunks:
        # Truncate to align on sample boundaries
        aligned_length = (len(chunk) // bytes_per_sample) * bytes_per_sample
        aligned_chunks.append(chunk[:aligned_length])

    result = bytearray()
    fade_out_data = b''  # Initialize outside loop

    for i, chunk in enumerate(aligned_chunks):
        if i == 0:
            # First chunk: use all but leave room for crossfade at end
            if len(chunk) > crossfade_samples * bytes_per_sample:
                result.extend(chunk[:-crossfade_samples * bytes_per_sample])
                fade_out_data = chunk[-crossfade_samples * bytes_per_sample:]
            else:
                result.extend(chunk)
                fade_out_data = b''
        else:
            # Get crossfade regions
            curr_fade_in = chunk[:crossfade_samples * bytes_per_sample]

            # Perform crossfade if we have both regions
            if fade_out_data and curr_fade_in:
                crossfade_result = bytearray()
                num_samples = min(
                    len(fade_out_data) // bytes_per_sample,
                    len(curr_fade_in) // bytes_per_sample
                )

                for j in range(num_samples):
                    # Calculate fade factor (0 to 1) with smooth curve
                    t = j / max(num_samples - 1, 1)
                    # Use smoothstep for more natural crossfade
                    fade_factor = t * t * (3 - 2 * t)

                    # Extract samples (16-bit signed little-endian)
                    prev_sample = struct.unpack('<h', fade_out_data[j*2:(j+1)*2])[0]
                    curr_sample = struct.unpack('<h', curr_fade_in[j*2:(j+1)*2])[0]

                    # Blend samples
                    blended = int(prev_sample * (1 - fade_factor) + curr_sample * fade_factor)

                    # Clamp to 16-bit range
                    blended = max(-32768, min(32767, blended))

                    crossfade_result.extend(struct.pack('<h', blended))

                result.extend(crossfade_result)
            elif fade_out_data:
                # No fade in data, just add fade out
                result.extend(fade_out_data)

            # Add rest of current chunk (after crossfade region)
            remaining = chunk[crossfade_samples * bytes_per_sample:]

            # Save fade out region for next iteration
            if len(remaining) > crossfade_samples * bytes_per_sample and i < len(aligned_chunks) - 1:
                result.extend(remaining[:-crossfade_samples * bytes_per_sample])
                fade_out_data = remaining[-crossfade_samples * bytes_per_sample:]
            else:
                result.extend(remaining)
                fade_out_data = b''

    return bytes(result)


def _analyze_pcm_chunk(chunk: bytes, chunk_index: int, sample_rate: int = 24000, sample_width: int = 2) -> dict:
    """Analyze PCM chunk for diagnostic purposes.

    Returns metrics about the audio chunk to help identify quality issues.
    """
    import struct

    if not chunk:
        return {"error": "empty chunk", "is_silent": True}

    num_samples = len(chunk) // sample_width
    duration_sec = num_samples / sample_rate

    # Calculate RMS (volume indicator) - sample throughout the chunk
    samples = []
    step = max(1, num_samples // 10000)  # Sample ~10k points spread throughout
    for i in range(0, num_samples, step):
        if i * 2 + 2 <= len(chunk):
            sample = struct.unpack('<h', chunk[i*2:(i+1)*2])[0]
            samples.append(sample)

    if samples:
        rms = (sum(s*s for s in samples) / len(samples)) ** 0.5
        max_amplitude = max(abs(s) for s in samples)
        dc_offset = sum(samples) / len(samples)
    else:
        rms = 0
        max_amplitude = 0
        dc_offset = 0

    # Audio is considered silent if RMS is below threshold
    # Normal speech has RMS of 1000-5000+, silence is typically < 100
    is_silent = rms < 100 and max_amplitude < 500

    return {
        "chunk_index": chunk_index,
        "duration_sec": round(duration_sec, 2),
        "rms": round(rms, 1),
        "max_amplitude": max_amplitude,
        "dc_offset": round(dc_offset, 1),
        "size_bytes": len(chunk),
        "is_silent": is_silent,
    }


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
    MODEL_NAME = "gemini-2.5-pro-preview-tts"

    # Audio output configuration (Gemini outputs PCM 16-bit 24kHz)
    SAMPLE_RATE = 24000
    SAMPLE_WIDTH = 2  # 16-bit
    CHANNELS = 1

    # Pricing (per 1M tokens) - Gemini 2.5 Pro TTS
    # Reference: https://ai.google.dev/gemini-api/docs/pricing
    INPUT_PRICE_PER_M = 1.00    # $1.00 per 1M text tokens
    OUTPUT_PRICE_PER_M = 20.00  # $20.00 per 1M audio tokens
    TOKENS_PER_SECOND = 25      # Audio tokens per second of output

    # Chunking configuration - Gemini TTS has a hard output cap at ~655s (10.9 min)
    # Production logs showed 12000 chars → 10.9 min at actual ~180 wpm, hitting the cap
    # Use conservative 7 min chunks to stay safely under the limit
    MAX_CHUNK_DURATION_SEC = 420  # 7 minutes per chunk
    MAX_CHUNK_CHARS = 7500        # ~7 min at ~180 wpm ≈ 1250 words ≈ 7500 chars

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
        voice_model: str = "CUSTOM",
    ) -> str:
        """
        Select the Gemini voice that best matches desired characteristics.

        Maps frontend speakingSpeed (1-10), vocalPitch (1-10), and voiceModel
        to the voice with the closest natural characteristics and style.

        Args:
            gender: "MALE" or "FEMALE"
            speaking_speed: 1-10 scale (1=slow, 10=fast)
            vocal_pitch: 1-10 scale (1=low, 10=high)
            voice_model: CUSTOM, CONVERSATIONAL, ENERGETIC, CALM, SARCASTIC, ACADEMIC

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

        # Get preferred styles for this voice model
        preferred_styles = VOICE_MODEL_TO_STYLES.get(voice_model.upper(), [])

        # Calculate score for each voice (lower is better)
        # Style matching gives a significant bonus (reduces score)
        def voice_score(voice_info: dict) -> float:
            # Base: Euclidean distance for speed/pitch
            speed_diff = abs(voice_info["speed"] - speed)
            pitch_diff = abs(voice_info["pitch"] - pitch)
            base_distance = (speed_diff ** 2 + pitch_diff ** 2) ** 0.5

            # Style bonus: reduce score if voice style matches preferred styles
            style_bonus = 0.0
            voice_style = voice_info.get("style", "")
            if voice_style in preferred_styles:
                # Higher bonus for earlier (more preferred) styles
                style_rank = preferred_styles.index(voice_style)
                # First preferred style gets -3.0 bonus, decreasing for later styles
                style_bonus = -3.0 + (style_rank * 0.5)
                logger.debug(f"Style '{voice_style}' matches voice_model '{voice_model}', bonus: {style_bonus}")

            return base_distance + style_bonus

        # Sort candidates by score and pick randomly from top 3
        # This ensures variety across episodes while still selecting appropriate voices
        scored = sorted(candidates, key=lambda v: voice_score(v[1]))
        top_candidates = scored[:min(3, len(scored))]
        best_voice = random.choice(top_candidates)
        voice_name = best_voice[0]
        voice_info = best_voice[1]

        top_names = [v[0] for v in top_candidates]
        style_match = "✓" if voice_info.get("style", "") in preferred_styles else ""
        logger.info(
            f"Selected voice '{voice_name}' ({voice_info['style']}{style_match}) from top-3 {top_names} for "
            f"voice_model={voice_model}, speed={speed}, pitch={pitch} "
            f"(voice: speed={voice_info['speed']}, pitch={voice_info['pitch']})"
        )

        return voice_name

    def get_random_guest_voice(self, host_voice: str = "Kore") -> str:
        """
        Select a random guest voice that contrasts with the host.

        Picks a voice of the opposite gender from the host for variety,
        or a different voice of the same gender if needed.

        Args:
            host_voice: The voice name used for the host

        Returns:
            A random voice name for the guest
        """
        host_info = GEMINI_VOICES.get(host_voice, {"gender": "FEMALE"})
        host_gender = host_info["gender"]

        # Prefer opposite gender for contrast
        opposite_gender = "MALE" if host_gender == "FEMALE" else "FEMALE"

        # Get candidates of opposite gender
        candidates = [
            name for name, info in GEMINI_VOICES.items()
            if info["gender"] == opposite_gender
        ]

        # If no opposite gender voices, use same gender but exclude host
        if not candidates:
            candidates = [
                name for name in GEMINI_VOICES.keys()
                if name != host_voice
            ]

        selected = random.choice(candidates)
        logger.info(f"[Gemini TTS] Random guest voice selected: {selected} (host: {host_voice})")
        return selected

    def get_voice_for_speaker(
        self,
        speaker_type: str,
        gender: str,
        speaking_speed: int = 5,
        vocal_pitch: int = 5,
        speaker_index: int = 0,
        voice_model: str = "CUSTOM",
    ) -> GeminiVoiceConfig:
        """
        Get appropriate Gemini voice configuration for a speaker.

        Args:
            speaker_type: "HOST", "GUEST1", "GUEST2", etc.
            gender: "MALE" or "FEMALE"
            speaking_speed: 1-10 scale from frontend
            vocal_pitch: 1-10 scale from frontend
            speaker_index: Index for variety selection (guests)
            voice_model: CUSTOM, CONVERSATIONAL, ENERGETIC, CALM, SARCASTIC, ACADEMIC

        Returns:
            GeminiVoiceConfig with voice settings
        """
        if speaker_type.upper() in ["HOST", "HOST1", "NARRATOR"]:
            voice_name = self.select_best_voice(gender, speaking_speed, vocal_pitch, voice_model)
        else:
            # For guests, shift speed/pitch slightly for variety
            speed_offset = (speaker_index % 3) - 1
            pitch_offset = ((speaker_index + 1) % 3) - 1

            adjusted_speed = max(1, min(10, speaking_speed + speed_offset * 2))
            adjusted_pitch = max(1, min(10, vocal_pitch + pitch_offset * 2))

            # Guests use same voice_model as host for consistency
            voice_name = self.select_best_voice(gender, adjusted_speed, adjusted_pitch, voice_model)

        voice_info = GEMINI_VOICES[voice_name]

        return GeminiVoiceConfig(
            speaker_id=voice_name,
            style=voice_info["style"],
            style_prompt=f"Speak in a {voice_info['style'].lower()} manner",
        )

    def _build_speaker_configs(
        self,
        voice_assignments: dict[str, str],
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
        voice_assignments: dict[str, str],
        language_code: str = "en-US",
        voice_configs: Optional[dict[str, "GeminiVoiceConfig"]] = None,
    ) -> str:
        """
        Format script with speaker labels and Director's Notes for multi-speaker TTS.

        Converts:
            HOST: Hello everyone!
            GUEST: Great to be here!

        To format expected by Gemini multi-speaker:
            [Director's Notes: HOST should speak with warm enthusiasm...
            GUEST should speak with a questioning, probing delivery...
            All speakers should use a British English accent.]
            HOST: Hello everyone!
            GUEST: Great to be here!

        Args:
            script: The raw script with speaker labels
            voice_assignments: Map of speaker labels to voice names
            language_code: Language code for accent (en-US, en-GB, en-AU, en-IN)
            voice_configs: Optional dict of GeminiVoiceConfig with style_prompt per speaker
        """
        formatted_lines = []

        # Build Director's Notes combining per-speaker style prompts and accent
        director_notes_parts = []

        # Per-speaker style prompts (from personality/archetype)
        if voice_configs:
            for speaker, config in voice_configs.items():
                if config.style_prompt:
                    director_notes_parts.append(f"{speaker} should: {config.style_prompt}")

        # Accent guidance for non-US accents
        accent_description = LANGUAGE_CODE_TO_ACCENT_DESCRIPTION.get(language_code)
        if accent_description:
            director_notes_parts.append(
                f"IMPORTANT - All speakers MUST speak with a {accent_description} "
                f"throughout the entire script. Maintain this accent consistently. "
                f"Do NOT switch to an American accent at any point."
            )

        # Combine Director's Notes
        if director_notes_parts:
            notes_text = " ".join(director_notes_parts)
            formatted_lines.append(f"[Director's Notes: {notes_text}]")
            formatted_lines.append("")  # Empty line after notes

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

    def _split_script_into_chunks(self, script: str) -> list[str]:
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
        voice_assignments: dict[str, str],
        episode_type: str,
        language_code: str,
        voice_configs: Optional[dict[str, "GeminiVoiceConfig"]] = None,
    ) -> bytes:
        """
        Generate audio for a single chunk of script.

        Returns:
            Raw PCM audio data (not WAV)
        """
        from google.genai import types

        formatted_script = self._format_script_for_gemini(
            script, voice_assignments, language_code, voice_configs=voice_configs
        )

        # Count actual unique speakers in the chunk
        actual_speakers = set()
        for line in script.split('\n'):
            match = re.match(r'^([A-Z0-9_]+):\s*', line.strip())
            if match:
                actual_speakers.add(match.group(1))

        # Determine if multi-speaker or single-speaker
        is_multi_speaker = len(actual_speakers) > 1 and episode_type != "MONOLOGUE"

        # Gemini multi-speaker API only supports exactly 2 speakers
        # For 3+ speakers, use segment-by-segment generation
        if is_multi_speaker and len(actual_speakers) > 2:
            logger.info(f"[Gemini TTS] Chunk has {len(actual_speakers)} speakers - using segment-by-segment")
            return self._generate_segment_by_segment(script, voice_assignments, language_code, voice_configs=voice_configs)

        if is_multi_speaker:
            # Filter voice_assignments to only include actual speakers
            filtered_assignments = {
                speaker: voice
                for speaker, voice in voice_assignments.items()
                if speaker in actual_speakers
            }
            speaker_configs = self._build_speaker_configs(filtered_assignments)
            speech_config = types.SpeechConfig(
                language_code=language_code,
                multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                    speaker_voice_configs=speaker_configs
                )
            )
            prompt = formatted_script
        else:
            main_voice = voice_assignments.get("HOST", voice_assignments.get("NARRATOR", "Kore"))
            speech_config = types.SpeechConfig(
                language_code=language_code,
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
            if hasattr(candidate, 'content') and candidate.content and candidate.content.parts:
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

        # Log detailed error info for debugging
        if not response.candidates:
            logger.error("[Gemini TTS] Empty response: no candidates returned")
        elif response.candidates:
            candidate = response.candidates[0]
            if not hasattr(candidate, 'content'):
                logger.error("[Gemini TTS] Candidate has no content attribute")
            elif candidate.content is None:
                logger.error("[Gemini TTS] Candidate content is None (possible API issue or content filtering)")
                # Check for finish_reason which might explain why
                if hasattr(candidate, 'finish_reason'):
                    logger.error(f"[Gemini TTS] Finish reason: {candidate.finish_reason}")
            elif not candidate.content.parts:
                logger.error("[Gemini TTS] Candidate content has no parts")

        raise GeminiTTSError("No audio data in chunk response")

    def _generate_segment_by_segment(
        self,
        script: str,
        voice_assignments: dict[str, str],
        language_code: str,
        voice_configs: Optional[dict[str, "GeminiVoiceConfig"]] = None,
    ) -> bytes:
        """
        Generate audio segment-by-segment for 3+ speaker scripts.

        Since Gemini multi-speaker only supports exactly 2 voices, this method
        generates each speaker turn individually with single-speaker mode and
        concatenates them with crossfade.

        Args:
            script: The podcast script with speaker labels
            voice_assignments: Map of speaker labels to Gemini voice names
            language_code: Language/accent code

        Returns:
            Raw PCM audio data (not WAV)
        """
        from google.genai import types

        # Parse script into speaker turns
        turns = []
        current_speaker = None
        current_lines = []

        for line in script.split('\n'):
            line = line.strip()
            if not line:
                continue

            # Check for speaker label pattern
            match = re.match(r'^([A-Z0-9_]+):\s*(.+)$', line)
            if match:
                # Save previous turn
                if current_speaker and current_lines:
                    turns.append((current_speaker, ' '.join(current_lines)))

                current_speaker = match.group(1)
                current_lines = [match.group(2)]
            elif current_speaker:
                # Continuation of current speaker's turn
                current_lines.append(line)

        # Don't forget the last turn
        if current_speaker and current_lines:
            turns.append((current_speaker, ' '.join(current_lines)))

        if not turns:
            raise GeminiTTSError("No speaker turns found in script")

        logger.info(f"[Gemini TTS] Segment-by-segment: {len(turns)} turns to generate")

        # Generate audio for each turn
        all_pcm_data = []

        # Get accent guidance for non-US accents
        accent_description = LANGUAGE_CODE_TO_ACCENT_DESCRIPTION.get(language_code)

        for i, (speaker, dialogue) in enumerate(turns):
            voice = voice_assignments.get(speaker, "Kore")
            logger.info(f"[Gemini TTS] Turn {i+1}/{len(turns)}: {speaker} ({voice}) - {len(dialogue)} chars")

            # Build per-speaker Director's Notes
            notes_parts = []
            if voice_configs and speaker in voice_configs and voice_configs[speaker].style_prompt:
                notes_parts.append(voice_configs[speaker].style_prompt)
            if accent_description:
                notes_parts.append(
                    f"IMPORTANT - You MUST speak with a {accent_description} throughout. "
                    f"Do NOT use an American accent."
                )

            if notes_parts:
                notes_text = " ".join(notes_parts)
                prompt_text = f"[Director's Notes: {notes_text}]\n\n{dialogue}"
            else:
                prompt_text = dialogue

            # Single-speaker generation with retry for silent audio
            max_retries = 3
            pcm_data = None

            for attempt in range(max_retries):
                speech_config = types.SpeechConfig(
                    language_code=language_code,
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice,
                        )
                    )
                )

                try:
                    response = self.client.models.generate_content(
                        model=self.MODEL_NAME,
                        contents=prompt_text,
                        config=types.GenerateContentConfig(
                            response_modalities=["AUDIO"],
                            speech_config=speech_config,
                        )
                    )

                    # Extract PCM audio data
                    if response.candidates and len(response.candidates) > 0:
                        candidate = response.candidates[0]
                        if hasattr(candidate, 'content') and candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, 'inline_data') and part.inline_data:
                                    raw_data = part.inline_data.data

                                    # Handle base64-encoded data
                                    if isinstance(raw_data, str):
                                        pcm_data = base64.b64decode(raw_data)
                                    elif isinstance(raw_data, bytes):
                                        sample = raw_data[:100]
                                        is_likely_base64 = all(
                                            (43 <= b <= 122) or b in (10, 13, 32, 61)
                                            for b in sample
                                        )
                                        if is_likely_base64:
                                            pcm_data = base64.b64decode(raw_data)
                                        else:
                                            pcm_data = raw_data
                                    else:
                                        pcm_data = raw_data

                                    # Validate audio is not silent
                                    chunk_stats = _analyze_pcm_chunk(pcm_data, i, self.SAMPLE_RATE, self.SAMPLE_WIDTH)
                                    duration = chunk_stats["duration_sec"]

                                    if chunk_stats.get("is_silent", False):
                                        logger.warning(
                                            f"[Gemini TTS] Turn {i+1} audio is SILENT "
                                            f"(attempt {attempt+1}/{max_retries}): "
                                            f"RMS={chunk_stats['rms']}, max={chunk_stats['max_amplitude']}"
                                        )
                                        logger.warning(f"[Gemini TTS] Silent dialogue: {dialogue[:100]}...")
                                        if attempt < max_retries - 1:
                                            pcm_data = None  # Reset to trigger retry
                                            continue  # Retry
                                        else:
                                            logger.error(f"[Gemini TTS] Turn {i+1} still silent after {max_retries} attempts")
                                            # Use the silent audio as last resort
                                    else:
                                        logger.info(
                                            f"[Gemini TTS] Turn {i+1} generated: {duration:.1f}s "
                                            f"(RMS={chunk_stats['rms']}, max={chunk_stats['max_amplitude']})"
                                        )
                                    break
                            else:
                                raise GeminiTTSError(f"No audio data in turn {i+1} response")
                        else:
                            raise GeminiTTSError(f"No content in turn {i+1} response")
                    else:
                        raise GeminiTTSError(f"No candidates in turn {i+1} response")

                    # If we got valid audio, break out of retry loop
                    if pcm_data is not None:
                        break

                except GeminiTTSError:
                    raise
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"[Gemini TTS] Turn {i+1} failed (attempt {attempt+1}), retrying: {e}")
                        continue
                    raise GeminiTTSError(f"Failed to generate turn {i+1}: {str(e)}") from e

            if pcm_data is None:
                raise GeminiTTSError(f"Failed to generate audio for turn {i+1} after {max_retries} attempts")

            all_pcm_data.append(pcm_data)

        # Crossfade all segments
        logger.info(f"[Gemini TTS] Crossfading {len(all_pcm_data)} segments...")
        combined_pcm = _crossfade_pcm_chunks(
            all_pcm_data,
            sample_rate=self.SAMPLE_RATE,
            sample_width=self.SAMPLE_WIDTH,
            crossfade_ms=30,  # Shorter crossfade for segment transitions
        )

        total_duration = len(combined_pcm) / (self.SAMPLE_RATE * self.SAMPLE_WIDTH)
        logger.info(f"[Gemini TTS] Segment-by-segment complete: {total_duration:.1f}s total")

        return combined_pcm

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((GeminiTTSError,)),
        reraise=True,
    )
    def generate_audio(
        self,
        script: str,
        voice_assignments: Optional[dict[str, str]] = None,
        voice_configs: Optional[dict[str, GeminiVoiceConfig]] = None,
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
            episode_type: MONOLOGUE or DUO
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
            host_voice = "Kore"
            guest_voice = self.get_random_guest_voice(host_voice)
            voice_assignments = {
                "HOST": host_voice,
                "HOST1": host_voice,
                "NARRATOR": host_voice,
                "GUEST": guest_voice,
                "GUEST1": guest_voice,
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

                    # Retry logic for silent audio detection
                    max_chunk_retries = 2
                    pcm_data = None

                    for attempt in range(max_chunk_retries):
                        pcm_data = self._generate_single_chunk(
                            chunk, voice_assignments, episode_type, language_code,
                            voice_configs=voice_configs,
                        )

                        # Analyze chunk audio quality
                        chunk_stats = _analyze_pcm_chunk(pcm_data, i, self.SAMPLE_RATE, self.SAMPLE_WIDTH)

                        if chunk_stats.get("is_silent", False):
                            logger.warning(
                                f"[Gemini TTS] Chunk {i+1} audio is SILENT "
                                f"(attempt {attempt+1}/{max_chunk_retries}): "
                                f"RMS={chunk_stats['rms']}, max={chunk_stats['max_amplitude']}"
                            )
                            # Log first 200 chars of chunk to identify problematic content
                            logger.warning(f"[Gemini TTS] Silent chunk content preview: {chunk[:200]}...")
                            if attempt < max_chunk_retries - 1:
                                continue  # Retry
                            else:
                                logger.error(f"[Gemini TTS] Chunk {i+1} still silent after {max_chunk_retries} attempts")
                        else:
                            break  # Audio is valid

                    all_pcm_data.append(pcm_data)

                    # Calculate cost for this chunk
                    duration_sec = len(pcm_data) / (self.SAMPLE_RATE * self.SAMPLE_WIDTH)
                    audio_tokens = int(duration_sec * self.TOKENS_PER_SECOND)
                    input_tokens = len(chunk) // 4
                    chunk_cost = (input_tokens / 1_000_000) * self.INPUT_PRICE_PER_M + \
                                 (audio_tokens / 1_000_000) * self.OUTPUT_PRICE_PER_M
                    total_cost += chunk_cost

                    logger.info(f"[Gemini TTS] Chunk {i+1} generated: {duration_sec:.1f}s, cost: ${chunk_cost:.4f}")
                    logger.info(f"[Gemini TTS] Chunk {i+1} audio stats: RMS={chunk_stats['rms']}, max={chunk_stats['max_amplitude']}, dc_offset={chunk_stats['dc_offset']}")

                # Concatenate all PCM data with crossfade to prevent audio artifacts
                logger.info(f"[Gemini TTS] Crossfading {len(all_pcm_data)} chunks...")
                combined_pcm = _crossfade_pcm_chunks(
                    all_pcm_data,
                    sample_rate=self.SAMPLE_RATE,
                    sample_width=self.SAMPLE_WIDTH,
                    crossfade_ms=50,  # 50ms crossfade for smooth transitions
                )
                total_duration = len(combined_pcm) / (self.SAMPLE_RATE * self.SAMPLE_WIDTH)

                logger.info(f"[Gemini TTS] Combined {len(chunks)} chunks: {total_duration:.1f}s total")
                logger.info(f"[Gemini TTS] Total estimated cost: ${total_cost:.4f}")

                # Convert combined PCM to WAV
                audio_data = _pcm_to_wav(combined_pcm)
                logger.info(f"[Gemini TTS] Generated {len(audio_data)} bytes")
                return audio_data

            # Single-call generation for shorter scripts
            # Format script with per-speaker Director's Notes
            formatted_script = self._format_script_for_gemini(
                script, voice_assignments, language_code, voice_configs=voice_configs
            )

            # Count actual unique speakers in the script
            actual_speakers = set()
            for line in script.split('\n'):
                match = re.match(r'^([A-Z0-9_]+):\s*', line.strip())
                if match:
                    actual_speakers.add(match.group(1))

            # Determine if multi-speaker or single-speaker
            set(voice_assignments.keys())
            is_multi_speaker = len(actual_speakers) > 1 and episode_type != "MONOLOGUE"

            # Gemini multi-speaker API only supports exactly 2 speakers
            # For 3+ speakers, fall back to segment-by-segment generation
            if is_multi_speaker and len(actual_speakers) > 2:
                logger.info(f"[Gemini TTS] {len(actual_speakers)} speakers detected - using segment-by-segment generation")
                logger.info(f"[Gemini TTS] Actual speakers: {actual_speakers}")
                pcm_data = self._generate_segment_by_segment(
                    script, voice_assignments, language_code,
                    voice_configs=voice_configs,
                )
                audio_data = _pcm_to_wav(pcm_data)
                logger.info(f"[Gemini TTS] Generated {len(audio_data)} bytes via segment-by-segment")
                return audio_data

            if is_multi_speaker:
                # Multi-speaker configuration (exactly 2 speakers)
                # Filter voice_assignments to only include actual speakers in script
                filtered_assignments = {
                    speaker: voice
                    for speaker, voice in voice_assignments.items()
                    if speaker in actual_speakers
                }
                speaker_configs = self._build_speaker_configs(filtered_assignments)
                speech_config = types.SpeechConfig(
                    language_code=language_code,
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
                    language_code=language_code,
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
                if hasattr(candidate, 'content') and candidate.content and candidate.content.parts:
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
                                except Exception:
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
            raise GeminiTTSError(error_msg) from e

    def generate_audio_to_file(
        self,
        script: str,
        output_path: Path,
        voice_assignments: Optional[dict[str, str]] = None,
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
