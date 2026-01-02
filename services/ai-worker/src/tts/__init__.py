"""Text-to-Speech module."""

from .tts_engine import TTSEngine, TTSResult
from .voice_mapper import VoiceMapper
from .edge_tts_client import EdgeTTSClient
from .script_parser import ScriptParser, SpeakerSegment
from .audio_processor import AudioProcessor

__all__ = [
    "TTSEngine",
    "TTSResult",
    "VoiceMapper",
    "EdgeTTSClient",
    "ScriptParser",
    "SpeakerSegment",
    "AudioProcessor",
]
