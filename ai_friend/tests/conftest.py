from unittest.mock import MagicMock
import numpy as np
import pytest
import audio.devices as devices


@pytest.fixture
def fake_audio(monkeypatch):
    sd = MagicMock()
    sd.default.device = (0, 1)
    infos = [dict(name="Mock microphone", max_input_channels=2, max_output_channels=0, default_samplerate=48000),
             dict(name="Mock speaker", max_input_channels=0, max_output_channels=2, default_samplerate=48000)]
    sd.query_devices.side_effect = lambda index=None: infos if index is None else infos[index]
    stream = sd.InputStream.return_value
    stream.read.side_effect = lambda n: (np.full((n, 1), 0.25, dtype=np.float32), False)
    sd.OutputStream.return_value.write.return_value = False
    monkeypatch.setattr(devices, "backend", lambda: sd)
    monkeypatch.setattr("audio.microphone.backend", lambda: sd)
    monkeypatch.setattr("audio.speaker.backend", lambda: sd)
    return sd
