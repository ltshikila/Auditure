"""Gemini 2.5 TTS client for multi-speaker podcast synthesis.

Gemini TTS Features:
- Native multi-speaker synthesis (up to 9 distinct voices)
- Natural dialogue with non-verbal cues ([sigh], [laugh], [inhale], etc.)
- Podcast-optimized output quality
- Style prompts for voice customization
- Regional accent support (en-US, en-GB, en-AU, en-IN)

Available Models:
- gemini-2.5-flash-tts: Low latency, multi-speaker ($0.50/1M input, $10/1M output)
- gemini-2.5-pro-tts: High control for podcasts ($1.00/1M input, $20/1M output)

Voice Selection:
- 30 distinct voices with unique characteristics
- Voices mapped by perceived speed, pitch, and gender
- Frontend speakingSpeed/vocalPitch → best matching voice

Reference: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
Reference: https://ai.google.dev/gemini-api/docs/speech-generation
"""

import base64
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

import google.generativeai as genai
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
# Reference: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#available_languages
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


class GeminiTTSClient:
    """Client for Gemini TTS API.

    Supports native multi-speaker dialogue synthesis with natural
    conversational qualities optimized for podcast content.

    Voice selection algorithm:
    1. Filter by gender (from podcaster config)
    2. Map accent to language_code (en-US, en-GB, en-AU, en-IN)
    3. Select voice closest to desired speakingSpeed and vocalPitch
    """

    # Gemini model for TTS
    MODEL_NAME = "gemini-2.5-pro-preview-tts"

    # Audio output configuration
    AUDIO_CONFIG = {
        "encoding": "LINEAR16",  # 16-bit PCM
        "sample_rate_hertz": 24000,
    }

    # Pricing (per 1M tokens) - Gemini 2.5 Pro TTS
    # Reference: https://ai.google.dev/gemini-api/docs/pricing
    INPUT_PRICE_PER_M = 1.00
    OUTPUT_PRICE_PER_M = 20.00
    TOKENS_PER_SECOND = 25  # Audio tokens per second of output

    def __init__(self, temp_dir: Optional[str] = None):
        """Initialize Gemini TTS client."""
        settings = get_settings()
        self.temp_dir = Path(temp_dir or settings.tts_temp_dir)
        self._ensure_temp_dir()

        # Configure Gemini API
        self.api_key = settings.gemini_api_key
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(self.MODEL_NAME)
        else:
            self.model = None
            logger.warning("Gemini TTS not configured - no API key found")

    @property
    def is_available(self) -> bool:
        """Check if Gemini TTS is configured."""
        return self.model is not None

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

        Reference: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#available_languages
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

        Algorithm:
        1. Filter voices by gender
        2. Calculate distance to each voice's natural speed/pitch
        3. Return voice with minimum distance
        """
        # Filter by gender
        candidates = [
            (name, info) for name, info in GEMINI_VOICES.items()
            if info["gender"] == gender
        ]

        if not candidates:
            # Fallback if no gender match
            candidates = list(GEMINI_VOICES.items())
            logger.warning(f"No voices found for gender '{gender}', using all voices")

        # Clamp input values
        speed = max(1, min(10, speaking_speed))
        pitch = max(1, min(10, vocal_pitch))

        # Find voice with minimum Euclidean distance to desired characteristics
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
            # Use best matching voice for host
            voice_name = self.select_best_voice(gender, speaking_speed, vocal_pitch)
        else:
            # For guests, we want variety - shift speed/pitch slightly
            # and use alternating gender if desired
            speed_offset = (speaker_index % 3) - 1  # -1, 0, 1
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

    def _format_script_for_gemini(
        self,
        script: str,
        voice_assignments: Dict[str, str],
    ) -> str:
        """
        Format script with Gemini-compatible speaker tags.

        Converts:
            HOST: Hello everyone!
            GUEST: Great to be here!

        To Gemini's multi-speaker format with voice assignments:
            Kore: Hello everyone!
            Charon: Great to be here!

        Reference: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#prompting_tips
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

                # Map to Gemini voice name
                voice_name = voice_assignments.get(speaker, voice_assignments.get("HOST", "Kore"))
                formatted_lines.append(f"{voice_name}: {dialogue}")
            else:
                # Non-dialogue line (narration or continuation)
                formatted_lines.append(line)

        return '\n'.join(formatted_lines)

    def _build_style_prompt(
        self,
        episode_type: str,
        voice_configs: Dict[str, GeminiVoiceConfig],
    ) -> str:
        """
        Build style prompt for Gemini TTS based on episode type.

        Follows the "Three Levers of Speech Control" from docs:
        1. Style Prompt - emotional tone and delivery context
        2. Text Content - semantic meaning (handled in script)
        3. Markup Tags - localized style changes (handled in script)

        Reference: https://ai.google.dev/gemini-api/docs/speech-generation#prompting-guide
        """
        # Build character descriptions
        characters = []
        for speaker, config in voice_configs.items():
            characters.append(f"- {config.speaker_id}: {config.style} delivery")

        characters_str = "\n".join(characters)

        if episode_type == "MONOLOGUE":
            return f"""You are generating audio for a podcast episode.

Audio Profile:
{characters_str}

Scene: An intimate podcast recording studio. The host speaks directly to dedicated listeners.

Director's Notes:
- Speak naturally and engagingly, as if recording for loyal subscribers
- Include appropriate pauses for emphasis and to let ideas sink in
- Render any markup tags naturally: [sigh], [laugh], [pause], etc.
- Maintain a warm, conversational tone throughout
- The 'Vocal Smile': Keep the tone bright and inviting"""

        elif episode_type == "DUO":
            return f"""You are generating audio for a two-person podcast conversation.

Audio Profile:
{characters_str}

Scene: A comfortable podcast studio where two hosts have great chemistry.

Director's Notes:
- Create natural, flowing conversation with authentic reactions
- React genuinely to what the other person says - agreement, surprise, curiosity
- Include natural speech patterns: brief pauses, thinking sounds, laughter
- Render markup tags naturally: [sigh], [laugh], [uhm], [pause], etc.
- Build on each other's points organically
- Maintain distinct voice personalities while keeping chemistry"""

        else:  # GROUP
            return f"""You are generating audio for a group podcast discussion.

Audio Profile:
{characters_str}

Scene: An energetic podcast studio with multiple hosts in lively discussion.

Director's Notes:
- Create dynamic group conversation with multiple perspectives
- Allow for natural interruptions and building on ideas
- Each speaker should have a distinct personality and speaking style
- Include reactions, agreements, and friendly disagreements
- Render markup tags naturally: [sigh], [laugh], [uhm], [pause], etc.
- Maintain energy and engagement throughout the discussion
- Balance speaking time while keeping conversation natural"""

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
            script: The podcast script with speaker labels and markup tags
            voice_assignments: Map of speaker labels to Gemini voice names
                e.g., {"HOST": "Kore", "GUEST": "Charon"}
            voice_configs: Full voice configurations (overrides voice_assignments)
            episode_type: MONOLOGUE, DUO, or GROUP
            language_code: Language/accent code (en-US, en-GB, en-AU, en-IN)
            style_prompt: Optional override for style guidance

        Returns:
            Audio data as bytes (WAV format, 24kHz)

        Reference: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
        """
        if not self.is_available:
            raise GeminiTTSError("Gemini TTS client not configured")

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

        # Format script for Gemini
        formatted_script = self._format_script_for_gemini(script, voice_assignments)

        # Build style prompt
        if style_prompt is None:
            if voice_configs:
                style_prompt = self._build_style_prompt(episode_type, voice_configs)
            else:
                # Create minimal configs for style prompt
                minimal_configs = {
                    speaker: GeminiVoiceConfig(
                        speaker_id=voice_name,
                        style=GEMINI_VOICES.get(voice_name, {}).get("style", "Natural"),
                    )
                    for speaker, voice_name in voice_assignments.items()
                }
                style_prompt = self._build_style_prompt(episode_type, minimal_configs)

        prompt = f"""{style_prompt}

Language/Accent: {language_code}

Generate podcast audio for the following script. Each line starts with the speaker's name followed by their dialogue. Render all markup tags naturally.

{formatted_script}"""

        logger.info(f"[Gemini TTS] Generating audio for script ({len(script)} chars)")
        logger.info(f"[Gemini TTS] Language: {language_code}")
        logger.info(f"[Gemini TTS] Speakers: {list(set(voice_assignments.values()))}")

        try:
            # Generate audio using Gemini
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="audio/wav",
                ),
            )

            # Extract audio data from response
            if response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                if hasattr(candidate, 'content') and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            audio_data = base64.b64decode(part.inline_data.data)

                            # Log metrics
                            duration_estimate = len(audio_data) / (24000 * 2)  # 24kHz, 16-bit
                            audio_tokens = int(duration_estimate * self.TOKENS_PER_SECOND)
                            input_tokens = len(prompt) // 4  # Rough estimate

                            input_cost = (input_tokens / 1_000_000) * self.INPUT_PRICE_PER_M
                            output_cost = (audio_tokens / 1_000_000) * self.OUTPUT_PRICE_PER_M
                            total_cost = input_cost + output_cost

                            logger.info(f"[Gemini TTS] Generated {len(audio_data)} bytes")
                            logger.info(f"[Gemini TTS] Duration: ~{duration_estimate:.1f}s")
                            logger.info(f"[Gemini TTS] Estimated cost: ${total_cost:.4f}")

                            return audio_data

            raise GeminiTTSError("No audio data in response")

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

        Args:
            script: The podcast script
            output_path: Path to save the audio file
            voice_assignments: Speaker to voice mapping
            episode_type: MONOLOGUE, DUO, or GROUP
            language_code: Language/accent code
            style_prompt: Optional style guidance

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
        # Format as single-speaker script
        script = f"{voice}: {text}"
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
        input_tokens = len(script) // 4  # Rough estimate
        audio_tokens = target_duration_seconds * self.TOKENS_PER_SECOND

        input_cost = (input_tokens / 1_000_000) * self.INPUT_PRICE_PER_M
        output_cost = (audio_tokens / 1_000_000) * self.OUTPUT_PRICE_PER_M

        return input_cost + output_cost
