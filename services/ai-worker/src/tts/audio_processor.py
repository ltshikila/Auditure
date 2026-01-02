"""Audio processing utilities using ffmpeg."""

import logging
import subprocess
import uuid
from pathlib import Path
from typing import List, Optional

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
        file_paths: List[Path],
        output_path: Optional[Path] = None,
    ) -> Path:
        """
        Concatenate multiple audio files into one.

        Args:
            file_paths: List of audio file paths to concatenate
            output_path: Optional output path (auto-generated if not provided)

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

            # Run ffmpeg concat
            cmd = [
                "ffmpeg",
                "-f", "concat",
                "-safe", "0",
                "-i", str(list_file),
                "-c", "copy",
                "-y",  # Overwrite output
                str(output_path),
            ]

            logger.info(f"Concatenating {len(file_paths)} audio files")

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
        audio_buffers: List[bytes],
    ) -> bytes:
        """
        Concatenate multiple audio buffers into one.

        Args:
            audio_buffers: List of audio data buffers

        Returns:
            Combined audio data

        Raises:
            AudioProcessingError: If concatenation fails
        """
        if not audio_buffers:
            raise AudioProcessingError("No audio buffers to concatenate")

        if len(audio_buffers) == 1:
            return audio_buffers[0]

        temp_files: List[Path] = []
        output_file: Optional[Path] = None

        try:
            # Write each buffer to a temp file
            for i, buffer in enumerate(audio_buffers):
                temp_file = self.temp_dir / f"{uuid.uuid4()}_part{i}.mp3"
                with open(temp_file, "wb") as f:
                    f.write(buffer)
                temp_files.append(temp_file)

            # Concatenate files
            output_file = self.concatenate_audio_files(temp_files)

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

    def cleanup_temp_files(self, file_paths: List[Path]) -> None:
        """Clean up temporary files."""
        for file_path in file_paths:
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception as e:
                logger.warning(f"Failed to delete temp file {file_path}: {e}")
