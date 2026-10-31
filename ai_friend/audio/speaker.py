import threading
import numpy as np
from audio.devices import backend, select_device
from audio.streams import managed_stream
from audio.microphone import resample
from infrastructure.exceptions import AudioDeviceError, AudioFormatError
from infrastructure.logger import log_event


class Speaker:
    def __init__(self, device=None):
        self.device = device
        self._stop = threading.Event()

    def stop(self):
        # Stops this instance only; stream context releases the hardware.
        self._stop.set()

    def play(self, samples, sample_rate=24000, volume=0.1):
        if not 0 < volume <= 0.2 or not 8000 <= sample_rate <= 192000:
            raise AudioFormatError("음량은 0 초과 0.2 이하, 샘플레이트는 8000~192000이어야 합니다.")
        data = np.asarray(samples)
        if data.ndim != 1 or not data.size or not np.isfinite(data).all():
            raise AudioFormatError("모노 오디오 배열이 필요합니다.")
        sd = backend()
        device_id, info = select_device(self.device, "output")
        native_rate = None
        for rate in dict.fromkeys([sample_rate, int(round(info["default_samplerate"])), 48000, 44100]):
            try:
                sd.check_output_settings(device=device_id, channels=1, dtype="float32", samplerate=rate)
                native_rate = rate
                break
            except Exception:
                continue
        if native_rate is None:
            raise AudioDeviceError("출력 장치가 지원하는 샘플레이트를 찾지 못했습니다.")
        floating = data.astype(np.float32)
        if data.dtype == np.int16:
            floating /= 32768
        output = None
        self._stop.clear()
        try:
            np.clip(floating, -1, 1, out=floating)
            floating *= volume
            output = resample(floating, sample_rate, native_rate)
            np.clip(output, -volume, volume, out=output)
            with managed_stream(sd.OutputStream(device=device_id, samplerate=native_rate, channels=1, dtype="float32")) as stream:
                for offset in range(0, len(output), 1024):
                    if self._stop.is_set():
                        stream.abort()
                        break
                    if stream.write(output[offset:offset + 1024].reshape(-1, 1)):
                        raise AudioDeviceError("출력 버퍼가 부족합니다.")
            log_event("playback_complete", sample_rate=native_rate, frames=len(output))
        except AudioDeviceError:
            raise
        except Exception:
            raise AudioDeviceError("스피커 재생에 실패했습니다.") from None
        finally:
            floating.fill(0)
            if output is not None:
                output.fill(0)

    def test_tone(self, duration=1, sample_rate=24000):
        if not 0 < duration <= 5:
            raise AudioFormatError("테스트 음원은 0~5초로 제한됩니다.")
        tone = np.sin(2 * np.pi * 440 * np.arange(int(duration * sample_rate)) / sample_rate).astype(np.float32)
        # Short fade prevents clicks at start/end.
        fade = min(int(sample_rate * 0.02), len(tone) // 2)
        tone[:fade] *= np.linspace(0, 1, fade)
        tone[-fade:] *= np.linspace(1, 0, fade)
        try:
            self.play(tone, sample_rate)
        finally:
            tone.fill(0)
