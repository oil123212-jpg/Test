import pytest
from config import Config
from infrastructure.exceptions import ConfigurationError


def test_defaults(tmp_path):
    config = Config.load({}, tmp_path / "absent")
    assert config.audio_sample_rate == 24000
    assert config.audio_channels == 1
    assert not config.enable_audio_storage
    assert not config.enable_transcript_storage
    assert config.openai_realtime_model == ""


@pytest.mark.parametrize("values", [
    {"AUDIO_SAMPLE_RATE": "0"}, {"AUDIO_SAMPLE_RATE": "garbage-secret"},
    {"AUDIO_CHANNELS": "3"}, {"AUDIO_INPUT_DEVICE": "-1"},
    {"ENABLE_AUDIO_STORAGE": "yes"}, {"LOG_LEVEL": "TRACE"},
    {"AI_PROVIDER": "unknown"}, {"AUTH_SERVER_URL": "http://example.com"},
    {"AUTH_SERVER_URL": "https://user:secret@example.com"},
])
def test_invalid_config(values, tmp_path):
    with pytest.raises(ConfigurationError) as error:
        Config.load(values, tmp_path / "absent")
    assert "garbage-secret" not in str(error.value)
    assert "user:secret" not in str(error.value)


def test_dotenv_and_override(tmp_path):
    env = tmp_path / ".env"
    env.write_text("AUDIO_SAMPLE_RATE=48000\nAUDIO_INPUT_DEVICE=2\nENABLE_AUDIO_STORAGE=true\n")
    config = Config.load({"AUDIO_SAMPLE_RATE": "24000"}, env)
    assert config.audio_sample_rate == 24000
    assert config.audio_input_device == 2
    assert config.enable_audio_storage
