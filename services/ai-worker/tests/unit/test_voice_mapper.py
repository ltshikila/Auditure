"""Unit tests for voice mapper."""

import pytest
from src.tts.voice_mapper import VoiceMapper, VoiceConfig


class TestVoiceMapper:
    """Test cases for VoiceMapper class."""

    @pytest.fixture
    def mapper(self):
        """Create VoiceMapper instance."""
        return VoiceMapper()

    # Voice ID selection tests
    def test_get_voice_id_male_us(self, mapper):
        """Test male US voice selection."""
        voice_id = mapper.get_voice_id("MALE", "United States")
        assert voice_id == "en-US-Standard-A"

    def test_get_voice_id_female_uk(self, mapper):
        """Test female UK voice selection."""
        voice_id = mapper.get_voice_id("FEMALE", "United Kingdom")
        assert voice_id == "en-GB-Standard-A"

    def test_get_voice_id_unknown_accent_uses_default(self, mapper):
        """Test that unknown accent falls back to default."""
        voice_id = mapper.get_voice_id("MALE", "Unknown Accent")
        assert voice_id == "en-US-Standard-A"

    def test_get_voice_id_female_australia(self, mapper):
        """Test female Australian voice."""
        voice_id = mapper.get_voice_id("FEMALE", "Australia")
        assert voice_id == "en-AU-Standard-A"

    # Rate calculation tests
    def test_calculate_rate_minimum(self, mapper):
        """Test rate at minimum speed (1)."""
        rate = mapper.calculate_rate(1)
        assert rate == "-30%"

    def test_calculate_rate_maximum(self, mapper):
        """Test rate at maximum speed (10)."""
        rate = mapper.calculate_rate(10)
        assert rate == "+30%"

    def test_calculate_rate_middle(self, mapper):
        """Test rate at middle speed (5)."""
        rate = mapper.calculate_rate(5)
        # (5 - 5.5) / 4.5 * 30 = -3.33 -> -3%
        assert rate == "-3%"

    def test_calculate_rate_above_middle(self, mapper):
        """Test rate at above middle speed (7)."""
        rate = mapper.calculate_rate(7)
        # (7 - 5.5) / 4.5 * 30 = 10%
        assert rate == "+10%"

    # Pitch calculation tests
    def test_calculate_pitch_minimum(self, mapper):
        """Test pitch at minimum (1)."""
        pitch = mapper.calculate_pitch(1)
        assert pitch == "-30Hz"

    def test_calculate_pitch_maximum(self, mapper):
        """Test pitch at maximum (10)."""
        pitch = mapper.calculate_pitch(10)
        assert pitch == "+30Hz"

    def test_calculate_pitch_middle(self, mapper):
        """Test pitch at middle (5)."""
        pitch = mapper.calculate_pitch(5)
        assert pitch == "-3Hz"

    # Voice config tests
    def test_get_voice_config_complete(self, mapper):
        """Test getting complete voice config."""
        config = mapper.get_voice_config(
            gender="MALE",
            accent="United Kingdom",
            speaking_speed=8,
            vocal_pitch=3,
        )

        assert isinstance(config, VoiceConfig)
        assert config.voice_id == "en-GB-Standard-B"
        assert config.gender == "MALE"
        assert config.accent == "United Kingdom"
        assert "%" in config.rate
        assert "Hz" in config.pitch

    def test_get_voice_config_defaults(self, mapper):
        """Test voice config with default values."""
        config = mapper.get_voice_config(
            gender="FEMALE",
            accent="Canada",
        )

        assert config.voice_id == "en-US-Standard-C"
        assert config.rate == "-3%"  # Speed 5
        assert config.pitch == "-3Hz"  # Pitch 5

    # Contrasting voice tests
    def test_get_contrasting_voice_alternates_gender(self, mapper):
        """Test that contrasting voice alternates gender."""
        main_config = mapper.get_voice_config(
            gender="MALE",
            accent="United States",
            speaking_speed=5,
            vocal_pitch=5,
        )

        guest_0 = mapper.get_contrasting_voice(main_config, 0)
        assert guest_0.gender == "FEMALE"

        guest_1 = mapper.get_contrasting_voice(main_config, 1)
        assert guest_1.gender == "MALE"

        guest_2 = mapper.get_contrasting_voice(main_config, 2)
        assert guest_2.gender == "FEMALE"

    def test_get_contrasting_voice_keeps_accent(self, mapper):
        """Test that contrasting voice keeps same accent."""
        main_config = mapper.get_voice_config(
            gender="FEMALE",
            accent="Australia",
            speaking_speed=5,
            vocal_pitch=5,
        )

        guest = mapper.get_contrasting_voice(main_config, 0)
        assert guest.accent == "Australia"

    def test_get_contrasting_voice_modifies_pitch(self, mapper):
        """Test that contrasting voice modifies pitch."""
        main_config = mapper.get_voice_config(
            gender="MALE",
            accent="United States",
            speaking_speed=5,
            vocal_pitch=5,
        )

        guest = mapper.get_contrasting_voice(main_config, 0)
        # Guest 0 should have pitch modification
        assert guest.pitch != main_config.pitch


class TestVoiceConfig:
    """Test cases for VoiceConfig dataclass."""

    def test_voice_config_creation(self):
        """Test VoiceConfig creation."""
        config = VoiceConfig(
            voice_id="en-US-Standard-A",
            gender="MALE",
            accent="United States",
            rate="+10%",
            pitch="+5Hz",
        )

        assert config.voice_id == "en-US-Standard-A"
        assert config.gender == "MALE"
        assert config.accent == "United States"
        assert config.rate == "+10%"
        assert config.pitch == "+5Hz"
