"""Text-to-Speech module supporting multiple providers.

Providers:
- Google Cloud Standard TTS: Cost-effective voices ($4/1M chars) - free tier
- Gemini 2.5 Pro TTS: Multi-speaker, podcast-optimized synthesis (~$0.32/10-min)
"""

from .tts_engine import TTSEngine, TTSResult, PodcasterVoice, VoiceTier
from .voice_mapper import VoiceMapper, VoiceConfig
from .google_tts_client import GoogleTTSClient
from .gemini_tts_client import GeminiTTSClient, GeminiVoiceConfig, GeminiTTSError, GEMINI_VOICES
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
    "GEMINI_VOICES",
    # Script parsing
    "ScriptParser",
    "SpeakerSegment",
    # Audio processing
    "AudioProcessor",
]
