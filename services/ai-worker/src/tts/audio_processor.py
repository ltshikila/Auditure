"""Audio processing utilities using ffmpeg."""

import logging
import subprocess
import uuid
from pathlib import Path
from typing import Optional

from src.config import get_settings

logger = logging.getLogger(__name__)


class AudioProcessingError(Exception):
    """Custom exception for audio processing errors."""

    pass


class AudioProcessor:
    """Audio processing utilities using ffmpeg."""

    def __init__(self, temp_dir: Optional[str] = None):
        """Initialize audio processor."""
        settings = get_settings()
        self.temp_dir = Path(temp_dir or settings.tts_temp_dir)
        self._ensure_temp_dir()

    def _ensure_temp_dir(self) -> None:
        """Ensure temp directory exists."""
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def concatenate_audio_files(
        self,
        file_paths: list[Path],
        output_path: Optional[Path] = None,
        re_encode: bool = False,
    ) -> Path:
        """
        Concatenate multiple audio files into one.

        Args:
            file_paths: List of audio file paths to concatenate
            output_path: Optional output path (auto-generated if not provided)
            re_encode: If True, re-encode audio for consistent quality
                       (slower but prevents audio artifacts from mismatched encodings)

        Returns:
            Path to the concatenated audio file

        Raises:
            AudioProcessingError: If concatenation fails
        """
        if not file_paths:
            raise AudioProcessingError("No files to concatenate")

        if len(file_paths) == 1:
            # Nothing to concatenate
            return file_paths[0]

        if output_path is None:
            output_path = self.temp_dir / f"{uuid.uuid4()}_combined.mp3"

        # Create concat list file
        list_file = self.temp_dir / f"{uuid.uuid4()}_list.txt"

        try:
            # Write file list
            with open(list_file, "w") as f:
                for file_path in file_paths:
                    # Use absolute path and escape single quotes
                    abs_path = str(file_path.absolute()).replace("'", "'\\''")
                    f.write(f"file '{abs_path}'\n")

            if re_encode:
                # Re-encode to ensure consistent quality and prevent artifacts
                # Use high-quality settings to minimize quality loss
                cmd = [
                    "ffmpeg",
                    "-f", "concat",
                    "-safe", "0",
                    "-i", str(list_file),
                    "-c:a", "libmp3lame",  # MP3 encoder
                    "-b:a", "192k",         # 192kbps bitrate
                    "-ar", "44100",         # Standard sample rate
                    "-ac", "1",             # Mono (matches TTS output)
                    "-y",  # Overwrite output
                    str(output_path),
                ]
            else:
                # Stream copy - faster but may have issues with mismatched encodings
                cmd = [
                    "ffmpeg",
                    "-f", "concat",
                    "-safe", "0",
                    "-i", str(list_file),
                    "-c", "copy",
                    "-y",  # Overwrite output
                    str(output_path),
                ]

            logger.info(f"Concatenating {len(file_paths)} audio files (re_encode={re_encode})")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
            )

            if result.returncode != 0:
                logger.error(f"ffmpeg error: {result.stderr}")
                raise AudioProcessingError(f"ffmpeg concat failed: {result.stderr}")

            logger.info(f"Created concatenated file: {output_path}")
            return output_path

        finally:
            # Cleanup list file
            if list_file.exists():
                list_file.unlink()

    def concatenate_audio_buffers(
        self,
        audio_buffers: list[bytes],
        re_encode: bool = True,
    ) -> bytes:
        """
        Concatenate multiple audio buffers into one.

        Args:
            audio_buffers: List of audio data buffers
            re_encode: If True, re-encode to ensure consistent quality
                       (prevents high-pass filtered sound from mismatched encodings)

        Returns:
            Combined audio data

        Raises:
            AudioProcessingError: If concatenation fails
        """
        if not audio_buffers:
            raise AudioProcessingError("No audio buffers to concatenate")

        if len(audio_buffers) == 1:
            return audio_buffers[0]

        temp_files: list[Path] = []
        output_file: Optional[Path] = None

        try:
            # Write each buffer to a temp file
            for i, buffer in enumerate(audio_buffers):
                temp_file = self.temp_dir / f"{uuid.uuid4()}_part{i}.mp3"
                with open(temp_file, "wb") as f:
                    f.write(buffer)
                temp_files.append(temp_file)

            # Concatenate files with re-encoding for consistent quality
            output_file = self.concatenate_audio_files(temp_files, re_encode=re_encode)

            # Read result
            with open(output_file, "rb") as f:
                return f.read()

        finally:
            # Cleanup temp files
            for temp_file in temp_files:
                if temp_file.exists():
                    temp_file.unlink()
            if output_file and output_file.exists():
                output_file.unlink()

    def convert_wav_to_mp3(self, wav_buffer: bytes) -> bytes:
        """
        Convert WAV audio buffer to MP3 format.

        This is needed for Gemini TTS output (24kHz WAV) to ensure
        compatibility with mobile players like expo-av.

        Args:
            wav_buffer: WAV audio data

        Returns:
            MP3 audio data

        Raises:
            AudioProcessingError: If conversion fails
        """
        input_file = self.temp_dir / f"{uuid.uuid4()}_input.wav"
        output_file = self.temp_dir / f"{uuid.uuid4()}_output.mp3"

        try:
            # Write WAV to temp file
            with open(input_file, "wb") as f:
                f.write(wav_buffer)

            # Convert to MP3 with high quality settings
            cmd = [
                "ffmpeg",
                "-i", str(input_file),
                "-c:a", "libmp3lame",
                "-b:a", "192k",         # 192kbps bitrate
                "-ar", "44100",         # Standard sample rate for mobile
                "-ac", "1",             # Mono
                "-y",
                str(output_file),
            ]

            logger.info("Converting WAV to MP3 for mobile compatibility")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
            )

            if result.returncode != 0:
                logger.error(f"ffmpeg conversion error: {result.stderr}")
                raise AudioProcessingError(f"WAV to MP3 conversion failed: {result.stderr}")

            # Read result
            with open(output_file, "rb") as f:
                mp3_data = f.read()

            logger.info(f"Converted {len(wav_buffer)} bytes WAV to {len(mp3_data)} bytes MP3")
            return mp3_data

        finally:
            # Cleanup temp files
            if input_file.exists():
                input_file.unlink()
            if output_file.exists():
                output_file.unlink()

    def get_audio_duration(self, file_path: Path) -> int:
        """
        Get audio duration in seconds using ffprobe.

        Args:
            file_path: Path to audio file

        Returns:
            Duration in seconds
        """
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(file_path),
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                duration = float(result.stdout.strip())
                return int(duration)
            else:
                logger.warning(f"ffprobe failed: {result.stderr}")
                return 0

        except (subprocess.TimeoutExpired, ValueError) as e:
            logger.warning(f"Could not get audio duration: {e}")
            return 0

    def get_buffer_duration(self, audio_buffer: bytes) -> int:
        """
        Get duration of audio buffer in seconds.

        Args:
            audio_buffer: Audio data

        Returns:
            Duration in seconds
        """
        temp_file = self.temp_dir / f"{uuid.uuid4()}_temp.mp3"

        try:
            with open(temp_file, "wb") as f:
                f.write(audio_buffer)

            return self.get_audio_duration(temp_file)

        finally:
            if temp_file.exists():
                temp_file.unlink()

    def cleanup_temp_files(self, file_paths: list[Path]) -> None:
        """Clean up temporary files."""
        for file_path in file_paths:
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception as e:
                logger.warning(f"Failed to delete temp file {file_path}: {e}")
