"""Phase 0 local diagnostics. No network clients are instantiated."""
import argparse
import json
from pathlib import Path
from time import monotonic
from config import Config
from infrastructure.exceptions import AudioDeviceError, AudioFormatError, ConfigurationError
from infrastructure.logger import configure_logging, log_event
from infrastructure.platform_info import system_info


def main(argv=None):
    parser = argparse.ArgumentParser(description="AI 친구 Phase 0: 로컬 오디오 진단")
    commands = parser.add_mutually_exclusive_group(required=True)
    for flag, help_text in [("devices", "입출력 장치 조회"), ("test-microphone", "5초 녹음, 재생 없음"),
                            ("test-speaker", "낮은 음량의 1초 사인파 재생"),
                            ("test-audio", "5초 녹음 후 명시적 요청 시 재생"), ("system-info", "시스템 정보")]:
        commands.add_argument(f"--{flag}", action="store_true", help=help_text)
    parser.add_argument("--input-device", type=int, help="입력 장치 ID (환경변수보다 우선)")
    parser.add_argument("--output-device", type=int, help="출력 장치 ID (환경변수보다 우선)")
    args = parser.parse_args(argv)
    configure_logging()
    started = monotonic()
    try:
        config = Config.load()
        from dataclasses import replace
        for key in ("input_device", "output_device"):
            value = getattr(args, key)
            if value is not None:
                if value < 0 or value > 65535:
                    raise ConfigurationError("장치 ID는 0~65535 범위여야 합니다.")
                config = replace(config, **{f"audio_{key}": value})
        configure_logging(config.log_level, Path(__file__).parent / "logs")
        log_event("program_start")
        if args.system_info:
            print(json.dumps(system_info(), ensure_ascii=False, indent=2))
        elif args.devices:
            from audio.devices import list_devices
            devices = list_devices()
            for d in devices:
                print(f"ID={d.id} {d.name} input={d.input_channels} output={d.output_channels} default={d.default_sample_rate}Hz")
            log_event("devices_ready", input_count=sum(d.input_channels > 0 for d in devices), output_count=sum(d.output_channels > 0 for d in devices))
        elif args.test_microphone:
            from audio.microphone import record_microphone
            recording = record_microphone(sample_rate=config.audio_sample_rate, channels=config.audio_channels, device=config.audio_input_device)
            try:
                print(f"RMS={recording.rms:.3f} peak={recording.peak:.3f} clipping={recording.clipped}")
            finally:
                recording.clear()
        elif args.test_speaker:
            from audio.speaker import Speaker
            speaker = Speaker(config.audio_output_device)
            try:
                speaker.test_tone(sample_rate=config.audio_sample_rate)
            finally:
                speaker.stop()
        elif args.test_audio:
            from audio.audio_test import run_audio_test
            run_audio_test(config)
        log_event("operation_complete", duration_ms=round((monotonic() - started) * 1000))
        return 0
    except (AudioDeviceError, AudioFormatError, ConfigurationError) as error:
        log_event("operation_failed", error_type=type(error).__name__)
        print(str(error))
        return 1
    except (KeyboardInterrupt, EOFError):
        log_event("operation_failed", error_type="KeyboardInterrupt")
        print("작업이 중단되었습니다. 녹음 버퍼와 오디오 장치를 정리했습니다.")
        return 130
    except Exception:
        log_event("operation_failed", error_type="UnexpectedError")
        print("예상하지 못한 오류입니다. 장치와 설치 상태를 확인하세요.")
        return 1
    finally:
        log_event("program_end")


if __name__ == "__main__":
    raise SystemExit(main())
