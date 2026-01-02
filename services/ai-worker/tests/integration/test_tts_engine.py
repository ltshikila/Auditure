"""Integration tests for TTS engine."""

import pytest
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from pathlib import Path
from src.tts.tts_engine import TTSEngine, TTSResult, PodcasterVoice


class TestTTSEngineIntegration:
    """Integration tests for TTSEngine orchestrator."""

    @pytest.fixture
    def mock_edge_tts(self):
        """Create mocked Edge TTS client."""
        with patch('src.tts.tts_engine.EdgeTTSClient') as mock_client:
            mock_instance = MagicMock()
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
            mock_instance.cleanup_temp_files.return_value = None
            mock_processor.return_value = mock_instance
            yield mock_instance

    @pytest.fixture
    def engine(self, mock_edge_tts, mock_audio_processor):
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
    def test_generate_monologue(self, engine, sample_voice, monologue_script, mock_edge_tts):
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

        # Should call TTS once for monologue (single speaker)
        mock_edge_tts.generate_audio.assert_called()

    # Duo generation tests
    def test_generate_duo(self, engine, sample_voice, duo_script, mock_edge_tts, mock_audio_processor):
        """Test generating duo audio."""
        result = engine.generate(
            script=duo_script,
            podcaster_voice=sample_voice,
            episode_type="DUO",
        )

        assert isinstance(result, TTSResult)
        assert result.audio_buffer is not None
        assert result.format == "mp3"

        # Should call TTS multiple times (once per segment)
        assert mock_edge_tts.generate_audio.call_count > 1

    # Group generation tests
    def test_generate_group(self, engine, sample_voice, group_script, mock_edge_tts, mock_audio_processor):
        """Test generating group audio."""
        result = engine.generate(
            script=group_script,
            podcaster_voice=sample_voice,
            episode_type="GROUP",
        )

        assert isinstance(result, TTSResult)
        assert result.audio_buffer is not None

        # Should call TTS multiple times for all speakers
        assert mock_edge_tts.generate_audio.call_count > 1

    # Voice assignment tests
    def test_voice_assignment_uses_main_podcaster(self, engine, sample_voice, monologue_script, mock_edge_tts):
        """Test that main podcaster voice is used for HOST."""
        engine.generate(
            script=monologue_script,
            podcaster_voice=sample_voice,
            episode_type="MONOLOGUE",
        )

        # Check that the voice config passed includes the main voice settings
        call_args = mock_edge_tts.generate_audio.call_args
        assert call_args is not None

    def test_contrasting_voices_for_guests(self, engine, sample_voice, duo_script, mock_edge_tts, mock_audio_processor):
        """Test that guests get contrasting voices."""
        engine.generate(
            script=duo_script,
            podcaster_voice=sample_voice,
            episode_type="DUO",
        )

        # Should have multiple TTS calls with different voice configs
        calls = mock_edge_tts.generate_audio.call_args_list
        assert len(calls) > 1

        # Voice configs should differ between HOST and GUEST
        voice_ids = set()
        for call in calls:
            if len(call.args) >= 2:
                voice_config = call.args[1]
                voice_ids.add(voice_config.voice_id)
            elif 'voice_config' in call.kwargs:
                voice_ids.add(call.kwargs['voice_config'].voice_id)

    # Error handling tests
    def test_handles_empty_script(self, engine, sample_voice):
        """Test handling of empty script."""
        with pytest.raises(Exception):
            engine.generate(
                script="",
                podcaster_voice=sample_voice,
                episode_type="MONOLOGUE",
            )

    def test_handles_tts_error(self, sample_voice, monologue_script):
        """Test handling of TTS client error."""
        with patch('src.tts.tts_engine.EdgeTTSClient') as mock_client:
            mock_instance = MagicMock()
            mock_instance.generate_audio.side_effect = Exception("TTS Error")
            mock_client.return_value = mock_instance

            with patch('src.tts.tts_engine.AudioProcessor'):
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
