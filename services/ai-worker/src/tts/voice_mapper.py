"""Voice mapper for Google Cloud TTS voices."""

import logging
from dataclasses import dataclass
from typing import Optional, Dict, List

from src.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class VoiceConfig:
    """Voice configuration for TTS."""

    voice_id: str
    gender: str
    accent: str
    rate: str  # e.g., "+10%", "-5%"
    pitch: str  # e.g., "+10Hz", "-5Hz"
    tier: str = "neural"  # "standard" or "neural"


class VoiceMapper:
    """Map podcaster settings to Google Cloud TTS voices.

    Google Cloud TTS Voice Tiers:
    - Standard: Basic voices, $4/1M characters
    - Neural2: High-quality neural voices, $16/1M characters (recommended)

    Voice ID format: {language}-{region}-{type}-{variant}
    Example: en-US-Neural2-A, en-US-Standard-A
    """

    # Google Cloud TTS voice mapping by gender, accent, and tier
    # Neural2 voices are higher quality but cost 4x more
    VOICE_MAP: Dict[str, Dict[str, Dict[str, str]]] = {
        "MALE": {
            "neural": {
                "United States": "en-US-Neural2-A",
                "United Kingdom": "en-GB-Neural2-B",
                "Australia": "en-AU-Neural2-B",
                "Canada": "en-US-Neural2-A",  # Use US for Canada
                "Ireland": "en-GB-Neural2-B",  # Use UK for Ireland
                "India": "en-IN-Neural2-B",
                "default": "en-US-Neural2-A",
            },
            "standard": {
                "United States": "en-US-Standard-A",
                "United Kingdom": "en-GB-Standard-B",
                "Australia": "en-AU-Standard-B",
                "Canada": "en-US-Standard-A",
                "Ireland": "en-GB-Standard-B",
                "India": "en-IN-Standard-B",
                "default": "en-US-Standard-A",
            },
        },
        "FEMALE": {
            "neural": {
                "United States": "en-US-Neural2-C",
                "United Kingdom": "en-GB-Neural2-A",
                "Australia": "en-AU-Neural2-A",
                "Canada": "en-US-Neural2-C",
                "Ireland": "en-GB-Neural2-A",
                "India": "en-IN-Neural2-A",
                "default": "en-US-Neural2-C",
            },
            "standard": {
                "United States": "en-US-Standard-C",
                "United Kingdom": "en-GB-Standard-A",
                "Australia": "en-AU-Standard-A",
                "Canada": "en-US-Standard-C",
                "Ireland": "en-GB-Standard-A",
                "India": "en-IN-Standard-A",
                "default": "en-US-Standard-C",
            },
        },
    }

    # Additional Neural2 voice variants for multi-speaker episodes
    NEURAL2_VARIANTS: Dict[str, List[str]] = {
        "MALE": ["en-US-Neural2-A", "en-US-Neural2-D", "en-US-Neural2-I", "en-US-Neural2-J"],
        "FEMALE": ["en-US-Neural2-C", "en-US-Neural2-E", "en-US-Neural2-F", "en-US-Neural2-G"],
    }

    STANDARD_VARIANTS: Dict[str, List[str]] = {
        "MALE": ["en-US-Standard-A", "en-US-Standard-B", "en-US-Standard-D", "en-US-Standard-I"],
        "FEMALE": ["en-US-Standard-C", "en-US-Standard-E", "en-US-Standard-F", "en-US-Standard-G"],
    }

    def __init__(self):
        """Initialize voice mapper with settings."""
        settings = get_settings()
        self.default_tier = settings.tts_voice_tier

    def get_voice_id(self, gender: str, accent: str, tier: Optional[str] = None) -> str:
        """
        Get Google Cloud TTS voice ID for gender and accent.

        Args:
            gender: MALE or FEMALE
            accent: Accent/region name
            tier: Voice tier ("standard" or "neural"), uses default if not specified

        Returns:
            Google Cloud TTS voice identifier
        """
        tier = tier or self.default_tier
        gender_voices = self.VOICE_MAP.get(gender, self.VOICE_MAP["MALE"])
        tier_voices = gender_voices.get(tier, gender_voices["neural"])

        if accent in tier_voices:
            return tier_voices[accent]

        logger.warning(f"Unknown accent '{accent}', using default voice")
        return tier_voices["default"]

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
        tier: Optional[str] = None,
    ) -> VoiceConfig:
        """
        Get complete voice configuration.

        Args:
            gender: MALE or FEMALE
            accent: Accent/region name
            speaking_speed: 1-10 scale
            vocal_pitch: 1-10 scale
            tier: Voice tier ("standard" or "neural")

        Returns:
            VoiceConfig with all TTS parameters
        """
        tier = tier or self.default_tier
        return VoiceConfig(
            voice_id=self.get_voice_id(gender, accent, tier),
            gender=gender,
            accent=accent,
            rate=self.calculate_rate(speaking_speed),
            pitch=self.calculate_pitch(vocal_pitch),
            tier=tier,
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
        tier = main_config.tier

        # Alternate gender for odd guests
        if guest_index % 2 == 0:
            gender = "FEMALE" if main_config.gender == "MALE" else "MALE"
            pitch_mod = 2
        else:
            gender = main_config.gender
            pitch_mod = -2

        # Get voice variants for variety
        variants = (
            self.NEURAL2_VARIANTS[gender]
            if tier == "neural"
            else self.STANDARD_VARIANTS[gender]
        )

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
            tier=tier,
        )
