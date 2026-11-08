# 모모 — 브라우저 AI 친구 플레이그라운드

물리 디바이스 대신 **웹 브라우저에서 사용하는 모모**입니다. PC/휴대폰 마이크로 OpenAI Realtime 음성 대화를 제공합니다. 메인 화면에는 새로 생성한 모모 캐릭터와 대화 기능을 표시하며 오디오 테스트 메뉴는 제거했습니다. 실시간 전송은 별도 동의 후 시작합니다.

**현재 배포 플랫폼은 Railway이며, 배포 브랜치는 `main`입니다.** 루트 Dockerfile과 railway.json을 사용합니다. [Railway 설정](docs/railway_deployment.md)을 참고하세요.

로컬에서는 Node.js 24 이상과 npm을 설치한 뒤 저장소 루트에서 실행하세요.

```bash
cd web
npm ci
npm run dev
```

터미널에서 안내하는 개발 서버를 브라우저로 여세요. 기본 포트는 5173입니다. 다른 기기나 공개 도메인에서 실제 마이크를 쓰려면 **HTTPS**가 필요합니다. 클라우드 테스트는 브라우저의 가상 마이크를 사용하며, 사용자의 실제 장치 청취를 검증하지는 않습니다.

- [Realtime 연결 및 Railway 변수 설정](docs/realtime_setup.md)
- [아이 프로필 설정 — 이름·나이·64개 관심사](docs/child_profile.md)
- [모모 기본 답변 프롬프트 — 3~6세 대화 지침](docs/momo_prompt.md)
- [라이프 가이드 — 부모님 생활 시간 설정과 대화 화두](docs/life_guide.md)
- [PostgreSQL 연결 — 웹 서비스 DATABASE_URL 설정](docs/railway_deployment.md#postgresql-생활-시간표-저장)
- [Railway 배포 안내 — 현재 배포 대상](docs/railway_deployment.md)
- [웹 실행·테스트·배포 안내](web/README.md)
- [웹 전환 설계 및 Phase 1 준비 계획](docs/web_transition.md)
- [기존 Python 기반](ai_friend/README.md): 유지되지만 웹 실행에는 Python/PortAudio/Pi가 필요하지 않습니다.

`main`에서 현재 Railway용 웹사이트를 배포합니다. `v0.1.0`과 `v0.2.0` 태그 및 `release/web-v0.2.0` 브랜치는 이전 버전 확인용으로 유지합니다. 현재 사이트를 열려면 [Railway 배포 안내](docs/railway_deployment.md)를 따르세요.
