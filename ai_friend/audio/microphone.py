from dataclasses import dataclass
from math import gcd
import numpy as np
from scipy.signal import resample_poly
from audio.devices import backend, select_device
from audio.streams import managed_stream
from infrastructure.exceptions import AudioDeviceError, AudioFormatError
from infrastructure.logger import log_event


@dataclass
class Recording:
    pcm: np.ndarray
    sample_rate: int
    rms: float
    peak: float
    clipped: bool

    def clear(self):
        self.pcm.fill(0)


def to_pcm16(samples):
    data = np.asarray(samples, dtype=np.float32)
    if data.ndim not in (1, 2) or not data.size or not np.isfinite(data).all():
        raise AudioFormatError("유효한 유한 오디오 배열이 필요합니다.")
    if data.ndim == 2:
        data = data.mean(axis=1)
    return np.clip(np.rint(data * 32768), -32768, 32767).astype(np.int16)


def resample(samples, source_rate, target_rate):
    if source_rate <= 0 or target_rate <= 0:
        raise AudioFormatError("샘플레이트는 양수여야 합니다.")
    if source_rate == target_rate:
        return samples.copy()
    divisor = gcd(source_rate, target_rate)
    return resample_poly(samples, target_rate // divisor, source_rate // divisor, axis=0).astype(np.float32)


def record_microphone(*, duration=5, sample_rate=24000, channels=1, device=None):
    if not 0 < duration <= 30 or not 8000 <= sample_rate <= 192000 or channels not in (1, 2):
        raise AudioFormatError("녹음 시간(0~30초), 샘플레이트 또는 채널 설정을 확인하세요.")
    sd = backend()
    device_id, info = select_device(device, "input")
    channels = min(channels, int(info["max_input_channels"]))
    rates = list(dict.fromkeys([sample_rate, int(round(info["default_samplerate"])), 48000, 44100]))
    native_rate = None
    for rate in rates:
        try:
            sd.check_input_settings(device=device_id, channels=channels, dtype="float32", samplerate=rate)
            native_rate = rate
            break
        except Exception:
            continue
    if native_rate is None:
        raise AudioDeviceError("입력 장치가 지원하는 샘플레이트를 찾지 못했습니다.")
    total = int(round(duration * native_rate))
    raw = np.empty((total, channels), dtype=np.float32)
    converted = None
    try:
        with managed_stream(sd.InputStream(device=device_id, samplerate=native_rate, channels=channels, dtype="float32")) as stream:
            offset = 0
            peak = 0.0
            energy = 0.0
            while offset < total:
                count = min(1024, total - offset)
                block, overflow = stream.read(count)
                try:
                    if overflow:
                        raise AudioDeviceError("입력 버퍼가 넘쳤습니다. 장치/시스템 부하를 확인하세요.")
                    if not np.isfinite(block).all():
                        raise AudioFormatError("오디오 입력에 유효하지 않은 값이 있습니다.")
                    raw[offset:offset + count] = block
                    peak = max(peak, float(np.max(np.abs(block))))
                    energy += float(np.sum(block.astype(np.float64) ** 2))
                    offset += count
                finally:
                    block.fill(0)
        converted = resample(raw, native_rate, sample_rate)
        pcm = to_pcm16(converted)
        result = Recording(pcm, sample_rate, float(np.sqrt(energy / raw.size)), peak, peak >= 0.999)
        log_event("recording_complete", sample_rate=sample_rate, frames=len(pcm), clipped=result.clipped)
        return result
    except (AudioDeviceError, AudioFormatError):
        raise
    except Exception:
        raise AudioDeviceError("마이크 녹음에 실패했습니다.") from None
    finally:
        raw.fill(0)
        if converted is not None:
            converted.fill(0)
