"""Edge TTS client for audio generation."""

import asyncio
import logging
import uuid
from pathlib import Path
from typing import Optional

import edge_tts

from src.config import get_settings

from .voice_mapper import VoiceConfig

logger = logging.getLogger(__name__)


class EdgeTTSClient:
    """Client for Microsoft Edge TTS (free, unlimited)."""

    def __init__(self, temp_dir: Optional[str] = None):
        """Initialize Edge TTS client."""
        settings = get_settings()
        self.temp_dir = Path(temp_dir or settings.tts_temp_dir)
        self._ensure_temp_dir()

    def _ensure_temp_dir(self) -> None:
        """Ensure temp directory exists."""
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    async def generate_audio_async(
        self,
        text: str,
        voice_config: VoiceConfig,
    ) -> bytes:
        """
        Generate audio from text using Edge TTS (async).

        Args:
            text: Text to convert to speech
            voice_config: Voice configuration

        Returns:
            Audio data as bytes (MP3 format)
        """
        output_file = self.temp_dir / f"{uuid.uuid4()}.mp3"

        try:
            # Create communicate instance with voice and parameters
            communicate = edge_tts.Communicate(
                text=text,
                voice=voice_config.voice_id,
                rate=voice_config.rate,
                pitch=voice_config.pitch,
            )

            # Save to file
            await communicate.save(str(output_file))

            # Read the file
            with open(output_file, "rb") as f:
                audio_data = f.read()

            logger.debug(f"Generated {len(audio_data)} bytes of audio")
            return audio_data

        finally:
            # Cleanup
            if output_file.exists():
                output_file.unlink()

    def generate_audio(
        self,
        text: str,
        voice_config: VoiceConfig,
    ) -> bytes:
        """
        Generate audio from text using Edge TTS (sync wrapper).

        Args:
            text: Text to convert to speech
            voice_config: Voice configuration

        Returns:
            Audio data as bytes (MP3 format)
        """
        logger.info(f"Generating audio with voice: {voice_config.voice_id}")

        # Run async function in event loop
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(
            self.generate_audio_async(text, voice_config)
        )

    async def generate_audio_to_file_async(
        self,
        text: str,
        voice_config: VoiceConfig,
        output_path: Path,
    ) -> int:
        """
        Generate audio and save directly to file (async).

        Args:
            text: Text to convert to speech
            voice_config: Voice configuration
            output_path: Path to save the audio file

        Returns:
            Size of generated file in bytes
        """
        communicate = edge_tts.Communicate(
            text=text,
            voice=voice_config.voice_id,
            rate=voice_config.rate,
            pitch=voice_config.pitch,
        )

        await communicate.save(str(output_path))

        return output_path.stat().st_size

    def generate_audio_to_file(
        self,
        text: str,
        voice_config: VoiceConfig,
        output_path: Path,
    ) -> int:
        """
        Generate audio and save directly to file (sync wrapper).

        Args:
            text: Text to convert to speech
            voice_config: Voice configuration
            output_path: Path to save the audio file

        Returns:
            Size of generated file in bytes
        """
        logger.info(f"Generating audio to file: {output_path}")

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(
            self.generate_audio_to_file_async(text, voice_config, output_path)
        )
