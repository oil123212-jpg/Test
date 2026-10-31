# Phase 0 검증 기록

> 2026-10-31 웹 전환: [최신 설계 및 검토 기준](../../docs/web_transition.md). 아래는 기존 Python/디바이스 기반 기록입니다. 제공자·개인정보 검토는 유지하고, Pi 장치 및 기기 인증 항목은 웹 기준으로 대체합니다.

## 현재 검증 환경

- 날짜: 2026-10-13
- Codex 클라우드: Debian 13 x86_64 / Python 3.12.14
- 단위 테스트: **61 passed, 3 deselected**; 실패/skip 없음 (Linux 검증)
- 실제 오디오 장치: 없음 (`/dev/snd` 없음, PortAudio query_devices 결과 0)
- Windows / Raspberry Pi 물리 검증: 미실행

## 소프트웨어 체크리스트

- [x] 설정 기본값/범위/잘못된 값 오류, 모델명 공란 허용
- [x] CLI 도움말 및 시스템 정보 실행
- [x] 모의 장치 조회/선택, 무장치 오류
- [x] PCM16/스테레오 → 모노/필터 리샘플링/프레임 수
- [x] 녹음 중 RMS/peak/clipping, 입력 버퍼 오류 처리
- [x] 명시적 PLAY 요청만 재생, 실시간 루프백 없음
- [x] 출력 진폭 제한, 출력 주파수 fallback, 중단/오류 자원 정리
- [x] 기본 음성/전사문 저장 없음, 디스크 쓰기 없는 통합 테스트
- [x] 추상 제공자/인증 계약, 단기 토큰 만료 검사
- [x] 동의 기본 미요청, 승인 가짜 구현 없음
- [x] 미동의 차단 및 동의가 있어도 Phase 0 외부 전송 차단
- [x] 로그 개인정보 제외와 순환 저장 테스트
- [x] 문서와 설치/실행 명령 작성

## 물리 검증 — 미완료

- [ ] Windows에서 실제 장치 조회/녹음/재생
- [ ] Raspberry Pi 5에서 실제 장치 조회/녹음/재생
- [ ] 통합 테스트에서 요청 후만 재생되는지 청취 확인
- [ ] 실제 24kHz 미지원 장치의 fallback 음질 점검
- [ ] 입력 음량/클리핑, 실제 출력 음압 점검
- [ ] Ctrl+C 및 장치 분리 후 재사용 확인

실제 하드웨어가 없으므로 Phase 0 전체 완료를 주장하지 않습니다. pytest의 hardware 테스트는 기본 선택에서 제외되며 통과/실패로 집계하지 않습니다. CI 설정은 작성했으나 GitHub Actions 원격 실행은 아직 검증하지 않았습니다.

## 검증 기록 양식

| 날짜 / OS / Python | 장치 / ID | 명령 | passed / failed / skipped / deselected | 비고 |
|---|---|---|---|---|
| 2026-10-13 / Debian 13 / 3.12.14 | Mock | python -m pytest -q | 61 passed, 3 deselected | 하드웨어 3개 선택 제외 |
| 2026-10-13 / Debian 13 / 3.12.14 | 실제 장치 없음 | python main.py --devices | exit 1 / 장치 없음 | 정상적인 명확한 오류; 입출력 성공 검증 아님 |
| 후속 검증 | 실제 Windows / Pi | 수동 CLI 및 hardware pytest | 미실행 | 물리 장치 필요 |
