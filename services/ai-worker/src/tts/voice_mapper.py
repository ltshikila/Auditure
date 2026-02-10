"""Voice mapper for Google Cloud Standard TTS voices.

Maps frontend podcaster configuration (gender, accent, speakingSpeed, vocalPitch)
to Google Cloud Standard TTS voice parameters.

Voice ID Format: {language}-{region}-Standard-{variant}
Example: en-US-Standard-A, en-GB-Standard-B, en-AU-Standard-A

Pricing: $4 per 1 million characters

Reference: https://cloud.google.com/text-to-speech/docs/voices
Reference: https://cloud.google.com/text-to-speech/docs/reference/rest/v1/AudioConfig
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class VoiceConfig:
    """Voice configuration for Google Cloud Standard TTS."""

    voice_id: str
    gender: str
    accent: str
    rate: str  # e.g., "+10%", "-5%"
    pitch: str  # e.g., "+10Hz", "-5Hz"


class VoiceMapper:
    """Map podcaster settings to Google Cloud Standard TTS voices.

    Google Cloud TTS Standard: $4/1M characters
    Used for free tier episodes.

    Voice ID format: {language}-{region}-Standard-{variant}
    Example: en-US-Standard-A
    """

    # Google Cloud TTS Standard voice mapping by gender and accent
    VOICE_MAP: dict[str, dict[str, str]] = {
        "MALE": {
            "United States": "en-US-Standard-A",
            "United Kingdom": "en-GB-Standard-B",
            "Australia": "en-AU-Standard-B",
            "India": "en-IN-Standard-B",
            "default": "en-US-Standard-A",
        },
        "FEMALE": {
            "United States": "en-US-Standard-C",
            "United Kingdom": "en-GB-Standard-A",
            "Australia": "en-AU-Standard-A",
            "India": "en-IN-Standard-A",
            "default": "en-US-Standard-C",
        },
    }

    # Standard voice variants for multi-speaker episodes
    VOICE_VARIANTS: dict[str, list[str]] = {
        "MALE": ["en-US-Standard-A", "en-US-Standard-B", "en-US-Standard-D", "en-US-Standard-I"],
        "FEMALE": ["en-US-Standard-C", "en-US-Standard-E", "en-US-Standard-F", "en-US-Standard-G"],
    }

    def __init__(self):
        """Initialize voice mapper."""
        pass

    def get_voice_id(self, gender: str, accent: str) -> str:
        """
        Get Google Cloud Standard TTS voice ID for gender and accent.

        Args:
            gender: MALE or FEMALE
            accent: Accent/region name

        Returns:
            Google Cloud TTS Standard voice identifier
        """
        gender_voices = self.VOICE_MAP.get(gender, self.VOICE_MAP["MALE"])

        if accent in gender_voices:
            return gender_voices[accent]

        logger.warning(f"Unknown accent '{accent}', using default voice")
        return gender_voices["default"]

    def calculate_rate(self, speaking_speed: int) -> str:
        """
        Convert speaking speed (1-10) to rate string.

        Google TTS uses speaking_rate: 0.25 to 4.0 (1.0 is normal)
        We map 1-10 to -30% to +30% for natural range.

        Args:
            speaking_speed: 1-10 scale

        Returns:
            Rate string like "+15%" or "-10%"
        """
        # Clamp to valid range
        speed = max(1, min(10, speaking_speed))

        # Map 1-10 to -30% to +30%
        # Formula: ((speed - 5.5) / 4.5) * 30
        percentage = ((speed - 5.5) / 4.5) * 30
        percentage = round(percentage)

        sign = "+" if percentage >= 0 else ""
        return f"{sign}{percentage}%"

    def calculate_pitch(self, vocal_pitch: int) -> str:
        """
        Convert vocal pitch (1-10) to pitch string.

        Google TTS uses pitch in semitones: -20.0 to 20.0 (0 is default)
        We map 1-10 to -30Hz to +30Hz which gets converted later.

        Args:
            vocal_pitch: 1-10 scale

        Returns:
            Pitch string like "+15Hz" or "-10Hz"
        """
        # Clamp to valid range
        pitch = max(1, min(10, vocal_pitch))

        # Map 1-10 to -30Hz to +30Hz
        hz = ((pitch - 5.5) / 4.5) * 30
        hz = round(hz)

        sign = "+" if hz >= 0 else ""
        return f"{sign}{hz}Hz"

    def get_voice_config(
        self,
        gender: str,
        accent: str,
        speaking_speed: int = 5,
        vocal_pitch: int = 5,
    ) -> VoiceConfig:
        """
        Get complete voice configuration for Google Cloud Standard TTS.

        Args:
            gender: MALE or FEMALE
            accent: Accent/region name
            speaking_speed: 1-10 scale
            vocal_pitch: 1-10 scale

        Returns:
            VoiceConfig with all TTS parameters
        """
        return VoiceConfig(
            voice_id=self.get_voice_id(gender, accent),
            gender=gender,
            accent=accent,
            rate=self.calculate_rate(speaking_speed),
            pitch=self.calculate_pitch(vocal_pitch),
        )

    def get_contrasting_voice(
        self,
        main_config: VoiceConfig,
        guest_index: int,
    ) -> VoiceConfig:
        """
        Generate a contrasting voice for a guest speaker.

        Creates variety by:
        - Alternating gender
        - Using different voice variants
        - Adjusting pitch and speed

        Args:
            main_config: The main host's voice config
            guest_index: 0-based index of the guest (for variety)

        Returns:
            VoiceConfig for the guest
        """
        # Alternate gender for odd guests
        if guest_index % 2 == 0:
            gender = "FEMALE" if main_config.gender == "MALE" else "MALE"
            pitch_mod = 2
        else:
            gender = main_config.gender
            pitch_mod = -2

        # Get voice variants for variety
        variants = self.VOICE_VARIANTS[gender]

        # Select variant based on guest index
        variant_index = guest_index % len(variants)
        voice_id = variants[variant_index]

        # Parse current rate and pitch to modify
        try:
            current_rate = int(main_config.rate.replace("%", "").replace("+", ""))
        except ValueError:
            current_rate = 0

        try:
            current_pitch = int(main_config.pitch.replace("Hz", "").replace("+", ""))
        except ValueError:
            current_pitch = 0

        # Slight speed variation
        speed_mod = 3 if guest_index % 2 == 0 else -3
        new_rate = max(-30, min(30, current_rate + speed_mod))
        new_pitch = max(-30, min(30, current_pitch + (pitch_mod * 8)))

        rate_sign = "+" if new_rate >= 0 else ""
        pitch_sign = "+" if new_pitch >= 0 else ""

        return VoiceConfig(
            voice_id=voice_id,
            gender=gender,
            accent=main_config.accent,
            rate=f"{rate_sign}{new_rate}%",
            pitch=f"{pitch_sign}{new_pitch}Hz",
        )
