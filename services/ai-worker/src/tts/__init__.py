"""Text-to-Speech module supporting multiple providers.

Providers:
- Google Cloud Standard TTS: Cost-effective voices ($4/1M chars) - free tier
- Gemini 2.5 Pro TTS: Multi-speaker, podcast-optimized synthesis (~$0.32/10-min)
"""

from .audio_processor import AudioProcessor
from .gemini_tts_client import GEMINI_VOICES, GeminiTTSClient, GeminiTTSError, GeminiVoiceConfig
from .google_tts_client import GoogleTTSClient
from .script_parser import ScriptParser, SpeakerSegment
from .tts_engine import PodcasterVoice, TTSEngine, TTSResult, VoiceTier
from .voice_mapper import VoiceConfig, VoiceMapper

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
    "GEMINI_VOICES",
    # Script parsing
    "ScriptParser",
    "SpeakerSegment",
    # Audio processing
    "AudioProcessor",
]
