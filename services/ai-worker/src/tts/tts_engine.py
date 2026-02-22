"""TTS engine orchestrator supporting multiple providers.

Supports:
- Google Cloud Standard TTS ($4/1M chars) - Free tier (2 episodes/month)
- Gemini 2.5 Pro TTS (~$0.32/10-min) - Paid tiers + 1 free episode/month

Hybrid Model (Free Tier):
- 1 Gemini Pro episode + 2 Standard episodes per month
- Provides "aha moment" with premium quality while controlling costs
"""

import logging
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

from src.config import get_settings

from .audio_processor import AudioProcessor
from .gemini_tts_client import GeminiTTSClient, GeminiVoiceConfig
from .google_tts_client import GoogleTTSClient
from .script_parser import ScriptParser, SpeakerSegment
from .voice_mapper import VoiceConfig, VoiceMapper

logger = logging.getLogger(__name__)


class VoiceTier(str, Enum):
    """Available voice tiers.

    Maps to TypeScript enum in create-episode.dto.ts:
    - STANDARD = Google Cloud Standard voices - $4/1M chars (free tier)
    - GEMINI = Gemini 2.5 Pro TTS - ~$0.32/10-min (premium, multi-speaker)
    """
    STANDARD = "standard"   # Google Cloud Standard - $4/1M chars
    GEMINI = "gemini"       # Gemini 2.5 Pro - ~$0.32/10-min


@dataclass
class TTSResult:
    """Result of TTS generation."""

    audio_buffer: bytes
    duration: int  # seconds
    format: str  # "mp3" or "wav"
    estimated_cost: float  # Estimated TTS cost in USD
    voice_tier: str = "standard"  # Which tier was used


@dataclass
class PodcasterVoice:
    """Podcaster voice settings extracted for TTS.

    These settings are used differently by each TTS provider:

    Google Cloud Standard TTS:
    - gender + accent → voice ID (e.g., en-AU-Standard-A)
    - speaking_speed → speaking_rate (0.25-2.0)
    - vocal_pitch → pitch in semitones (-20 to 20)

    Gemini TTS:
    - gemini_voice_name → directly uses stored voice (e.g., "Zephyr", "Aoede")
    - accent → language_code (en-US, en-GB, en-AU, en-IN)
    - Falls back to voice selection if gemini_voice_name is not set
    """

    gender: str  # MALE, FEMALE
    accent: str  # e.g., "United States", "United Kingdom", "Australia", "India"
    speaking_speed: int  # 1-10
    vocal_pitch: int  # 1-10
    voice_model: str = "CUSTOM"  # CUSTOM, CONVERSATIONAL, ENERGETIC, CALM, SARCASTIC, ACADEMIC
    gemini_voice_name: Optional[str] = None  # Pre-computed Gemini voice (e.g., "Zephyr", "Aoede")


class TTSEngine:
    """Orchestrates text-to-speech generation with multiple providers.

    Supports automatic fallback:
    1. Gemini 2.5 Pro (if configured and requested) - premium multi-speaker
    2. Google Cloud Standard (if configured) - free tier
    3. Error if no provider available
    """

    def __init__(self, voice_tier: Optional[str] = None):
        """Initialize TTS engine with components.

        Args:
            voice_tier: Override voice tier ("standard" or "gemini")
        """
        settings = get_settings()
        self.default_voice_tier = voice_tier or settings.tts_voice_tier
        self.voice_mapper = VoiceMapper()
        self.google_client = GoogleTTSClient()
        self.gemini_client = GeminiTTSClient()
        self.script_parser = ScriptParser()
        self.audio_processor = AudioProcessor()
        self.words_per_minute = settings.words_per_minute
        self.temp_dir = Path(settings.tts_temp_dir)

        # Log available providers
        logger.info("TTS Engine initialized:")
        logger.info(f"  Default tier: {self.default_voice_tier}")
        logger.info(f"  Gemini available: {self.has_gemini}")
        logger.info(f"  Google Cloud available: {self.has_google}")

    @property
    def has_gemini(self) -> bool:
        """Check if Gemini TTS is available."""
        return self.gemini_client.is_available

    @property
    def has_google(self) -> bool:
        """Check if Google Cloud TTS is available."""
        return self.google_client.is_available

    def generate(
        self,
        script: str,
        podcaster_voice: PodcasterVoice,
        episode_type: str,
        episode_theme: str = "LECTURE",
        voice_tier: Optional[str] = None,
        cohost_archetype: Optional[object] = None,
        podcaster_personality: Optional[dict] = None,
    ) -> TTSResult:
        """
        Generate audio from podcast script.

        Args:
            script: The podcast script text
            podcaster_voice: Main podcaster's voice settings
            episode_type: MONOLOGUE or DUO
            episode_theme: LECTURE, DISCUSSION, or DEBATE
            voice_tier: Override voice tier for this episode
            cohost_archetype: CoHostArchetype from script generation (DUO episodes)
            podcaster_personality: Host personality dict (tone, communication_style, etc.)

        Returns:
            TTSResult with audio buffer, duration, and cost estimate
        """
        tier = voice_tier or self.default_voice_tier
        logger.info(f"Generating TTS for {episode_type} episode using {tier} voices")

        # Parse script into segments
        segments = self.script_parser.parse(script, episode_type)
        logger.info(f"Parsed {len(segments)} segments")

        # Route to appropriate provider based on voice tier
        # Normalize tier to lowercase for comparison
        tier_lower = tier.lower() if isinstance(tier, str) else tier.value

        if tier_lower == "gemini":
            if self.has_gemini:
                return self._generate_with_gemini(
                    script, segments, podcaster_voice, episode_type,
                    episode_theme=episode_theme,
                    cohost_archetype=cohost_archetype,
                    podcaster_personality=podcaster_personality,
                )
            else:
                logger.warning("Gemini TTS not configured, falling back to Standard")
                tier_lower = "standard"

        # Use Google Cloud Standard TTS ($4/1M chars)
        if tier_lower == "standard":
            if self.has_google:
                return self._generate_with_google(
                    script, segments, podcaster_voice, episode_type
                )
            else:
                raise RuntimeError("No TTS provider configured")

        raise RuntimeError(f"Unknown voice tier: {tier}. Use 'standard' or 'gemini'.")

    def _generate_with_gemini(
        self,
        script: str,
        segments: list[SpeakerSegment],
        podcaster_voice: PodcasterVoice,
        episode_type: str,
        episode_theme: str = "LECTURE",
        cohost_archetype: Optional[object] = None,
        podcaster_personality: Optional[dict] = None,
    ) -> TTSResult:
        """Generate audio using Gemini 2.5 Pro TTS (multi-speaker).

        Voice selection uses all podcaster settings:
        - gender: filters available voices
        - accent: maps to language_code (en-US, en-GB, en-AU, en-IN)
        - speaking_speed + vocal_pitch: selects best matching voice

        Director's Notes style prompts are built from:
        - Host personality → warm/serious/witty delivery
        - Co-host archetype → contrasting delivery style
        - Episode theme → tone guidance (educational/exploratory/confrontational)

        Reference: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
        """
        logger.info("Using Gemini 2.5 Pro TTS for multi-speaker synthesis")

        # Get language code from accent
        language_code = self.gemini_client.get_language_code(podcaster_voice.accent)
        logger.info(f"Accent '{podcaster_voice.accent}' -> language_code '{language_code}'")

        # Build voice assignments based on speakers in script
        speakers = self.script_parser.get_unique_speakers(segments)
        voice_configs = self._assign_gemini_voices(
            speakers, podcaster_voice,
            episode_theme=episode_theme,
            cohost_archetype=cohost_archetype,
            podcaster_personality=podcaster_personality,
        )

        # Extract voice assignments for logging
        voice_assignments = {
            speaker: config.speaker_id
            for speaker, config in voice_configs.items()
        }
        logger.info(f"Voice assignments: {voice_assignments}")

        # Safety net: if script lacks speaker labels but we're in multi-speaker mode,
        # reconstruct the script with labels from parsed segments so the TTS client
        # can properly use multi-speaker synthesis.
        if episode_type != "MONOLOGUE" and len(speakers) > 1:
            import re
            has_labels = any(
                re.match(r'^(HOST|GUEST|SPEAKER|NARRATOR)\d?:', line.strip())
                for line in script.split('\n') if line.strip()
            )
            if not has_labels:
                logger.warning(
                    "Script lacks speaker labels for multi-speaker episode — "
                    "reconstructing labeled script from parsed segments"
                )
                script = self._reconstruct_labeled_script(segments)

        # Generate audio with full voice configs, language code, and episode type
        wav_buffer = self.gemini_client.generate_audio(
            script=script,
            voice_configs=voice_configs,
            episode_type=episode_type,
            language_code=language_code,
        )

        # Convert WAV to MP3 for mobile compatibility (expo-av has issues with 24kHz WAV)
        logger.info("Converting Gemini WAV output to MP3 for mobile compatibility...")
        audio_buffer = self.audio_processor.convert_wav_to_mp3(wav_buffer)

        # Get duration
        duration = self.audio_processor.get_buffer_duration(audio_buffer)
        if duration == 0:
            duration = self.script_parser.estimate_duration(
                segments, self.words_per_minute
            )

        # Calculate cost estimate
        cost = self.gemini_client.estimate_cost(script, duration)

        logger.info(f"Gemini TTS complete. Duration: {duration}s, Cost: ${cost:.4f}")

        return TTSResult(
            audio_buffer=audio_buffer,
            duration=duration,
            format="mp3",  # Converted to MP3 for mobile compatibility
            estimated_cost=cost,
            voice_tier="gemini",
        )

    def _reconstruct_labeled_script(
        self,
        segments: list[SpeakerSegment],
    ) -> str:
        """Reconstruct a script with proper speaker labels from parsed segments.

        Used as a safety net when the LLM generates a DUO script without
        recognizable speaker labels (e.g. plain paragraphs or markdown-formatted).
        """
        lines = []
        for segment in segments:
            lines.append(f"{segment.speaker}: {segment.text}")
            lines.append("")  # Blank line between turns
        return "\n".join(lines).strip()

    def _generate_with_google(
        self,
        script: str,
        segments: list[SpeakerSegment],
        podcaster_voice: PodcasterVoice,
        episode_type: str,
    ) -> TTSResult:
        """Generate audio using Google Cloud Standard TTS ($4/1M chars)."""
        logger.info("Using Google Cloud Standard TTS")

        # Calculate total characters for cost estimation
        total_chars = sum(len(seg.text) for seg in segments)

        if episode_type == "MONOLOGUE":
            result = self._generate_google_monologue(segments, podcaster_voice)
        else:
            result = self._generate_google_multi_voice(segments, podcaster_voice)

        # Calculate cost estimate - Standard: $4/1M chars
        cost = (total_chars / 1_000_000) * 4

        result.estimated_cost = cost
        result.voice_tier = "standard"
        logger.info(f"Google TTS complete. Duration: {result.duration}s, Cost: ${cost:.4f}")

        return result

    def _assign_gemini_voices(
        self,
        speakers: list[str],
        main_podcaster: PodcasterVoice,
        episode_theme: str = "LECTURE",
        cohost_archetype: Optional[object] = None,
        podcaster_personality: Optional[dict] = None,
    ) -> dict[str, GeminiVoiceConfig]:
        """Assign Gemini voices to speakers with Director's Notes style prompts.

        Voice assignment strategy:
        - Host: Uses stored gemini_voice_name if available, otherwise computes it
        - Guests: Computed based on alternating genders with slight variations

        Style prompts are built from personality/archetype/theme for expressive TTS:
        - Host: personality traits → natural language delivery direction
        - Guest: cohost archetype → contrasting delivery direction
        - Both: episode theme → tone guidance

        Args:
            speakers: List of speaker labels from script
            main_podcaster: Podcaster voice settings from frontend
            episode_theme: LECTURE, DISCUSSION, or DEBATE
            cohost_archetype: CoHostArchetype from script generation (DUO)
            podcaster_personality: Host personality dict

        Returns:
            Dict mapping speaker labels to GeminiVoiceConfig objects
        """
        from .gemini_tts_client import GEMINI_VOICES

        assignments: dict[str, GeminiVoiceConfig] = {}
        guest_index = 0

        # Build host style prompt from personality and theme
        host_style_prompt = self._build_host_style_prompt(
            podcaster_personality or {},
            episode_theme,
        )

        # Build guest style prompt from cohost archetype and theme
        guest_style_prompt = self._build_guest_style_prompt(
            cohost_archetype,
            episode_theme,
        )

        for speaker in speakers:
            speaker_upper = speaker.upper()

            if speaker_upper in ["HOST", "HOST1", "NARRATOR"]:
                # Use stored voice if available (permanent voice assignment)
                if main_podcaster.gemini_voice_name and main_podcaster.gemini_voice_name in GEMINI_VOICES:
                    voice_name = main_podcaster.gemini_voice_name
                    voice_info = GEMINI_VOICES[voice_name]
                    logger.info(f"Using stored Gemini voice for HOST: {voice_name} ({voice_info['style']})")

                    voice_config = GeminiVoiceConfig(
                        speaker_id=voice_name,
                        style=voice_info["style"],
                        style_prompt=host_style_prompt,
                    )
                else:
                    # Fallback: compute voice (for legacy podcasters without stored voice)
                    logger.info("No stored Gemini voice, computing voice for HOST...")
                    voice_config = self.gemini_client.get_voice_for_speaker(
                        speaker_type="HOST",
                        gender=main_podcaster.gender,
                        speaking_speed=main_podcaster.speaking_speed,
                        vocal_pitch=main_podcaster.vocal_pitch,
                        speaker_index=0,
                        voice_model=main_podcaster.voice_model,
                    )
                    voice_config.style_prompt = host_style_prompt
                assignments[speaker] = voice_config
            else:
                # Alternate genders for variety
                alt_gender = "FEMALE" if main_podcaster.gender == "MALE" else "MALE"
                if guest_index % 2 == 0:
                    gender = alt_gender
                else:
                    gender = main_podcaster.gender

                # Get host voice name to avoid duplicates
                host_voice_name = None
                for assigned in assignments.values():
                    host_voice_name = assigned.speaker_id
                    break

                voice_config = self.gemini_client.get_voice_for_speaker(
                    speaker_type="GUEST",
                    gender=gender,
                    speaking_speed=main_podcaster.speaking_speed,
                    vocal_pitch=main_podcaster.vocal_pitch,
                    speaker_index=guest_index,
                    voice_model=main_podcaster.voice_model,
                )

                # Ensure guest voice is different from host voice
                if host_voice_name and voice_config.speaker_id == host_voice_name:
                    logger.info(f"Guest voice '{voice_config.speaker_id}' matches host, selecting random alternative")
                    alt_voice = self.gemini_client.get_random_guest_voice(host_voice_name)
                    if alt_voice in GEMINI_VOICES:
                        alt_info = GEMINI_VOICES[alt_voice]
                        voice_config = GeminiVoiceConfig(
                            speaker_id=alt_voice,
                            style=alt_info["style"],
                        )

                voice_config.style_prompt = guest_style_prompt
                assignments[speaker] = voice_config
                guest_index += 1

        # Log style prompts
        for speaker, config in assignments.items():
            logger.info(f"Voice {speaker} -> {config.speaker_id} | style_prompt: {config.style_prompt[:80]}...")

        return assignments

    def _build_host_style_prompt(
        self,
        personality: dict,
        episode_theme: str,
    ) -> str:
        """Build a Director's Notes style prompt for the host based on personality.

        Translates numeric personality sliders into natural language voice direction
        that Gemini TTS can use for expressive speech synthesis.
        """
        parts = []

        # Tone: serious ↔ warm/enthusiastic
        tone = personality.get("tone", 5)
        if tone <= 3:
            parts.append("serious and measured delivery")
        elif tone <= 6:
            parts.append("warm and approachable delivery")
        else:
            parts.append("enthusiastic and engaging delivery")

        # Communication style: formal ↔ casual storytelling
        comm = personality.get("communication_style", 5)
        if comm <= 3:
            parts.append("with a structured, polished speaking style")
        elif comm <= 6:
            parts.append("with a natural conversational flow")
        else:
            parts.append("with a relaxed storytelling style")

        # Humor: none ↔ witty
        humor = personality.get("humor_level", 5)
        if humor >= 7:
            parts.append("witty and playful")
        elif humor >= 4:
            parts.append("with occasional light humor")

        # Chaos/energy: steady ↔ dynamic
        chaos = personality.get("chaos_factor", 5)
        if chaos >= 7:
            parts.append("dynamic energy with surprising shifts in pace and intensity")
        elif chaos <= 3:
            parts.append("steady, confident pacing")

        # Theme-specific overlay
        theme_overlay = {
            "LECTURE": "Speak with authority and clarity, like an expert sharing knowledge.",
            "DISCUSSION": "Speak with genuine curiosity and openness, exploring ideas naturally.",
            "DEBATE": "Speak with conviction and passion, defending positions assertively.",
        }
        if episode_theme in theme_overlay:
            parts.append(theme_overlay[episode_theme])

        return " ".join(parts)

    def _build_guest_style_prompt(
        self,
        cohost_archetype: Optional[object],
        episode_theme: str,
    ) -> str:
        """Build a Director's Notes style prompt for the guest/co-host.

        Uses the CoHostArchetype (perspective + speaking_style) to create
        a voice direction that contrasts with the host.
        """
        if cohost_archetype is None:
            # Fallback for episodes without archetype info
            theme_defaults = {
                "LECTURE": "Speak as an engaged, curious listener who asks thoughtful questions.",
                "DISCUSSION": "Speak with genuine interest and a distinct perspective, naturally conversational.",
                "DEBATE": "Speak with confident conviction, assertively challenging ideas.",
            }
            return theme_defaults.get(episode_theme, "Speak naturally with a distinct personality.")

        parts = []

        # Perspective → delivery angle
        perspective = getattr(cohost_archetype, "perspective", "")
        perspective_directions = {
            "skeptical": "questioning and probing delivery, with a hint of doubt",
            "enthusiastic": "energetic and excited delivery, genuinely fascinated",
            "analytical": "measured and precise delivery, methodical and careful",
            "experiential": "warm storytelling delivery, drawing from real-world experience",
            "philosophical": "thoughtful and contemplative delivery, with deliberate pauses",
        }
        if perspective in perspective_directions:
            parts.append(perspective_directions[perspective])
        elif perspective:
            parts.append(f"{perspective} delivery")

        # Speaking style → communication manner
        speaking_style = getattr(cohost_archetype, "speaking_style", "")
        if speaking_style:
            parts.append(f"with a {speaking_style.lower()} manner")

        # Theme overlay for guest
        theme_overlay = {
            "LECTURE": "React naturally as an engaged learner — curious, sometimes surprised.",
            "DISCUSSION": "Contribute as an equal exploring ideas, building on and sometimes challenging points.",
            "DEBATE": "Argue passionately from your position, push back firmly when you disagree.",
        }
        if episode_theme in theme_overlay:
            parts.append(theme_overlay[episode_theme])

        return " ".join(parts) if parts else "Speak naturally with a distinct personality."

    def _generate_google_monologue(
        self,
        segments: list[SpeakerSegment],
        podcaster_voice: PodcasterVoice,
    ) -> TTSResult:
        """Generate audio for monologue (single voice) using Google Cloud Standard TTS."""
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
        audio_buffer = self.google_client.generate_audio(full_text, voice_config)

        # Get duration
        duration = self.audio_processor.get_buffer_duration(audio_buffer)
        if duration == 0:
            duration = self.script_parser.estimate_duration(
                segments, self.words_per_minute
            )

        return TTSResult(
            audio_buffer=audio_buffer,
            duration=duration,
            format="mp3",
            estimated_cost=0.0,  # Will be set by caller
            voice_tier="standard",
        )

    def _generate_google_multi_voice(
        self,
        segments: list[SpeakerSegment],
        main_podcaster: PodcasterVoice,
    ) -> TTSResult:
        """Generate audio for multi-voice episodes using Google Cloud Standard TTS."""
        # Get unique speakers
        speakers = self.script_parser.get_unique_speakers(segments)
        logger.info(f"Speakers: {speakers}")

        # Create voice configs for each speaker
        voice_configs = self._assign_google_voices(speakers, main_podcaster)

        # Generate audio for each segment
        audio_buffers: list[bytes] = []
        temp_files: list[Path] = []

        try:
            for i, segment in enumerate(segments):
                voice_config = voice_configs[segment.speaker]
                logger.debug(f"Generating segment {i+1}/{len(segments)}: {segment.speaker}")

                audio_buffer = self.google_client.generate_audio(
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
                estimated_cost=0.0,  # Will be set by caller
                voice_tier="standard",
            )

        finally:
            # Cleanup any temp files
            self.audio_processor.cleanup_temp_files(temp_files)

    def _assign_google_voices(
        self,
        speakers: list[str],
        main_podcaster: PodcasterVoice,
    ) -> dict[str, VoiceConfig]:
        """Assign Google Cloud Standard TTS voice configs to each speaker."""
        voice_configs: dict[str, VoiceConfig] = {}

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

    def estimate_cost(
        self,
        script: str,
        voice_tier: str,
        target_duration_seconds: Optional[int] = None,
    ) -> float:
        """
        Estimate TTS cost for a script.

        Args:
            script: The podcast script
            voice_tier: Which tier to estimate for ("standard" or "gemini")
            target_duration_seconds: Expected duration (for Gemini accuracy)

        Returns:
            Estimated cost in USD
        """
        char_count = len(script)

        if voice_tier in ["gemini", VoiceTier.GEMINI]:
            if target_duration_seconds:
                return self.gemini_client.estimate_cost(script, target_duration_seconds)
            # Rough estimate: 150 words/min, 5 chars/word
            estimated_words = char_count / 5
            estimated_seconds = int((estimated_words / 150) * 60)
            return self.gemini_client.estimate_cost(script, estimated_seconds)
        else:
            # Standard tier: $4/1M chars
            return (char_count / 1_000_000) * 4
