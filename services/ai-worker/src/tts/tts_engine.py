"""TTS engine orchestrator."""

import logging
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Optional

from src.config import get_settings
from .voice_mapper import VoiceMapper, VoiceConfig
from .edge_tts_client import EdgeTTSClient
from .script_parser import ScriptParser, SpeakerSegment
from .audio_processor import AudioProcessor

logger = logging.getLogger(__name__)


@dataclass
class TTSResult:
    """Result of TTS generation."""

    audio_buffer: bytes
    duration: int  # seconds
    format: str  # "mp3"


@dataclass
class PodcasterVoice:
    """Podcaster voice settings."""

    gender: str  # MALE, FEMALE
    accent: str
    speaking_speed: int  # 1-10
    vocal_pitch: int  # 1-10


class TTSEngine:
    """Orchestrates text-to-speech generation."""

    def __init__(self):
        """Initialize TTS engine with components."""
        settings = get_settings()
        self.voice_mapper = VoiceMapper()
        self.tts_client = EdgeTTSClient()
        self.script_parser = ScriptParser()
        self.audio_processor = AudioProcessor()
        self.words_per_minute = settings.words_per_minute
        self.temp_dir = Path(settings.tts_temp_dir)

    def generate(
        self,
        script: str,
        podcaster_voice: PodcasterVoice,
        episode_type: str,
    ) -> TTSResult:
        """
        Generate audio from podcast script.

        Args:
            script: The podcast script text
            podcaster_voice: Main podcaster's voice settings
            episode_type: MONOLOGUE, DUO, or GROUP

        Returns:
            TTSResult with audio buffer and metadata
        """
        logger.info(f"Generating TTS for {episode_type} episode")

        # Parse script into segments
        segments = self.script_parser.parse(script, episode_type)
        logger.info(f"Parsed {len(segments)} segments")

        if episode_type == "MONOLOGUE":
            return self._generate_monologue(segments, podcaster_voice)
        else:
            return self._generate_multi_voice(segments, podcaster_voice)

    def _generate_monologue(
        self,
        segments: List[SpeakerSegment],
        podcaster_voice: PodcasterVoice,
    ) -> TTSResult:
        """Generate audio for monologue (single voice)."""
        # Get voice config for main podcaster
        voice_config = self.voice_mapper.get_voice_config(
            gender=podcaster_voice.gender,
            accent=podcaster_voice.accent,
            speaking_speed=podcaster_voice.speaking_speed,
            vocal_pitch=podcaster_voice.vocal_pitch,
        )

        # Combine all text
        full_text = " ".join(seg.text for seg in segments)

        # Generate audio
        audio_buffer = self.tts_client.generate_audio(full_text, voice_config)

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
        )

    def _generate_multi_voice(
        self,
        segments: List[SpeakerSegment],
        main_podcaster: PodcasterVoice,
    ) -> TTSResult:
        """Generate audio for multi-voice episodes (DUO/GROUP)."""
        # Get unique speakers
        speakers = self.script_parser.get_unique_speakers(segments)
        logger.info(f"Speakers: {speakers}")

        # Create voice configs for each speaker
        voice_configs = self._assign_voices(speakers, main_podcaster)

        # Generate audio for each segment
        audio_buffers: List[bytes] = []
        temp_files: List[Path] = []

        try:
            for i, segment in enumerate(segments):
                voice_config = voice_configs[segment.speaker]
                logger.debug(f"Generating segment {i+1}/{len(segments)}: {segment.speaker}")

                audio_buffer = self.tts_client.generate_audio(
                    segment.text, voice_config
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
            )

        finally:
            # Cleanup any temp files
            self.audio_processor.cleanup_temp_files(temp_files)

    def _assign_voices(
        self,
        speakers: List[str],
        main_podcaster: PodcasterVoice,
    ) -> Dict[str, VoiceConfig]:
        """Assign voice configs to each speaker."""
        voice_configs: Dict[str, VoiceConfig] = {}

        # Main podcaster's voice config
        main_config = self.voice_mapper.get_voice_config(
            gender=main_podcaster.gender,
            accent=main_podcaster.accent,
            speaking_speed=main_podcaster.speaking_speed,
            vocal_pitch=main_podcaster.vocal_pitch,
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
