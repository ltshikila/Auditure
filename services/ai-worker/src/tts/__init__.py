"""Text-to-Speech module using Google Cloud TTS."""

from .tts_engine import TTSEngine, TTSResult, PodcasterVoice
from .voice_mapper import VoiceMapper, VoiceConfig
from .google_tts_client import GoogleTTSClient
from .script_parser import ScriptParser, SpeakerSegment
from .audio_processor import AudioProcessor

__all__ = [
    "TTSEngine",
    "TTSResult",
    "PodcasterVoice",
    "VoiceMapper",
    "VoiceConfig",
    "GoogleTTSClient",
    "ScriptParser",
    "SpeakerSegment",
    "AudioProcessor",
]
