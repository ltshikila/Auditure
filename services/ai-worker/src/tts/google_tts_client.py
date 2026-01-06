"""Google Cloud Text-to-Speech client for audio generation."""

import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from google.cloud import texttospeech
from google.oauth2 import service_account

from src.config import get_settings
from .voice_mapper import VoiceConfig

logger = logging.getLogger(__name__)


class GoogleTTSClient:
    """Client for Google Cloud Text-to-Speech API.

    Supports two voice tiers:
    - Standard: $4 per 1 million characters
    - Neural2/WaveNet: $16 per 1 million characters (Neural2 recommended)
    """

    def __init__(self, temp_dir: Optional[str] = None):
        """Initialize Google Cloud TTS client."""
        settings = get_settings()
        self.temp_dir = Path(temp_dir or settings.tts_temp_dir)
        self.voice_tier = settings.tts_voice_tier  # "standard" or "neural"
        self._ensure_temp_dir()

        # Initialize client with credentials
        if settings.google_cloud_credentials_path:
            credentials = service_account.Credentials.from_service_account_file(
                settings.google_cloud_credentials_path
            )
            self.client = texttospeech.TextToSpeechClient(credentials=credentials)
        elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            # Use default credentials from environment
            self.client = texttospeech.TextToSpeechClient()
        else:
            self.client = None
            logger.warning("Google Cloud TTS not configured - no credentials found")

    @property
    def is_available(self) -> bool:
        """Check if Google Cloud TTS is configured."""
        return self.client is not None

    def _ensure_temp_dir(self) -> None:
        """Ensure temp directory exists."""
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def generate_audio(
        self,
        text: str,
        voice_config: VoiceConfig,
        voice_tier: Optional[str] = None,
    ) -> bytes:
        """
        Generate audio from text using Google Cloud TTS.

        Args:
            text: Text to convert to speech
            voice_config: Voice configuration with voice_id, rate, pitch
            voice_tier: Override voice tier ("standard" or "neural")

        Returns:
            Audio data as bytes (MP3 format)
        """
        if not self.is_available:
            raise RuntimeError("Google Cloud TTS client not configured")

        tier = voice_tier or self.voice_tier

        logger.info(f"Generating audio with Google Cloud TTS")
        logger.info(f"Voice: {voice_config.voice_id}, Tier: {tier}")
        logger.info(f"Text length: {len(text)} chars")

        # Set up the text input
        synthesis_input = texttospeech.SynthesisInput(text=text)

        # Configure voice parameters
        voice = texttospeech.VoiceSelectionParams(
            language_code=self._extract_language_code(voice_config.voice_id),
            name=voice_config.voice_id,
        )

        # Parse rate and pitch from voice config
        speaking_rate = self._parse_rate(voice_config.rate)
        pitch = self._parse_pitch(voice_config.pitch)

        # Configure audio output
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=speaking_rate,
            pitch=pitch,
        )

        # Perform the text-to-speech request
        response = self.client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )

        audio_data = response.audio_content

        # Log cost estimate
        char_count = len(text)
        if tier == "neural":
            cost = (char_count / 1_000_000) * 16  # $16/1M chars for Neural2
        else:
            cost = (char_count / 1_000_000) * 4   # $4/1M chars for Standard

        logger.info(f"Generated {len(audio_data)} bytes of audio")
        logger.info(f"Estimated TTS cost: ${cost:.6f}")

        return audio_data

    def generate_audio_to_file(
        self,
        text: str,
        voice_config: VoiceConfig,
        output_path: Path,
        voice_tier: Optional[str] = None,
    ) -> int:
        """
        Generate audio and save directly to file.

        Args:
            text: Text to convert to speech
            voice_config: Voice configuration
            output_path: Path to save the audio file
            voice_tier: Override voice tier

        Returns:
            Size of generated file in bytes
        """
        audio_data = self.generate_audio(text, voice_config, voice_tier)

        with open(output_path, "wb") as f:
            f.write(audio_data)

        return len(audio_data)

    def _extract_language_code(self, voice_id: str) -> str:
        """Extract language code from voice ID (e.g., 'en-US' from 'en-US-Neural2-A')."""
        parts = voice_id.split("-")
        if len(parts) >= 2:
            return f"{parts[0]}-{parts[1]}"
        return "en-US"

    def _parse_rate(self, rate_str: str) -> float:
        """
        Convert rate string to Google TTS speaking_rate.

        Google TTS speaking_rate: 0.25 to 4.0 (1.0 is normal)
        Input format: "+10%", "-20%", "0%"
        """
        try:
            # Remove % and parse
            percentage = int(rate_str.replace("%", "").replace("+", ""))
            # Convert percentage to multiplier
            # +30% -> 1.3, -30% -> 0.7
            rate = 1.0 + (percentage / 100)
            # Clamp to valid range
            return max(0.25, min(4.0, rate))
        except (ValueError, AttributeError):
            return 1.0

    def _parse_pitch(self, pitch_str: str) -> float:
        """
        Convert pitch string to Google TTS pitch.

        Google TTS pitch: -20.0 to 20.0 semitones (0 is default)
        Input format: "+10Hz", "-20Hz"
        """
        try:
            # Remove Hz and parse
            hz = int(pitch_str.replace("Hz", "").replace("+", ""))
            # Map Hz offset to semitones (rough approximation)
            # Our range is -30Hz to +30Hz, map to -10 to +10 semitones
            semitones = (hz / 30) * 10
            # Clamp to valid range
            return max(-20.0, min(20.0, semitones))
        except (ValueError, AttributeError):
            return 0.0

    def list_voices(self, language_code: str = "en-US") -> list:
        """List available voices for a language code."""
        if not self.is_available:
            return []

        response = self.client.list_voices(language_code=language_code)
        return [
            {
                "name": voice.name,
                "language_codes": list(voice.language_codes),
                "gender": texttospeech.SsmlVoiceGender(voice.ssml_gender).name,
                "natural_sample_rate_hertz": voice.natural_sample_rate_hertz,
            }
            for voice in response.voices
        ]
