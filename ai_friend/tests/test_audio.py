import numpy as np
import pytest
from audio.devices import list_devices, select_device
from audio.microphone import record_microphone, to_pcm16, resample
from audio.speaker import Speaker
from audio.audio_test import run_audio_test
from config import Config
from infrastructure.exceptions import AudioDeviceError, AudioFormatError


def test_devices_and_selection(fake_audio):
    assert [d.id for d in list_devices()] == [0, 1]
    assert select_device(None, "input")[0] == 0
    assert select_device(1, "output")[0] == 1
    with pytest.raises(AudioDeviceError):
        select_device(1, "input")


def test_no_devices(fake_audio):
    fake_audio.query_devices.side_effect = None
    fake_audio.query_devices.return_value = []
    with pytest.raises(AudioDeviceError):
        list_devices()


def test_pcm16_mono_and_clipping():
    stereo = np.array([[1, 1], [-1, -1], [0.5, -0.5], [2, 2]], dtype=np.float32)
    pcm = to_pcm16(stereo)
    assert pcm.dtype == np.int16
    assert pcm.tolist() == [32767, -32768, 0, 32767]
    assert np.array_equal(stereo[0], [1, 1])


@pytest.mark.parametrize("data", [[], [float("nan")], [[[0.0]]]])
def test_invalid_pcm(data):
    with pytest.raises(AudioFormatError):
        to_pcm16(data)


def test_resampling_length_frequency_and_alias_rejection():
    t = np.arange(48000) / 48000
    tone = np.sin(2 * np.pi * 1000 * t)
    converted = resample(tone, 48000, 24000)
    assert len(converted) == 24000
    assert np.argmax(abs(np.fft.rfft(converted))) == 1000
    # Downsampling must filter frequencies above the new Nyquist limit.
    high = resample(np.sin(2 * np.pi * 18000 * t), 48000, 24000)
    assert np.sqrt(np.mean(high[100:-100] ** 2)) < 0.01


def test_record_native_rate_fallback(fake_audio):
    fake_audio.check_input_settings.side_effect = lambda **kw: (_ for _ in ()).throw(ValueError()) if kw["samplerate"] == 24000 else None
    recording = record_microphone(duration=0.1)
    assert recording.sample_rate == 24000
    assert len(recording.pcm) == 2400
    assert recording.rms == pytest.approx(0.25)
    assert not recording.clipped
    assert fake_audio.InputStream.call_args.kwargs["samplerate"] == 48000
    fake_audio.InputStream.return_value.close.assert_called_once()
    recording.clear()
    assert not recording.pcm.any()


@pytest.mark.parametrize("failure", [RuntimeError(), KeyboardInterrupt()])
def test_input_cleanup_on_error(fake_audio, failure):
    fake_audio.InputStream.return_value.read.side_effect = failure
    with pytest.raises((AudioDeviceError, KeyboardInterrupt)):
        record_microphone(duration=0.01)
    fake_audio.InputStream.return_value.close.assert_called_once()


def test_input_overflow(fake_audio):
    fake_audio.InputStream.return_value.read.side_effect = lambda n: (np.zeros((n, 1), np.float32), True)
    with pytest.raises(AudioDeviceError):
        record_microphone(duration=0.01)
    fake_audio.InputStream.return_value.close.assert_called_once()


def test_speaker_volume_device_and_cleanup(fake_audio):
    written = []
    fake_audio.OutputStream.return_value.write.side_effect = lambda block: written.append(block.copy()) or False
    Speaker(1).play(np.full(2400, 32767, np.int16), volume=0.2)
    assert fake_audio.OutputStream.call_args.kwargs["device"] == 1
    assert max(np.max(abs(b)) for b in written) <= 0.2
    fake_audio.OutputStream.return_value.close.assert_called_once()


def test_playback_stop(fake_audio):
    speaker = Speaker(1)
    def write(block):
        speaker.stop()
        return False
    fake_audio.OutputStream.return_value.write.side_effect = write
    speaker.play(np.ones(5000, np.float32))
    fake_audio.OutputStream.return_value.abort.assert_called_once()
    fake_audio.OutputStream.return_value.close.assert_called_once()


def test_speaker_failure_cleanup(fake_audio):
    fake_audio.OutputStream.return_value.write.side_effect = RuntimeError()
    with pytest.raises(AudioDeviceError):
        Speaker().test_tone()
    fake_audio.OutputStream.return_value.close.assert_called_once()


@pytest.mark.parametrize("approve, count", [(False, 0), (True, 1)])
def test_integration_requires_explicit_playback(monkeypatch, fake_audio, tmp_path, approve, count):
    monkeypatch.chdir(tmp_path)
    held = []
    def record(**kwargs):
        result = record_microphone(duration=0.01, **kwargs)
        held.append(result)
        return result
    monkeypatch.setattr("audio.audio_test.record_microphone", record)
    run_audio_test(Config(), request_playback=lambda: approve)
    assert fake_audio.OutputStream.call_count == count
    assert not held[0].pcm.any()
    assert list(tmp_path.iterdir()) == []


def test_integration_cleans_buffer_on_interrupt(monkeypatch, fake_audio):
    held = record_microphone(duration=0.01)
    monkeypatch.setattr("audio.audio_test.record_microphone", lambda **kw: held)
    def interrupt():
        raise KeyboardInterrupt
    with pytest.raises(KeyboardInterrupt):
        run_audio_test(Config(), request_playback=interrupt)
    assert not held.pcm.any()


@pytest.mark.parametrize("volume", [0, 0.3, -1])
def test_volume_rejected(volume):
    with pytest.raises(AudioFormatError):
        Speaker().play(np.ones(10), volume=volume)


def test_stereo_capture_and_clipping(fake_audio):
    fake_audio.InputStream.return_value.read.side_effect = lambda n: (np.tile(np.array([1.0, -0.5], np.float32), (n, 1)), False)
    result = record_microphone(duration=0.01, channels=2)
    assert result.clipped
    assert result.peak == 1.0
    assert result.pcm.shape == (240,)
    assert np.all(result.pcm == 8192)
    result.clear()


def test_speaker_fallback_preserves_duration(fake_audio):
    fake_audio.check_output_settings.side_effect = lambda **kw: (_ for _ in ()).throw(ValueError()) if kw["samplerate"] == 24000 else None
    lengths = []
    fake_audio.OutputStream.return_value.write.side_effect = lambda block: lengths.append(len(block)) or False
    Speaker().play(np.zeros(2400, np.int16))
    assert fake_audio.OutputStream.call_args.kwargs["samplerate"] == 48000
    assert sum(lengths) == 4800


def test_all_input_rates_rejected(fake_audio):
    fake_audio.check_input_settings.side_effect = ValueError()
    with pytest.raises(AudioDeviceError):
        record_microphone(duration=0.01)
    fake_audio.InputStream.assert_not_called()


def test_playback_failure_still_clears_recording(monkeypatch, fake_audio):
    recording = record_microphone(duration=0.01)
    monkeypatch.setattr("audio.audio_test.record_microphone", lambda **kw: recording)
    fake_audio.OutputStream.return_value.write.side_effect = RuntimeError()
    with pytest.raises(AudioDeviceError):
        run_audio_test(Config(), request_playback=lambda: True)
    assert not recording.pcm.any()


@pytest.mark.parametrize("kind", ["InputStream", "OutputStream"])
def test_start_failure_closes_device(fake_audio, kind):
    resource = getattr(fake_audio, kind).return_value
    resource.start.side_effect = RuntimeError("backend start failed")
    with pytest.raises(AudioDeviceError):
        if kind == "InputStream":
            record_microphone(duration=0.01)
        else:
            Speaker().test_tone()
    resource.close.assert_called_once()
    resource.abort.assert_called_once()
