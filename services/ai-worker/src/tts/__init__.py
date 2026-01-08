"""Text-to-Speech module supporting multiple providers.

Providers:
- Google Cloud TTS (Standard/Neural2): Basic and high-quality voices
- Gemini 2.5 Pro TTS: Multi-speaker, podcast-optimized synthesis
"""

from .tts_engine import TTSEngine, TTSResult, PodcasterVoice, VoiceTier
from .voice_mapper import VoiceMapper, VoiceConfig
from .google_tts_client import GoogleTTSClient
from .gemini_tts_client import GeminiTTSClient, GeminiVoiceConfig, GeminiTTSError
from .script_parser import ScriptParser, SpeakerSegment
from .audio_processor import AudioProcessor

__all__ = [
    # Engine
    "TTSEngine",
    "TTSResult",
    "PodcasterVoice",
    "VoiceTier",
    # Google Cloud TTS
    "VoiceMapper",
    "VoiceConfig",
    "GoogleTTSClient",
    # Gemini TTS
    "GeminiTTSClient",
    "GeminiVoiceConfig",
    "GeminiTTSError",
    # Script parsing
    "ScriptParser",
    "SpeakerSegment",
    # Audio processing
    "AudioProcessor",
]
