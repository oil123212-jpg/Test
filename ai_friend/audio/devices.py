from dataclasses import dataclass
from infrastructure.exceptions import AudioDeviceError


def backend():
    try:
        import sounddevice
        return sounddevice
    except (ImportError, OSError):
        raise AudioDeviceError("오디오 백엔드를 로드할 수 없습니다. PortAudio 설치를 확인하세요.") from None


@dataclass(frozen=True)
class Device:
    id: int
    name: str
    input_channels: int
    output_channels: int
    default_sample_rate: float


def list_devices():
    try:
        devices = [Device(i, d["name"], d["max_input_channels"], d["max_output_channels"], d["default_samplerate"])
                   for i, d in enumerate(backend().query_devices())]
    except AudioDeviceError:
        raise
    except Exception:
        raise AudioDeviceError("오디오 장치를 조회할 수 없습니다.") from None
    devices = [d for d in devices if d.input_channels or d.output_channels]
    if not devices:
        raise AudioDeviceError("입출력 오디오 장치가 없습니다. 마이크/스피커를 연결하세요.")
    return devices


def select_device(device_id, kind):
    if kind not in {"input", "output"}:
        raise ValueError("kind must be input or output")
    sd = backend()
    try:
        if device_id is None:
            device_id = int(sd.default.device[0 if kind == "input" else 1])
        info = sd.query_devices(device_id)
        if device_id < 0 or info[f"max_{kind}_channels"] < 1:
            raise ValueError
        return device_id, info
    except Exception:
        raise AudioDeviceError(f"선택한 {kind} 장치를 사용할 수 없습니다. --devices로 ID를 확인하세요.") from None
