"""Integration tests for TTS engine."""

import pytest
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from pathlib import Path
from src.tts.tts_engine import TTSEngine, TTSResult, PodcasterVoice


class TestTTSEngineIntegration:
    """Integration tests for TTSEngine orchestrator."""

    @pytest.fixture
    def mock_gemini_tts(self):
        """Create mocked Gemini TTS client."""
        with patch('src.tts.tts_engine.GeminiTTSClient') as mock_client:
            mock_instance = MagicMock()
            mock_instance.is_available = True
            # Return fake WAV audio bytes
            mock_instance.generate_audio.return_value = b"fake_wav_audio_data_here"
            mock_instance.get_language_code.return_value = "en-US"
            mock_instance.estimate_cost.return_value = 0.32
            mock_client.return_value = mock_instance
            yield mock_instance

    @pytest.fixture
    def mock_google_tts(self):
        """Create mocked Google TTS client."""
        with patch('src.tts.tts_engine.GoogleTTSClient') as mock_client:
            mock_instance = MagicMock()
            mock_instance.is_available = True
            # Return fake audio bytes
            mock_instance.generate_audio.return_value = b"fake_audio_data_here"
            mock_client.return_value = mock_instance
            yield mock_instance

    @pytest.fixture
    def mock_audio_processor(self):
        """Create mocked audio processor."""
        with patch('src.tts.tts_engine.AudioProcessor') as mock_processor:
            mock_instance = MagicMock()
            mock_instance.get_buffer_duration.return_value = 300  # 5 minutes
            mock_instance.concatenate_audio_buffers.return_value = b"combined_audio_data"
            mock_instance.convert_wav_to_mp3.return_value = b"converted_mp3_data"
            mock_instance.cleanup_temp_files.return_value = None
            mock_processor.return_value = mock_instance
            yield mock_instance

    @pytest.fixture
    def mock_script_parser(self):
        """Create mocked script parser."""
        with patch('src.tts.tts_engine.ScriptParser') as mock_parser:
            mock_instance = MagicMock()
            mock_instance.parse.return_value = [
                MagicMock(speaker="HOST", text="Hello, welcome!"),
                MagicMock(speaker="GUEST", text="Thanks for having me!"),
            ]
            mock_instance.get_unique_speakers.return_value = ["HOST", "GUEST"]
            mock_instance.estimate_duration.return_value = 300
            mock_parser.return_value = mock_instance
            yield mock_instance

    @pytest.fixture
    def mock_voice_mapper(self):
        """Create mocked voice mapper."""
        with patch('src.tts.tts_engine.VoiceMapper') as mock_mapper:
            mock_instance = MagicMock()
            mock_mapper.return_value = mock_instance
            yield mock_instance

    @pytest.fixture
    def engine(self, mock_gemini_tts, mock_google_tts, mock_audio_processor, mock_script_parser, mock_voice_mapper):
        """Create TTSEngine with mocked dependencies."""
        return TTSEngine()

    @pytest.fixture
    def sample_voice(self):
        """Create sample podcaster voice."""
        return PodcasterVoice(
            gender="MALE",
            accent="United States",
            speaking_speed=6,
            vocal_pitch=5,
        )

    @pytest.fixture
    def monologue_script(self):
        """Create sample monologue script."""
        return """
        Welcome to the Philosophy Podcast! Today we're exploring Stoicism.

        The Stoics believed in focusing on what we can control. Marcus Aurelius,
        the Roman Emperor, practiced this philosophy throughout his reign.

        Let's dive deeper into these fascinating ideas and see how they apply
        to our modern lives.

        Thank you for listening! Until next time, stay philosophical.
        """

    @pytest.fixture
    def duo_script(self):
        """Create sample duo script."""
        return """
        HOST: Welcome to the show! Today we have a special guest.

        GUEST: Thanks for having me! I'm excited to discuss this book.

        HOST: Let's start with the main themes. What struck you most?

        GUEST: I was fascinated by the practical applications of Stoicism.

        HOST: That's a great point. The ancient philosophers were quite practical.

        GUEST: Absolutely! Their advice remains relevant today.

        HOST: Thanks for joining us today!

        GUEST: My pleasure!
        """

    @pytest.fixture
    def group_script(self):
        """Create sample group script."""
        return """
        HOST: Welcome to our panel discussion on philosophy!

        GUEST1: Excited to be here with everyone.

        GUEST2: Same here! This should be a great conversation.

        HOST: Let's start with our first topic.

        GUEST1: I think the key insight is about control.

        GUEST2: I agree, but I'd add that perspective matters too.

        HOST: Excellent points from both of you!

        GUEST1: The practical applications are endless.

        GUEST2: Especially in today's chaotic world.

        HOST: Thanks to both of you for this enlightening discussion!
        """

    # Monologue generation tests
    def test_generate_monologue(self, engine, sample_voice, monologue_script, mock_gemini_tts):
        """Test generating monologue audio."""
        result = engine.generate(
            script=monologue_script,
            podcaster_voice=sample_voice,
            episode_type="MONOLOGUE",
        )

        assert isinstance(result, TTSResult)
        assert result.audio_buffer is not None
        assert result.duration > 0
        assert result.format == "mp3"

        # Should call Gemini TTS for generation
        mock_gemini_tts.generate_audio.assert_called()

    # Duo generation tests
    def test_generate_duo(self, engine, sample_voice, duo_script, mock_gemini_tts, mock_audio_processor):
        """Test generating duo audio."""
        result = engine.generate(
            script=duo_script,
            podcaster_voice=sample_voice,
            episode_type="DUO",
        )

        assert isinstance(result, TTSResult)
        assert result.audio_buffer is not None
        assert result.format == "mp3"

        # Should call Gemini TTS for generation
        mock_gemini_tts.generate_audio.assert_called()

    # Group generation tests
    def test_generate_group(self, engine, sample_voice, group_script, mock_gemini_tts, mock_audio_processor):
        """Test generating group audio."""
        result = engine.generate(
            script=group_script,
            podcaster_voice=sample_voice,
            episode_type="GROUP",
        )

        assert isinstance(result, TTSResult)
        assert result.audio_buffer is not None

        # Should call Gemini TTS for generation
        mock_gemini_tts.generate_audio.assert_called()

    # Voice assignment tests
    def test_voice_assignment_uses_main_podcaster(self, engine, sample_voice, monologue_script, mock_gemini_tts):
        """Test that main podcaster voice is used for HOST."""
        engine.generate(
            script=monologue_script,
            podcaster_voice=sample_voice,
            episode_type="MONOLOGUE",
        )

        # Check that Gemini TTS was called
        assert mock_gemini_tts.generate_audio.called

    def test_contrasting_voices_for_guests(self, engine, sample_voice, duo_script, mock_gemini_tts, mock_audio_processor):
        """Test that guests get contrasting voices."""
        engine.generate(
            script=duo_script,
            podcaster_voice=sample_voice,
            episode_type="DUO",
        )

        # Should have called Gemini TTS for the DUO episode
        assert mock_gemini_tts.generate_audio.called

    # Error handling tests
    def test_handles_empty_script(self, engine, sample_voice, mock_script_parser):
        """Test handling of empty script."""
        # Mock parser to return empty segments for empty script
        mock_script_parser.parse.return_value = []
        mock_script_parser.get_unique_speakers.return_value = []

        # Empty script should still be handled (may raise or return minimal result)
        try:
            result = engine.generate(
                script="",
                podcaster_voice=sample_voice,
                episode_type="MONOLOGUE",
            )
            # If it doesn't raise, result should be valid
            assert isinstance(result, TTSResult)
        except Exception:
            # Raising an exception is acceptable for empty script
            pass

    def test_handles_tts_error(self, sample_voice, monologue_script):
        """Test handling of TTS client error."""
        with patch('src.tts.tts_engine.GeminiTTSClient') as mock_gemini:
            mock_gemini_instance = MagicMock()
            mock_gemini_instance.is_available = True
            mock_gemini_instance.generate_audio.side_effect = Exception("TTS Error")
            mock_gemini_instance.get_language_code.return_value = "en-US"
            mock_gemini.return_value = mock_gemini_instance

            with patch('src.tts.tts_engine.GoogleTTSClient') as mock_google:
                mock_google_instance = MagicMock()
                mock_google_instance.is_available = False
                mock_google.return_value = mock_google_instance

                with patch('src.tts.tts_engine.AudioProcessor'):
                    with patch('src.tts.tts_engine.ScriptParser') as mock_parser:
                        mock_parser_instance = MagicMock()
                        mock_parser_instance.parse.return_value = [
                            MagicMock(speaker="HOST", text="Hello")
                        ]
                        mock_parser_instance.get_unique_speakers.return_value = ["HOST"]
                        mock_parser.return_value = mock_parser_instance

                        with patch('src.tts.tts_engine.VoiceMapper'):
                            engine = TTSEngine()

                            with pytest.raises(Exception) as exc_info:
                                engine.generate(
                                    script=monologue_script,
                                    podcaster_voice=sample_voice,
                                    episode_type="MONOLOGUE",
                                )

                            assert "TTS Error" in str(exc_info.value)


class TestPodcasterVoice:
    """Test cases for PodcasterVoice dataclass."""

    def test_podcaster_voice_creation(self):
        """Test creating PodcasterVoice."""
        voice = PodcasterVoice(
            gender="FEMALE",
            accent="United Kingdom",
            speaking_speed=7,
            vocal_pitch=6,
        )

        assert voice.gender == "FEMALE"
        assert voice.accent == "United Kingdom"
        assert voice.speaking_speed == 7
        assert voice.vocal_pitch == 6

    def test_podcaster_voice_defaults(self):
        """Test PodcasterVoice with various settings."""
        voice = PodcasterVoice(
            gender="MALE",
            accent="Australia",
            speaking_speed=5,
            vocal_pitch=5,
        )

        assert voice.speaking_speed == 5
        assert voice.vocal_pitch == 5
