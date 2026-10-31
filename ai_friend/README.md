# AI 친구 디바이스 — Phase 0 (기존 Python 기반)

> 2026-10-31: 물리 디바이스 제작 대신 웹으로 전환했습니다. 현재 실행 경로는 [웹 안내](../web/README.md), 최신 계획은 [웹 전환 설계](../docs/web_transition.md)를 참고하세요. 아래 Python/하드웨어 문서는 기존 구현 기록이며 웹 실행에는 필요하지 않습니다.

만 3~6세 아동용 디바이스의 개발 기반입니다. 현재는 **개발자가 수행하는 로컬 오디오 진단**과 설정/인증/동의 인터페이스만 제공합니다. 실제 아동 음성을 사용하지 않고 성인 개발자 또는 합성 음원으로 점검하세요. AI 연결, WebSocket 스트리밍, 책 읽기, 감정 분석, VAD, 에코 제거, SQLite 기억 기능은 구현하지 않습니다.

Python **3.11 이상**, Windows 및 64비트 Raspberry Pi OS를 대상으로 합니다. 이 저장소의 클라우드 검증 환경은 Python 3.12 / Debian 13 x86_64입니다. Windows 및 Pi의 실제 장치 동작은 별도 검증 대상입니다.

## Windows 설치 (PowerShell)

저장소 루트에서 실행합니다.

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
cd ai_friend
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
python main.py --system-info
python main.py --devices
```

가상환경 활성화가 정책으로 막혀 있으면 정책 변경 없이 `..\.venv\Scripts\python.exe main.py --devices`처럼 직접 실행할 수 있습니다. sounddevice의 Windows wheel에는 PortAudio가 포함됩니다. 설정 > 개인정보 및 보안 > 마이크에서 데스크톱 앱 권한을 확인하고, 장치 조회 후 ID를 선택하세요.

## Raspberry Pi OS 설치

Raspberry Pi 5 / 4GB, **64비트 Raspberry Pi OS Bookworm 이상**, Python 3.11 이상을 권장합니다. USB 마이크와 스피커 또는 USB 오디오 어댑터를 연결하세요.

```bash
sudo apt-get update
sudo apt-get install -y python3-venv python3-pip libportaudio2
cd /path/to/Test
python3 -m venv .venv
source .venv/bin/activate
cd ai_friend
python -m pip install -r requirements-dev.txt
cp .env.example .env
python main.py --system-info
python main.py --devices
```

SciPy는 안티앨리어싱 필터가 있는 유리비율 리샘플링에 사용합니다. 32비트 OS는 wheel 가용성이 다르므로 이 문서의 검증 대상에 포함하지 않습니다. 디바이스별 추가 설정은 [device_setup.md](docs/device_setup.md)를 참고하세요.

## 실행

모든 명령은 `ai_friend/`에서 실행합니다. 기본 녹음은 5초, 목표 형식은 24kHz 모노 PCM16입니다.

```bash
python main.py --help
python main.py --devices
python main.py --test-microphone --input-device 0
python main.py --test-speaker --output-device 1
python main.py --test-audio --input-device 0 --output-device 1
python main.py --system-info
```

ID는 예시입니다. `--devices` 결과로 선택하세요. CLI 지정은 환경변수보다 우선합니다. `--devices`는 장치 조회만 수행하며 녹음/재생/API 접속을 하지 않습니다. 마이크 테스트도 재생하지 않습니다. 통합 테스트는 녹음이 끝난 뒤 **PLAY**를 입력해야 재생합니다. 그 외 응답이나 입력 종료는 재생하지 않습니다. 실시간 마이크 루프백은 없습니다. Ctrl+C로 중단하면 스트림을 닫고 앱이 소유한 버퍼를 0으로 덮습니다.

스피커 신호는 최대 절대 진폭 0.2로 제한하며 기본 0.1로 재생합니다. 이는 디지털 신호 제한이고 실제 음압 제한이 아닙니다. 하드웨어 볼륨을 낮추고 성인이 먼저 점검하세요. 24kHz를 지원하지 않으면 장치 기본 주파수, 48kHz, 44.1kHz 순으로 검사 후 정확한 비율로 변환합니다.

## 환경변수와 개인정보

`.env.example`을 `.env`로 복사하고 필요한 장치 ID만 입력해도 됩니다. `.env`는 Git에서 제외되며 OS 환경변수가 우선합니다. `.env`의 변수 보간은 하지 않습니다.

| 변수 | 기본값 / 범위 |
|---|---|
| APP_ENV | development / development, test, production |
| LOG_LEVEL | INFO / DEBUG, INFO, WARNING, ERROR, CRITICAL |
| AUDIO_SAMPLE_RATE | 24000 / 8000~192000 정수 |
| AUDIO_CHANNELS | 1 / 1 또는 2 (저장/재생 형식은 모노) |
| AUDIO_INPUT_DEVICE, AUDIO_OUTPUT_DEVICE | 비어 있음 / 0~65535, 공란이면 시스템 기본 |
| AI_PROVIDER | openai / openai 또는 gemini |
| OPENAI_REALTIME_MODEL, GEMINI_LIVE_MODEL | 공란 허용; Phase 1에서 검증 |
| AUTH_SERVER_URL | 공란 허용; 설정할 경우 자격증명 없는 HTTPS URL |
| DEVICE_ID | 공란 허용; 로그/출력 금지 |
| ENABLE_AUDIO_STORAGE, ENABLE_TRANSCRIPT_STORAGE | false / true 또는 false |

키, 인증 토큰, 이름, 전화번호를 소스/예제/로그에 넣지 마세요. Phase 0에는 API 키가 필요 없습니다. 저장 플래그를 true로 해도 현재 진단 CLI는 파일 저장을 구현하지 않습니다. 미래의 저장 기능은 플래그와 검증된 동의를 모두 검사해야 합니다. `UnverifiedConsent`는 NOT_REQUESTED → PENDING 또는 REVOKED만 지원하며 GRANTED를 만들어 주지 않습니다. **외부 전송은 동의 여부와 관계없이 Phase 0에서 차단**됩니다.

진단 로그만 `logs/operations.log`에 남습니다. 파일당 최대 1MB, 백업 3개입니다. 로그는 미리 정의된 이벤트와 숫자 측정값, 오류 종류만 허용하며 예외 원문/traceback/임의 메시지는 저장하지 않습니다. 장치 이름은 사용자 장치 조회 화면에만 출력됩니다. 버퍼 덮어쓰기는 최선의 앱 수준 정리이며 운영체제/드라이버 버퍼, swap, Python 내부 복사본까지 완전 삭제를 보장하지 않습니다.

## 테스트

```bash
python -m pytest -q
```

기본 실행은 `hardware` 테스트를 제외합니다. 입력/출력 스트림은 모의 장치로 대체되므로 CI에서 마이크 없이 실행됩니다. PCM 변환, 안티앨리어싱, 실제 프레임 길이, 명시적 재생, 오류/중단 시 정리, 동의/토큰/로그를 검증합니다.

물리 장치를 연결한 성인 개발자가 아래 명령으로 장치 테스트를 명시적으로 실행합니다. 실제 소리가 나며 5초 녹음합니다.

```bash
python -m pytest -q -m hardware
python main.py --test-audio
```

하드웨어 pytest 성공은 장치 접근/프레임 수/재생 명령 성공을 뜻합니다. 음질, 청취 가능 여부, 실제 음압, 동의 UI는 수동 검증이 필요합니다. 테스트 체크리스트는 [phase0_checklist.md](docs/phase0_checklist.md)를 사용하세요.

## 폴더

- `audio/`: 장치 조회, 녹음/재생, 메모리 내 통합 테스트
- `realtime/`: 제공자 공통 인터페이스 및 단기 권한/갱신 계약
- `safety/`: 보호자 동의 상태, 처리 권한, 전용 로컬 데이터 삭제
- `infrastructure/`: 허용 목록 기반 로그, 공통 예외, 시스템 정보
- `tests/`: 모의 장치 단위 테스트와 명시적 하드웨어 테스트
- `docs/`: 아키텍처, 개인정보 설계, 장치 설정, 검증 기록

## 클라우드 환경

저장소 루트에서 `bash scripts/setup_cloud.sh`는 이 Codex Debian 13 amd64 환경 전용 설치/검증 스크립트입니다. 비관리자 계정이므로 Debian 서명 및 패키지 체크섬 검증을 사용하는 apt로 PortAudio를 `/workspace/portaudio-runtime`에 설치합니다. 소스나 인증 정보를 수정하지 않습니다.

새 셸에서는 `source /workspace/Test/scripts/activate_cloud.sh` 후 `cd /workspace/Test/ai_friend`를 실행하세요. 클라우드에는 오디오 장치가 없으므로 `--devices`가 명확한 오류와 종료 코드 1을 반환하는 것이 정상입니다. 데몬이나 AI 서버를 실행할 필요가 없습니다.

## Phase 1 연결 전에

구체적인 검토 방법과 통과 기준은 [Phase 1 착수 전 검토](docs/phase1_readiness_review.md)를 참고하세요.

1. 실제 Windows / Pi에서 녹음, 재생, 지원 주파수, 중단, 음압을 검증합니다.
2. 인증 서버에서 기기 등록/검증, 단기 권한 발급/갱신/철회를 구현합니다. 장기 제공자 API 키는 서버에서만 관리합니다.
3. 제공자의 아동 이용/데이터 처리 조건과 국내 적용 요건을 별도 검토하고 검증된 법정대리인 동의 흐름을 구현합니다.
4. 위 조건이 모두 충족된 후 외부 전송 허용 정책을 별도 설계합니다. 현재 차단을 단순 삭제하는 방식으로 연결하지 않습니다.
5. `BaseRealtimeClient`를 상속해 OpenAI 어댑터를 구현하고 제공자별 모델/이벤트/WebSocket/재연결/취소를 검증합니다. Gemini도 같은 인터페이스로 확장합니다.
