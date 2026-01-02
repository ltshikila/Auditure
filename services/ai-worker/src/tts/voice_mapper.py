"""Voice mapper for Edge TTS voices."""

import logging
from dataclasses import dataclass
from typing import Optional, Dict

logger = logging.getLogger(__name__)


@dataclass
class VoiceConfig:
    """Voice configuration for TTS."""

    voice_id: str
    gender: str
    accent: str
    rate: str  # e.g., "+10%", "-5%"
    pitch: str  # e.g., "+10Hz", "-5Hz"


class VoiceMapper:
    """Map podcaster settings to Edge TTS voices."""

    # Edge TTS voice mapping by gender and accent
    VOICE_MAP: Dict[str, Dict[str, str]] = {
        "MALE": {
            "United States": "en-US-GuyNeural",
            "United Kingdom": "en-GB-RyanNeural",
            "Australia": "en-AU-WilliamNeural",
            "Canada": "en-CA-LiamNeural",
            "Ireland": "en-IE-ConnorNeural",
            "India": "en-IN-PrabhatNeural",
            "New Zealand": "en-NZ-MitchellNeural",
            "South Africa": "en-ZA-LukeNeural",
            "Singapore": "en-SG-WayneNeural",
            "default": "en-US-GuyNeural",
        },
        "FEMALE": {
            "United States": "en-US-JennyNeural",
            "United Kingdom": "en-GB-SoniaNeural",
            "Australia": "en-AU-NatashaNeural",
            "Canada": "en-CA-ClaraNeural",
            "Ireland": "en-IE-EmilyNeural",
            "India": "en-IN-NeerjaNeural",
            "New Zealand": "en-NZ-MollyNeural",
            "South Africa": "en-ZA-LeahNeural",
            "Singapore": "en-SG-LunaNeural",
            "default": "en-US-JennyNeural",
        },
    }

    def get_voice_id(self, gender: str, accent: str) -> str:
        """
        Get Edge TTS voice ID for gender and accent.

        Args:
            gender: MALE or FEMALE
            accent: Accent/region name

        Returns:
            Edge TTS voice identifier
        """
        gender_voices = self.VOICE_MAP.get(gender, self.VOICE_MAP["MALE"])

        if accent in gender_voices:
            return gender_voices[accent]

        logger.warning(f"Unknown accent '{accent}', using default voice")
        return gender_voices["default"]

    def calculate_rate(self, speaking_speed: int) -> str:
        """
        Convert speaking speed (1-10) to Edge TTS rate.

        Edge TTS uses percentage: -50% to +50%
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
        Convert vocal pitch (1-10) to Edge TTS pitch.

        Edge TTS uses Hz: -50Hz to +50Hz
        We map 1-10 to -30Hz to +30Hz for natural range.

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
        Get complete voice configuration.

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
        - Adjusting pitch
        - Slightly varying speed

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

        # Get base voice for new gender
        voice_id = self.get_voice_id(gender, main_config.accent)

        # Parse current rate and pitch to modify
        current_rate = int(main_config.rate.replace("%", "").replace("+", ""))
        current_pitch = int(main_config.pitch.replace("Hz", "").replace("+", ""))

        # Slight speed variation
        speed_mod = 1 if guest_index % 2 == 0 else -1
        new_rate = max(-30, min(30, current_rate + (speed_mod * 5)))
        new_pitch = max(-30, min(30, current_pitch + (pitch_mod * 10)))

        rate_sign = "+" if new_rate >= 0 else ""
        pitch_sign = "+" if new_pitch >= 0 else ""

        return VoiceConfig(
            voice_id=voice_id,
            gender=gender,
            accent=main_config.accent,
            rate=f"{rate_sign}{new_rate}%",
            pitch=f"{pitch_sign}{new_pitch}Hz",
        )
