"""TTS engine orchestrator using Google Cloud TTS."""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Optional

from src.config import get_settings
from .voice_mapper import VoiceMapper, VoiceConfig
from .google_tts_client import GoogleTTSClient
from .script_parser import ScriptParser, SpeakerSegment
from .audio_processor import AudioProcessor

logger = logging.getLogger(__name__)


@dataclass
class TTSResult:
    """Result of TTS generation."""

    audio_buffer: bytes
    duration: int  # seconds
    format: str  # "mp3"
    estimated_cost: float  # Estimated TTS cost in USD


@dataclass
class PodcasterVoice:
    """Podcaster voice settings."""

    gender: str  # MALE, FEMALE
    accent: str
    speaking_speed: int  # 1-10
    vocal_pitch: int  # 1-10


class TTSEngine:
    """Orchestrates text-to-speech generation using Google Cloud TTS."""

    def __init__(self, voice_tier: Optional[str] = None):
        """Initialize TTS engine with components.

        Args:
            voice_tier: Override voice tier ("standard" or "neural")
        """
        settings = get_settings()
        self.voice_tier = voice_tier or settings.tts_voice_tier
        self.voice_mapper = VoiceMapper()
        self.tts_client = GoogleTTSClient()
        self.script_parser = ScriptParser()
        self.audio_processor = AudioProcessor()
        self.words_per_minute = settings.words_per_minute
        self.temp_dir = Path(settings.tts_temp_dir)

    def generate(
        self,
        script: str,
        podcaster_voice: PodcasterVoice,
        episode_type: str,
        voice_tier: Optional[str] = None,
    ) -> TTSResult:
        """
        Generate audio from podcast script.

        Args:
            script: The podcast script text
            podcaster_voice: Main podcaster's voice settings
            episode_type: MONOLOGUE, DUO, or GROUP
            voice_tier: Override voice tier for this episode

        Returns:
            TTSResult with audio buffer, duration, and cost estimate
        """
        tier = voice_tier or self.voice_tier
        logger.info(f"Generating TTS for {episode_type} episode using {tier} voices")

        # Parse script into segments
        segments = self.script_parser.parse(script, episode_type)
        logger.info(f"Parsed {len(segments)} segments")

        # Calculate total characters for cost estimation
        total_chars = sum(len(seg.text) for seg in segments)

        if episode_type == "MONOLOGUE":
            result = self._generate_monologue(segments, podcaster_voice, tier)
        else:
            result = self._generate_multi_voice(segments, podcaster_voice, tier)

        # Calculate cost estimate
        if tier == "neural":
            cost = (total_chars / 1_000_000) * 16  # $16/1M chars
        else:
            cost = (total_chars / 1_000_000) * 4   # $4/1M chars

        result.estimated_cost = cost
        logger.info(f"TTS generation complete. Duration: {result.duration}s, Est. cost: ${cost:.4f}")

        return result

    def _generate_monologue(
        self,
        segments: List[SpeakerSegment],
        podcaster_voice: PodcasterVoice,
        voice_tier: str,
    ) -> TTSResult:
        """Generate audio for monologue (single voice)."""
        # Get voice config for main podcaster
        voice_config = self.voice_mapper.get_voice_config(
            gender=podcaster_voice.gender,
            accent=podcaster_voice.accent,
            speaking_speed=podcaster_voice.speaking_speed,
            vocal_pitch=podcaster_voice.vocal_pitch,
            tier=voice_tier,
        )

        # Combine all text
        full_text = " ".join(seg.text for seg in segments)

        # Generate audio
        audio_buffer = self.tts_client.generate_audio(
            full_text, voice_config, voice_tier
        )

        # Get duration
        duration = self.audio_processor.get_buffer_duration(audio_buffer)
        if duration == 0:
            # Estimate if ffprobe unavailable
            duration = self.script_parser.estimate_duration(
                segments, self.words_per_minute
            )

        return TTSResult(
            audio_buffer=audio_buffer,
            duration=duration,
            format="mp3",
            estimated_cost=0.0,  # Will be set by caller
        )

    def _generate_multi_voice(
        self,
        segments: List[SpeakerSegment],
        main_podcaster: PodcasterVoice,
        voice_tier: str,
    ) -> TTSResult:
        """Generate audio for multi-voice episodes (DUO/GROUP)."""
        # Get unique speakers
        speakers = self.script_parser.get_unique_speakers(segments)
        logger.info(f"Speakers: {speakers}")

        # Create voice configs for each speaker
        voice_configs = self._assign_voices(speakers, main_podcaster, voice_tier)

        # Generate audio for each segment
        audio_buffers: List[bytes] = []
        temp_files: List[Path] = []

        try:
            for i, segment in enumerate(segments):
                voice_config = voice_configs[segment.speaker]
                logger.debug(f"Generating segment {i+1}/{len(segments)}: {segment.speaker}")

                audio_buffer = self.tts_client.generate_audio(
                    segment.text, voice_config, voice_tier
                )
                audio_buffers.append(audio_buffer)

            # Concatenate all audio
            if len(audio_buffers) == 1:
                combined_buffer = audio_buffers[0]
            else:
                combined_buffer = self.audio_processor.concatenate_audio_buffers(
                    audio_buffers
                )

            # Get duration
            duration = self.audio_processor.get_buffer_duration(combined_buffer)
            if duration == 0:
                duration = self.script_parser.estimate_duration(
                    segments, self.words_per_minute
                )

            return TTSResult(
                audio_buffer=combined_buffer,
                duration=duration,
                format="mp3",
                estimated_cost=0.0,  # Will be set by caller
            )

        finally:
            # Cleanup any temp files
            self.audio_processor.cleanup_temp_files(temp_files)

    def _assign_voices(
        self,
        speakers: List[str],
        main_podcaster: PodcasterVoice,
        voice_tier: str,
    ) -> Dict[str, VoiceConfig]:
        """Assign voice configs to each speaker."""
        voice_configs: Dict[str, VoiceConfig] = {}

        # Main podcaster's voice config
        main_config = self.voice_mapper.get_voice_config(
            gender=main_podcaster.gender,
            accent=main_podcaster.accent,
            speaking_speed=main_podcaster.speaking_speed,
            vocal_pitch=main_podcaster.vocal_pitch,
            tier=voice_tier,
        )

        guest_index = 0

        for speaker in speakers:
            speaker_upper = speaker.upper()

            if speaker_upper in ["HOST", "HOST1", "NARRATOR"]:
                # Use main podcaster voice
                voice_configs[speaker] = main_config
            else:
                # Generate contrasting voice for guests
                voice_configs[speaker] = self.voice_mapper.get_contrasting_voice(
                    main_config, guest_index
                )
                guest_index += 1
                logger.debug(
                    f"Assigned {voice_configs[speaker].voice_id} to {speaker}"
                )

        return voice_configs
