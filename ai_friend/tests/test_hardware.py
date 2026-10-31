"""Explicit adult-operated local diagnostics; excluded from normal CI."""
import pytest
from config import Config
from audio.devices import list_devices
from audio.microphone import record_microphone
from audio.speaker import Speaker

pytestmark = pytest.mark.hardware


def test_physical_devices():
    devices = list_devices()
    assert any(d.input_channels > 0 for d in devices)
    assert any(d.output_channels > 0 for d in devices)


def test_physical_microphone():
    config = Config.load()
    recording = record_microphone(device=config.audio_input_device)
    try:
        assert len(recording.pcm) == 120000
    finally:
        recording.clear()


def test_physical_speaker():
    speaker = Speaker(Config.load().audio_output_device)
    try:
        speaker.test_tone()
    finally:
        speaker.stop()
