# 모모 웹 플레이그라운드 — 전체 작업 맥락 및 에이전트 인수인계

작성: **2026-10-31, Asia/Seoul**. 마지막 저장소 상태 확인: 2026-10-31 19:09 KST경.
대상 독자: 이 대화를 보지 못한 후속 개발/배포 에이전트.

이 문서는 사용자 요구, 변경 이력, 실제 구현, GitHub/Railway 배포 상태, 검증 근거, 미완료 항목을 구분한다. 맨 뒤에 **최초 요구사항 원문 전체**를 포함했다. 원문과 이후 결정이 다를 때는 본문의 최신 사용자 결정이 우선한다. 문서에 적힌 과거 성공은 실제 Railway 최신 배포 성공이나 법적 적합성 확인을 뜻하지 않는다.

## 0. 1분 안에 파악할 현재 상태

- 프로젝트 이름은 **모모(momo)**. 만 3~6세용 AI 친구 프로젝트의 **Phase 0 웹 기반**이다.
- 사용자는 실제 디바이스를 제작하지 않기로 했다. **현재 제품은 웹사이트이며 배포 플랫폼은 Railway**다.
- GitHub: **oil123212-jpg/Test**, https://github.com/oil123212-jpg/Test
- 현재 작업 경로: `/workspace/Test`. 앱 소스: `/workspace/Test/web`.
- 최신 GitHub `main`과 `release/web-v0.2.0`은 모두 **`921e1d739615056a92a7f930244b3636860bb74d`**.
- 최근 구현: 왼쪽 개인정보/준비 체크리스트 메뉴와 관련 페이지·카드·링크를 제거. 개인정보 안내는 **체험 로그인 시 동의 팝업**으로 변경.
- 사용자는 이번 범위를 **“동의 팝업까지 추가 (권장)”**로 명시적으로 선택했다. 실제 계정 인증/회원가입/보호자 본인 확인은 추가하지 않는다.
- 실제 마이크 요청은 로컬 동의 후에만 가능. 합성 데모는 동의 없이 가능. 실제 AI 연결/외부 음성 업로드는 없다.
- 최근 로컬 검증: **서버 테스트 7개 + 브라우저 테스트 46개 = 53개 통과**, TypeScript/프로덕션 빌드 통과.
- Railway에서 실제로 확인된 오류는 `RUN --mount=type=secret,id=build_ca` 미지원이었다. **`3e82400`에서 제거**했고 현재 Dockerfile은 표준 `RUN npm ci`다. 다시 넣지 말 것.
- **Railway 서비스 URL/프로젝트 ID/계정 인증은 제공되지 않았다. 최신 Railway 배포 성공과 공개 사이트 접속은 미확인**이다.
- 현재 인계 요청은 “지금까지의 모든 맥락을 다른 에이전트가 사용할 수 있게 파일로 정리”하는 것이다. 앱의 새 기능 추가 요청은 아니다.

## 1. 사용자의 목표와 최신 확정 사항

### 1.1 장기 목표

만 3~6세 아동이 AI와 음성으로 대화하고, 장차 책 읽기/감정 표현 등을 할 수 있는 친구 서비스. 처음에는 Pi 5 기반 장치를 생각했지만 **실제 기기는 만들지 않고 웹으로 사용**하기로 바뀌었다.

### 1.2 이번까지의 범위

Phase 0: 개발 기반, 로컬 오디오 점검, 설정/인증/제공자 추상 인터페이스, 개인정보 기본값, 테스트/문서. Phase 1 실제 Realtime 연결은 아직 시작하지 않았다. 책 읽기, 감정 분석, 장기 기억, VAD, 에코 제거, SQLite 기반 대화 저장도 구현하지 않았다.

### 1.3 반복 안내하지 말아야 할 이미 결정된 사항

1. **Railway에서 작업한다.** 사용자가 명확히 재차 정정했다. GitHub Pages나 Netlify로 플랫폼을 임의 변경하지 않는다.
2. GitHub는 소스/버전 관리용, 실제 서비스 호스팅은 Railway다.
3. GitHub Pages 유료 제한을 사용자가 지적했다. 저장소를 공개로 바꾼 적 없고, 공개 전환도 요청받지 않았다.
4. 실제 하드웨어/Pi 설치를 웹 실행의 필수로 만들지 않는다. 기존 Python 소스는 보존한 참고 기반이다.
5. 준비 체크리스트는 웹 UI에서 제거한다. 개인정보도 왼쪽 카탈로그/독립 페이지로 되살리지 않는다.
6. 관련 진입 링크와 하단 연결 카드도 제거한다. 메뉴만 숨기고 이벤트/옛 라우트를 방치하지 않는다.
7. 개인정보 안내·동의는 로그인 진입 팝업으로 처리한다. **실제 계정 인증은 이번 범위에서 제외**하는 데 사용자가 동의했다.
8. 사용자에게 설계 설명만 주고 끝내지 말고, 실제 파일 수정/검증/필요한 GitHub 반영까지 진행해 왔다.
9. 사용자는 상세 검토와 이상한 부분 수정을 원했고 “high로 바꿔서 이어해 달라”고 한 적 있다. 대화 내 모델 설정을 직접 바꾼 사실은 없으며, 모델이 변경됐다고 주장하지 않았다.
10. 대화 및 제품 카피는 한국어를 사용한다.

## 2. 대화/작업 흐름 전체 요약

| 순서 | 사용자 요청/발견 | 실제 처리 및 현재 의미 |
|---|---|---|
| 1 | cloud-environment-onboarding:setup으로 `oil123212-jpg/Test`, main 환경 설정 | 처음에는 원격/로컬 모두 파일·커밋 없는 저장소. Git 읽기 인증은 정상. Python/Node 사용 가능 확인. |
| 2 | Phase 0 상세 사양을 텍스트 파일로 전달, 실제 구현 요청 | `ai_friend/` Python 기반과 테스트/문서 구현. 최초 사양 원문은 부록에 포함. |
| 3 | high 수준으로 검토하고 이상한 부분 수정 | PCM16 음수 경계, 리샘플링, 종료/오류 자원 정리, 로깅/동의 차단 등을 검토. 스트림 시작 실패 때도 닫는 구조 추가. |
| 4 | Phase 1 전 검토와 구체적 방법 정리 | 제공자/아동 데이터 요건, 개인정보/동의, 인증·중계, 실제 오디오, 취소/비용/로그 등 문서 작성. 최신 제공자 공식 문서 접근이 실패해 정책 검증 완료로 표시하지 않음. |
| 5 | 물리 기기 없이 웹사이트로 사용하도록 설계/구현 | `web/` TypeScript+Vite, 브라우저 AudioWorklet/Web Audio, 합성 데모와 반응형 UI 구현. |
| 6 | GitHub에 다른 버전으로 배포 | 빈 원격에 기준 버전 v0.1.0과 별도 v0.2.0 브랜치/태그를 올림. Pages용 `/Test/` 경로와 gh-pages도 준비했으나 Pages 활성화는 못 함. |
| 7 | GitHub Pages 유료 지적 | 비공개 여부/요금제 제약을 먼저 확정하지 못한 안내 문제. Netlify 무료 정적 업로드 파일도 준비했으나 이후 플랫폼은 Railway로 확정됨. |
| 8 | “Railway에서 작업한다” 정정 | 루트 Dockerfile/railway.json, 의존성 없는 Node 정적 서버, PORT/healthcheck, Railway용 소스 ZIP, 문서 추가. |
| 9 | “웹사이트 열 수 있게 GitHub 수정” | main이 오래된 기준 코드였음을 발견. 최신 release 브랜치를 main으로 통합. Railway 기본 연결 브랜치는 main으로 문서 정리. |
| 10 | 배포 실패 스크린샷 및 실제 로그 | Railway가 secret 마운트를 거부함을 확정. 로컬 CA 빌드 설정을 생산 Dockerfile에서 제거하고 main/release에 푸시. |
| 11 | 체크리스트 삭제, 개인정보를 로그인 동의 팝업으로, 좌측 두 메뉴와 링크 제거, 오류 검토 | 최신 커밋 921e1d7. 관련 페이지/카드/CSS/아이콘/이벤트 제거 및 옛 주소 대시보드 복귀. 체험 로그인 동의/철회와 마이크 gate 추가. 53개 테스트 통과. |
| 12 | 실제 로그인까지 할지 질문에 “동의 팝업까지” 선택 | 현재 체험 로그인 범위가 사용자에게 명시적으로 승인됨. 실제 계정 인증을 무단 추가하지 않음. |
| 13 | 다른 에이전트용 전체 맥락 파일 요청 | 현재 인수인계 문서와 소스 묶음을 생성. 인계를 위해 소스나 GitHub 배포를 새로 변경할 필요는 없음. |

## 3. GitHub 및 버전의 정확한 상태

### 3.1 참조

- Origin: `https://github.com/oil123212-jpg/Test.git`
- GitHub 기본 브랜치: `main`
- `main`: `921e1d739615056a92a7f930244b3636860bb74d`
- `release/web-v0.2.0`: 같은 SHA. 두 브랜치에 최신 UI/동의 변경까지 푸시하고 `git ls-remote`로 확인했다.
- `gh-pages`: `5ee717f25a01455143337b561773db9107387537`. **과거 정적 빌드이며 최신 UI가 아니다. Railway 배포에 사용하지 않는다.**
- `v0.1.0` 태그의 대상 소스 커밋: `e5f1bb75900e56afde7f2e0869b90dc2ed1db491`.
- `v0.2.0` 태그의 대상 소스 커밋: `440ecc832b644449c9f5d234717b2d4a8fa0c837`.
- 태그는 재지정하지 않았다. **태그 v0.2.0은 현재 main보다 오래되며 Railway/최신 동의 UI가 모두 들어 있지 않다. 최신 작업에는 main을 사용한다.**
- package.json과 화면 버전은 현재도 0.2.0/v0.2다. 기능 수정마다 새 버전 태그를 만들지는 않았다.
- GitHub Releases API로 릴리스 객체/릴리스 첨부 파일을 생성한 적 없다. 태그 생성과 GitHub Release 생성은 구분한다.
- 작업 파일은 인계 문서 생성 전 깨끗했다. 이번 파일은 ignored `artifacts/`에 생성해 소스 커밋을 바꾸지 않는다.

### 3.2 주요 커밋

| 커밋 | 내용 |
|---|---|
| e5f1bb7 | Python 기반 + 초기 웹 v0.1.0 기준 보존 |
| 440ecc8 | 웹 v0.2.0, GitHub Pages 경로 지원/배포 도구 |
| 39ad4be | main에 선택 버전 Pages 수동 워크플로 등록 |
| a56b47c | 저장소 공개 전환 없는 무료 정적 호스팅 안내 |
| fc12e92 | Railway Docker/Node 서버/healthcheck 추가 |
| 0fc2a42 | 로컬 인증서 신뢰용 선택적 secret 마운트 추가 — 이후 Railway 미지원으로 제거됨 |
| 42d2a12 | 최신 웹/Railway 버전을 main으로 병합 |
| 36f0b32 | main을 Railway 배포 브랜치로 안내 |
| 3e82400 | Railway가 거부한 secret 마운트 제거 |
| 921e1d7 | 두 카탈로그 삭제 + 체험 로그인 동의 팝업 + 회귀 테스트 |

### 3.3 Git 인증/추적 주의

- 이 환경에서 플랫폼 HTTPS Git 프록시를 통한 native Git 읽기·push가 실제로 성공했다. 토큰이 안 보인다는 이유로 새 GitHub 토큰을 요구하면 안 된다.
- `gh api`와 일반 HTTPS로 `api.github.com` 접근은 네트워크 프록시 단계에서 `Tunnel connection failed: 403 Forbidden`으로 막혔다. 이는 Git push 실패나 GitHub 저장소 권한 없음의 증거가 아니다.
- `oil123212-jpg.github.io`도 같은 터널 접근 차단이 관찰됐다.
- GitHub 저장소 visibility는 API로 확인하지 못했다. 사용자의 Pages 유료 지적과 실제 visibility를 구분한다. 공개/비공개 설정을 무단 변경하지 않는다.
- **remote.origin.fetch가 `+HEAD:refs/remotes/origin/HEAD`다.** 로컬 `origin/main` 표시가 39ad4be로 낡아 있어도 실제 원격 main은 921e1d7이었다. `git branch -avv`의 그 표시만 보고 reset하지 말 것.
- 실제 상태를 확인할 때 예: `git ls-remote origin refs/heads/main`, `git fetch origin main`, `git log -1 FETCH_HEAD`. 사용자 변경을 확인하고 필요한 경우에만 안전하게 병합한다. force push/reset을 하지 않았다.

## 4. 현재 기술 구성 및 파일 지도

### 4.1 주 워크플로: 웹

- Node.js 24 이상. 현재 클라우드: Node v24.19.0, npm 11.9.0.
- 프런트엔드: **TypeScript + Vite**, 일반 HTML/CSS/DOM 코드. React/Vue 등 별도 프레임워크 없음.
- devDependencies: `vite=8.3.5`, `typescript=7.0.2`, `@playwright/test=1.64.1`.
- `web/package-lock.json`으로 npm 설치 고정. 앱 실행 서버에는 별도의 npm 런타임 의존성이 없다.
- 실제 사용자 오디오는 브라우저에서만 수집/처리한다. Python 서버를 호출하지 않는다.
- 웹에 API 키/.env/DB/실제 AI 제공자 연결은 필요 없다.

| 파일 | 역할과 수정 시 주의 |
|---|---|
| `web/index.html` | 한국어 UI, 대시보드/오디오 테스트, 설정·도움말·동의 dialog. 왼쪽 두 삭제 메뉴를 복원하지 말 것. |
| `web/src/main.ts` | DOM 이벤트, 오디오 작업 상태, 캔버스, 체험 동의, 라우트, 종료 정리. |
| `web/src/audio-engine.ts` | getUserMedia, 장치 목록, AudioWorklet 수집, OfflineAudioContext 리샘플링, 재생/취소. |
| `web/src/audio-utils.ts` | PCM16, RMS/peak/clipping, 합성 5초 음원, 파형, wipe. |
| `web/public/capture-worklet.js` | 채널 평균→모노, 정해진 프레임 수만 전달. 출력은 무음. 블록 소유권을 탭으로 transfer하고 processor에 음성 버퍼를 남기지 않음. |
| `web/src/style.css`, `tokens.css` | 크림/세이지 톤 반응형 UI. 오래된 페이지 전용 스타일은 제거했다. |
| `web/src/icons.ts` | 자체 인라인 SVG 아이콘. 삭제한 checklist 아이콘 항목도 제거했다. |
| `web/scripts/serve.mjs` | Railway용 프로덕션 정적 HTTP 서버. PORT, health, 보안 헤더, 경로 검증. |
| `web/scripts/test-railway.mjs` | 실제 배포용 Node 서버를 사용하는 Playwright 실행 래퍼. |
| `web/playwright.config.ts` | desktop/mobile Chromium, 테스트용 가상 미디어, 포트 4173. |
| `web/tests/playground.spec.ts` | UI/오디오/동의/삭제 라우트 회귀 테스트. |
| `web/tests/audio-utils.spec.ts` | PCM16 경계, RMS/clipping, 데모/버퍼 wipe. |
| `web/tests/capture-worklet.spec.ts` | 모노 믹스, 프레임 제한, transfer, 무음 출력. |
| `web/tests/server.test.mjs` | Node test runner의 HTTP 서버 테스트 7개. |
| `Dockerfile` | 저장소 루트 컨텍스트의 Railway 다단계 빌드. |
| `railway.json` | Dockerfile builder, `/health`, timeout/restart 설정. |
| `.dockerignore` | Git/가상환경/node_modules/dist/결과물/.env 제외. |

### 4.2 남아 있는 문서

- `README.md`: 현재 주 배포 플랫폼 Railway, main 기준.
- `web/README.md`: 실행/오디오/동의/검증/배포. 정적 호스팅/Pages 설명은 과거 대안 참고도 포함.
- `docs/railway_deployment.md`: 현재 실제 배포 절차와 실패 수정 근거.
- `docs/web_transition.md`: 물리 기기→웹 설계, Phase 1 서버 구조 제안.
- `docs/releases/v0.2.0.md`: 당시 Pages 버전 기록. 현재 배포의 우선 지침으로 쓰지 않는다.
- `docs/free_hosting.md`: 앞서 안내했던 Netlify 대안의 과거 문서. 현재 요청 플랫폼은 Railway다.
- `ai_friend/docs/phase1_readiness_review.md`: 제공자/법률/동의/인증 사전 검토. 앞부분 웹 전환 주석을 읽을 것.
- `ai_friend/docs/privacy_policy_design.md`: 개인정보 설계 초안, 법률 준수 확인 문서가 아님.
- `ai_friend/docs/file_manifest.md`: 프로젝트 파일 목록.

## 5. 최신 UI/동의 기능 — 정확한 동작 계약

### 5.1 제거한 내용

- 좌측 `개인정보 보호`, `준비 체크리스트` nav 항목.
- `#privacy-view`, `#checklist-view` 전체 DOM.
- 하단 개인정보/다음 준비 연결 카드와 관련 링크 전체.
- 체크 개수, 체크박스 이벤트, 삭제된 DOM을 참조하던 reset/route 코드.
- 그 페이지 전용 CSS와 사용하지 않는 checklist 아이콘.
- 제품 UI에 `#privacy`, `#checklist` 진입 링크를 남기지 않았다.

현재 왼쪽 nav는 **대시보드 / 오디오 테스트** 둘뿐이다. 단순 개인정보 안내 문구(음성 저장 안 함 등)나 오디오 안전 기능은 남아 있다.

### 5.2 옛 주소/라우팅

- 해시 `#overview`, `#audio`만 사용한다.
- `#audio`는 같은 대시보드의 오디오 섹션으로 이동한다.
- `#privacy`, `#checklist` 및 알 수 없는 해시는 현재 path/query를 보존하고 `history.replaceState`로 `#overview`로 바꾼다.
- 삭제된 페이지/DOM을 찾다가 초기 JS가 중단되는 오류를 방지했다.

### 5.3 체험 로그인과 동의

- 상단 `#login-button`: 미동의 상태에서는 **체험 로그인**.
- 클릭하면 `#consent-dialog`가 열린다. 페이지 로드만으로 자동 팝업/마이크 요청을 하지 않는다.
- 실제 마이크 녹음/권한 확인을 미동의 상태에서 눌러도 먼저 동의 팝업만 열린다. getUserMedia는 호출하지 않는다.
- 필수 `#consent-checkbox`는 항상 기본 미선택. 선택 전 `#consent-accept`는 disabled.
- form submit에서도 체크를 재검증한다.
- 팝업은 처리 데이터/목적, 탭 메모리 보관, 삭제 시점, 외부 음성 전송 없음, 거부 시 제한을 안내한다.
- **동의하고 체험 시작**을 누르면 JS 메모리의 `localAudioConsent=true`만 설정한다. 계정 정보·비밀번호·토큰을 수집하지 않는다.
- **동의만으로 녹음/재생을 자동 시작하지 않는다.** 실제 마이크 테스트를 다시 직접 눌러야 한다.
- 동의 후 상단 버튼은 **이용 종료**다. 클릭하면 동의를 철회하고 작업/버퍼/장치 정보/음량을 정리한다.
- 거부, 닫기(X), Escape는 미동의 상태로 돌아가며 마이크 사용을 허용하지 않는다.
- 거부해도 합성 데모는 사용할 수 있다.
- 닫았다 다시 열면 체크는 다시 미선택이다.
- 동의를 cookie/localStorage/sessionStorage/IndexedDB/파일/서버에 저장하지 않는다.
- 새로고침/페이지 종료 후 동의는 유지되지 않는다.
- `visibilitychange`로 탭이 숨겨질 때는 음성 버퍼/작업만 정리한다. 같은 탭의 동의 상태는 그 이벤트만으로 철회하지 않는다.
- `pagehide`는 팝업을 닫고 `endSession()`으로 음성과 동의까지 초기화한다.
- 오디오 설정의 **임시 음성 및 설정 초기화**는 오디오·장치·음량을 정리한다. 동의 철회는 **이용 종료**의 역할이다.

**중요:** 체험 로그인은 실제 계정 인증/법정대리인 확인이 아니다. 이 로컬 동의 플래그를 Python의 검증된 보호자 `ConsentState.GRANTED`, 서버 인증, 아동 데이터의 외부 전송 허가로 연결하지 않았다. 팝업에서도 그 차이를 안내한다. 실제 계정 인증은 사용자가 이번 범위에서 제외하도록 선택했다.

## 6. 브라우저 오디오 구현 상세

- 기본 5초, 목표 **24,000 Hz / mono / PCM16**. 결과는 120,000 프레임.
- 데모는 브라우저에서 계산한 5초 합성 신호다. AI 생성 응답/실제 녹음인 것처럼 표시하지 않는다.
- 장치 권한 확인은 getUserMedia 후 enumerateDevices를 하고 트랙을 닫는다. 그 동작을 녹음 성공으로 취급하지 않는다.
- 녹음은 실제 AudioContext 샘플레이트로 AudioWorklet에서 수집한다.
- processor가 채널 평균을 구하고 정해진 프레임만 전송한다. 출력 버퍼에 입력을 쓰지 않으므로 실시간 마이크 루프백이 없다.
- 수집 후 마이크/노드를 닫고 OfflineAudioContext로 정확한 길이의 24kHz PCM16을 만든다.
- float -1은 -32768, +1은 32767, 범위를 넘으면 clamp한다. NaN/무한 입력은 거부한다.
- 입력 중 peak/RMS/clipping 상태를 측정하고 UI를 약 25회/초로 갱신한다. 최종 RMS/peak는 수집 데이터 기준이다.
- 실제 재생은 다시 듣기 버튼의 명시적 클릭 후에만 수행한다.
- 기본 디지털 진폭 0.1, 설정 최대 0.2. 이것은 실제 음압 제한이 아니다. 기기 볼륨도 낮춰 수동 청취해야 한다.
- 스피커 테스트는 1초 440Hz와 짧은 fade다.
- setSinkId 기능 탐지 후 출력 장치 선택을 활성화한다. 미지원 브라우저는 OS 기본 출력 사용.
- secure context/HTTPS와 AudioWorklet/Web Audio가 필요하다. `file://`나 일반 원격 HTTP를 정상 배포 방식으로 안내하지 않는다.
- `AbortController`와 앱 `operationId`로 취소/로그아웃 후 늦은 getUserMedia/재생 준비 결과를 폐기한다.
- 재생 준비의 resume/setSinkId 대기 중 취소해도 뒤늦게 소리가 켜지지 않도록 처리했다.
- `finally`에서 앱 소유 배열·렌더 버퍼·트랙·컨텍스트를 정리한다. 앱 밖의 브라우저/OS/드라이버/스왑 복사본까지 물리 삭제를 보장하지 않는다.
- 실제 마이크가 없는 클라우드에서도 합성 데모와 가상 마이크 테스트는 가능하다. 그것을 실제 하드웨어 음질 검증으로 표시하지 않는다.

## 7. Railway 배포 — 현재 설정과 확인해야 할 점

### 7.1 서비스에 사용할 값

| 항목 | 값 |
|---|---|
| GitHub repository | oil123212-jpg/Test |
| Branch | **main** |
| Root Directory | **/** (저장소 루트) |
| Builder | Dockerfile |
| Dockerfile path | Dockerfile |
| Healthcheck path | /health |
| Healthcheck timeout | 60초 |
| Restart | ON_FAILURE, 최대 3회 |
| 서버 listen | 0.0.0.0 + `PORT` 환경변수, 미설정 시 3000 |
| 실행 CMD | node scripts/serve.mjs (Docker runtime /app 내부 경로) |

루트 컨텍스트를 전제로 Dockerfile의 `COPY web/...`가 작성됐다. Root Directory를 `/web`으로 바꾸면 이 Dockerfile의 COPY 경로가 맞지 않는다. 기존 Railway Build/Start Command override가 있다면 Dockerfile CMD와 충돌하지 않는지 확인한다.

`EXPOSE 3000`은 실제 listen 포트를 강제하지 않는다. 앱은 Railway가 제공한 PORT를 사용한다. 도메인의 Target Port가 필요하면 실제 PORT와 같아야 한다. 고정하려면 `PORT=3000`과 Target Port=3000을 함께 설정한다.

Railway의 Public Networking에서 Generate Domain으로 HTTPS 주소를 생성하거나 기존 도메인을 사용한다. **실제 서비스 URL은 아직 사용자로부터 받지 못했다.** URL 없이 특정 도메인을 만들어내거나 접속 성공을 주장하지 말 것.

### 7.2 현재 Dockerfile의 구조

1. `node:24-bookworm-slim` build stage.
2. web package/lock 복사 → **일반 `RUN npm ci`**.
3. index/tsconfig/vite config/src/public 복사 → npm run build.
4. 같은 Node 이미지 runtime stage에 dist, 서버 스크립트, package.json만 복사.
5. `USER node`로 실행. 런타임 node_modules나 Python이 필요하지 않다.
6. credential/환경 파일/개발 산출물은 이미지에 복사하지 않는다.

### 7.3 실제 발생했던 Railway 실패와 수정

사용자가 제공한 Railway 스크린샷은 `Deployment failed during build process` / `The Dockerfile failed validation`이었다. 이어 제공한 **정확한 로그**:

```text
dockerfile invalid: flag '--mount=type=secret,id=build_ca' is missing a type=cache argument (other mount types are not supported) at Line 4
```

배경:

- 클라우드 내부에서 기본 Node Docker 이미지의 npm ci를 실행하면, 환경의 TLS 중계 CA를 모르는 탓에 `SELF_SIGNED_CERT_IN_CHAIN`이 발생했다.
- 로컬 테스트를 위해 host OS 신뢰 묶음을 BuildKit secret으로 주입했고, TLS 검증을 켠 채 Docker 빌드/비관리자 실행/health 200을 확인했다.
- 그 선택적 secret 구문을 배포 Dockerfile에도 넣은 것이 Railway와 호환되지 않았다. 일반 Docker 성공만으로 Railway 빌더 호환성을 검증했다고 볼 수 없었다.
- **3e82400에서 해당 RUN 마운트 전체를 제거하고 `RUN npm ci`로 교체**했다. main/release 양쪽을 갱신했다.
- 수정 후 `docker build --check`는 경고 없이 통과했다. 수정 후 실제 Railway 재배포 결과는 전달받지 못했다.

후속 조치:

- 배포 Dockerfile에 `--mount=type=secret`를 다시 넣지 않는다. 이 Railway 빌더는 제공된 로그 기준으로 cache 외 mount 타입을 거부한다.
- `npm strict-ssl=false`, `NODE_TLS_REJECT_UNAUTHORIZED=0` 등의 TLS 우회로 해결하지 않는다. 체크섬/서명 검증도 끄지 않는다.
- 이 클라우드의 사설 CA 때문에 로컬 이미지 검증이 필요하면 **배포 파일과 분리된 임시 Dockerfile/지원 trust 설정**으로 시험하고, 그 환경용 마운트를 생산 Dockerfile로 다시 커밋하지 않는다.
- 실패했던 옛 배포를 같은 소스로 반복하기보다 Railway 배포 화면의 **소스 커밋**이 최신 main인지 먼저 확인한다.

### 7.4 Node 정적 서버의 계약

- `GET /health` → 200, `{"status":"ok"}`. health는 no-store.
- GET/HEAD 정적 파일만 제공. POST 등 업로드 메서드는 405.
- dist 바깥 경로, 숨김 경로, 외부를 가리키는 symlink를 거부한다. 잘못된 URL 인코딩은 400.
- HTML/JS/CSS/SVG/JSON 등 MIME을 설정한다. 특히 worklet JS가 정상 MIME이어야 한다.
- 해시된 `/assets/` 파일은 immutable 캐시. HTML/worklet 등은 no-cache.
- CSP, Permissions-Policy, Referrer-Policy, nosniff 적용. 현재 connect-src는 self라 미래 외부 연결 추가 때 별도 검토가 필요하다.
- 음성 업로드/로그인 API/WebSocket relay는 없다. 시작 포트 외 요청 본문/토큰/음성 로그를 남기지 않는다.
- SIGTERM/SIGINT에서 종료 정리. runtime은 비관리자 사용자.

## 8. 설치·실행·테스트 명령

### 8.1 웹 로컬 개발

```bash
cd /workspace/Test/web
npm ci
npm run dev
```

개발 서버 기본 포트 5173. 다른 경로에 clone했다면 `/workspace/Test`를 실제 경로로 바꾼다.

### 8.2 생산 서버

```bash
cd /workspace/Test/web
npm run build
npm start
```

기본 포트 3000, 배포 시 PORT 환경변수 우선. 실제 마이크는 원격 HTTPS 주소에서 확인한다.

### 8.3 의미 있는 검증

```bash
cd /workspace/Test/web
npm run test:server
npm run test:railway
```

- test:server: Node 내장 test runner 7개.
- test:railway: TypeScript/배포 빌드 후 PORT=4173의 **Node 생산 서버**를 임시로 시작하고 Playwright 46개, 끝나면 그 서버 정리.
- 테스트가 4173을 사용하므로 이미 켜 둔 preview와 충돌하지 않게 한다. 남의 프로세스를 임의 종료하지 않는다.
- 일반 `npm test`는 Vite preview를 쓰는 기존 브라우저 테스트 경로다.
- 이 클라우드에서는 `/usr/bin/chromium`이 있으면 그 실행 파일을 사용한다. 없으면 `npx playwright install chromium`, 시스템 의존성이 필요하면 관리 가능한 환경에서 install --with-deps를 사용한다.
- desktop 1440×1100, mobile Pixel 7 설정 모두 Chromium이다. mobile 설정은 Safari/iPhone 실물 검증이 아니다.
- 가상 미디어 및 no-sandbox 플래그는 테스트 브라우저용이며 제품 사용자의 브라우저 설정을 바꾸지 않는다.

### 8.4 legacy Python 확인이 정말 필요한 경우만

```bash
cd /workspace/Test
source scripts/activate_cloud.sh
cd ai_friend
python -m pytest -q
```

`activate_cloud.sh`는 Python venv와 로컬 PortAudio 라이브러리 경로를 설정하는 **legacy용**이다. 웹 실행에는 필요 없다. 설치는 scripts/setup_python.sh, 웹 중심 자동 설치는 scripts/setup_cloud.sh다. 웹 테스트를 위해 PortAudio/Pi를 설치하지 말 것.

### 8.5 과거 Pages 도구

`npm run build:pages`, `npm run test:pages`는 `/Test/` 경로를 위한 과거 배포 도구다. Railway에는 일반 루트 경로 빌드를 사용한다. `scripts/publish_pages.py`와 `.github/workflows/pages.yml`도 남아 있지만 현재 플랫폼 선택과 혼동하지 않는다.

## 9. 검증 근거와 한계

| 검증 | 확인된 결과 | 한계 |
|---|---|---|
| 최신 TS/웹 생산 빌드 | 통과 | 실 서비스의 배포/도메인 활성화를 뜻하지 않음 |
| 최신 Node 서버 단위 테스트 | 7 passed | Railway 계정/네트워크 설정은 검증하지 않음 |
| 최신 브라우저 회귀 테스트 | 46 passed, 실패/skip 없음 | 23개 사례 × desktop/mobile Chromium. 4개씩은 순수 변환/worklet 단위 테스트이며 전부 실제 브라우저 조작 테스트라는 뜻은 아님 |
| 최신 합계 | 53 passed | Python 테스트와 중복 합산하지 않음 |
| 이전 Python 기반 | 61 passed, hardware 3 deselected | 2026-10-13의 legacy 검증. 실제 마이크/스피커/Pi/Windows 물리 검증 미실행 |
| 과거 Docker full build/run | 사설 CA를 로컬 secret으로 주입한 상태에서 성공, 비관리자 runtime에서 health/HTML/worklet 각 200 | 그 Dockerfile의 secret 구문이 Railway에서는 거부됨. 최신 수정/UI 버전의 똑같은 파일로 full image를 재빌드했다고 주장하지 말 것 |
| corrected Dockerfile | docker build --check 경고 없이 통과 | Railway 자체 validation/최신 deployment 성공을 직접 확인한 것은 아님 |
| GitHub push | main/release SHA를 원격 read로 확인 | GitHub Actions 원격 실행 결과/Release 객체/공개 웹 사이트 확인은 아님 |
| 실제 Safari/iOS/Firefox 및 실물 장치 | 미검증 | 후속 대상 기기에서 확인 필요 |
| 실제 Realtime API/보호자 인증/법적 검토 | 미구현 또는 미확인 | 스텁/문서/체크박스를 실제 완료로 표시하지 말 것 |

최근 Playwright `web/test-results/.last-run.json`은 `status: passed`, failedTests는 빈 배열이다. 콘솔에서 실제 46개 완료도 확인했다. 이번 인계 문서 작성에서는 앱 코드를 바꾸지 않았으므로 테스트를 다시 실행하지 않았다.

주요 회귀 테스트 범위:

- 기본 로드에서 마이크 요청/자동 재생 0건, 가로 overflow 없음.
- 데모에 권한 불필요, 직접 재생/중단/지우기, 외부 업로드/저장소 미사용.
- 실제 Web Audio/AudioWorklet 경로를 가상 마이크로 5초 수집하고 120,000 프레임으로 변환.
- 권한 확인만 한 뒤 트랙 종료, 캡처 중 취소/재시작, 권한 거부, 늦게 도착하는 권한 결과 정리.
- 재생 준비 중 취소 시 뒤늦은 소리 없음.
- 개인정보/체크리스트 메뉴·링크·페이지 DOM 부재, 옛 URL 안전한 대시보드 복귀.
- 설정의 reset action이 페이지 제거 후에도 동작.
- 동의 미선택 기본값/취소/Escape/닫기/거부/재진입, 동의 없는 마이크 호출 0건.
- 동의 후 자동 녹음 없음, 브라우저 저장소 미사용, 새로고침 동의 초기화.
- 이용 종료가 진행 중 캡처와 늦은 권한 결과를 정리함.
- 모바일 dialog와 키보드 조작.

## 10. 기존 Python 구현 — 삭제하지 않고 보존한 기반

초기 구현은 ai_friend/이며 Python 3.11 이상을 대상으로 한다. 현재 클라우드 Python은 3.12.14였다.

주요 의존성:

- numpy 2.2.6
- scipy 1.15.3
- sounddevice 0.5.2
- python-dotenv 1.1.0
- pytest 8.3.5 (개발)

기능:

- config.py: .env + 프로세스 env, 타입/범위 검증, 모델/서버 미설정으로 오디오 실패하지 않음.
- audio/: 장치 조회/선택, 지원 주파수 검사, scipy resample_poly, PCM16/모노, RMS/peak/clipping, 제한 출력, 중단/버퍼 정리.
- audio/streams.py: **start 실패도 포함**해 stop 또는 abort 후 close하도록 보장. 일반 with만으로 start 예외를 놓치는 문제를 수정했다.
- realtime/base_client.py: connect/disconnect/send_audio/receive_events/cancel_response/get_connection_state 추상 계약.
- realtime/auth_interface.py: AuthProvider acquire/refresh/revoke, DeviceIdentity/AuthState, ConnectionGrant 만료 검사. 실제 서버 없음.
- safety/consent.py: NOT_REQUESTED/PENDING/GRANTED/REVOKED. UnverifiedConsent는 진짜 승인 상태를 만들 수 없음.
- safety/privacy.py: 기본 저장 비활성, 외부 전송은 Phase 0에서 항상 차단. 로컬 앱 전용 데이터 삭제 함수는 symlink/미지원 파일/중첩 디렉터리 거부.
- infrastructure/: 공통 예외, 개인정보 없는 시스템 정보, 이벤트/숫자/오류 유형 allowlist logger. 1MB + 백업 3개.
- main.py: --help/--devices/--test-microphone/--test-speaker/--test-audio/--system-info. 장치 조회가 녹음이나 API 연결을 일으키지 않음.

CLI integrated test는 녹음 뒤 사용자가 PLAY를 입력해야 재생한다. 웹 테스트와 별개로 유지한다.

초기 클라우드에는 PortAudio가 없었고 /dev/snd도 없었다. 관리 권한 없이 Debian 서명·체크섬 검증을 유지해 `/workspace/portaudio-runtime`에 라이브러리를 풀어 사용했다. 실제 장치 수 0을 확인했다. 이 작업은 웹 전환 후 필수 설치가 아니다.

Python 환경변수 기본값:

```env
APP_ENV=development
LOG_LEVEL=INFO
AUDIO_SAMPLE_RATE=24000
AUDIO_CHANNELS=1
AUDIO_INPUT_DEVICE=
AUDIO_OUTPUT_DEVICE=
AI_PROVIDER=openai
OPENAI_REALTIME_MODEL=
GEMINI_LIVE_MODEL=
AUTH_SERVER_URL=
DEVICE_ID=
ENABLE_AUDIO_STORAGE=false
ENABLE_TRANSCRIPT_STORAGE=false
```

실제 키나 식별자를 예제/문서/소스에 넣지 않았다. 웹은 이 Python .env를 자동으로 읽지 않는다.

## 11. 개인정보/안전/Phase 1 검토의 현재 경계

1. 실제 AI 연결을 한 적 없다. 모델 ID를 검증해 확정한 적도 없다.
2. OpenAI/Gemini 정책과 만 3~6세 이용·데이터 처리 조건은 별도 확인 대상이다. 최신 제공자 문서 접속이 실패한 적 있으므로 과거 문서 작성만으로 최신 약관 충족을 주장하지 않는다.
3. 보호자 동의만으로 외부 AI 전송이 자동 허용되는 설계가 아니다. 제공자 요구와 국내 적용 요건을 함께 확인해야 한다.
4. 계정 로그인과 법정대리인 확인은 서로 다르다. 이번 UI 체크박스는 둘 다 수행하지 않는다.
5. 실제 아동 데이터 대신 성인 개발자/합성 음원으로 개발·진단하는 경계를 유지한다.
6. 음성/전사문 기본 저장 금지, 원본/토큰/이름/전화번호 등을 로그에 넣지 않는다.
7. 장기 제공자 키를 브라우저나 VITE_*에 넣지 않는다. 브라우저 번들은 공개 파일이다.
8. 향후 권장 제안은 **웹 → Python 인증·중계 서버 → Realtime 제공자**이며 아직 구현하지 않았다. 자체 중계 서버도 음성을 처리한다는 개인정보 검토가 필요하다.
9. 미래 서버에는 보호자 계정/검증 동의·철회, 세션/권한/Origin/CSRF, 취소/재연결, 비용 상한/오류 제한이 필요하다.
10. 외부 전송을 켜는 작업은 새 명확한 Phase 1 범위와 검토 결과 없이 Phase 0 UI 수정에 섞지 않는다.
11. 로깅 크기 제한은 기간 기반 보관 제한을 대신하지 않으며 서버/백업/제공자 삭제는 현재 로컬 삭제 함수만으로 해결하지 못한다.

## 12. 환경/인증/도구 및 재현 주의

- 이 클라우드 파일은 /workspace와 /tmp에서 수정 가능. 실제 경로는 세션에 따라 달라질 수 있으니 시작 시 확인한다.
- 기존 checkout을 사용했고 별도 git worktree는 만들지 않았다. 인계 때문에 새 worktree를 자동 생성할 필요가 없다.
- 초기 cloud-environment-onboarding:setup 스킬을 사용했다. 스킬/온보딩 문서는 환경 설치와 리뷰 절차를 위한 것이고, 이후 사용자 명시 코딩 요청에 따라 앱 파일을 구현/수정했다.
- 원본 .env나 credential 값을 덤프/문서에 복사하지 않았다. 토큰의 이름/존재 여부만 확인했다. 이 인계 파일에도 credential 값은 없다.
- 마지막 확인 당시 Railway CLI/계정/프로젝트 인증 연결이 없었다. Railway 토큰/프로젝트 ID/서비스 ID를 만들어내지 말 것.
- Netlify/Cloudflare/Vercel 인증도 확인 당시 없었고, 그 서비스를 실제 배포하지 않았다. 현재 플랫폼이 Railway이므로 새 플랫폼 인증을 먼저 요구하지 않는다.
- Native Git 접근이 되는 것과 GitHub API/CLI 권한·외부 도메인 접근이 되는 것은 다르다.
- 이 클라우드의 Docker builder 작업 폴더가 기본 /home/agent/.docker/buildx에서는 읽기 전용이라 실패했다. 로컬 Docker 점검 시 `BUILDX_CONFIG=/tmp/momo-buildx`를 사용했다.
- 사설 TLS 중계가 있는 이 클라우드의 Docker 내부 npm trust 실패를 Railway 프로덕션의 npm 실패와 혼동하지 말 것. 신뢰 설정은 환경별로 분리한다.
- 실제 사용자 서비스의 URL/로그가 없으면 GitHub 수정, 로컬 테스트, Railway 실제 배포 성공을 구분해서 보고한다.

### 12.1 저장된 클라우드 환경 설정

환경 설정 draft에는 웹용 install_script와 start_skill을 저장했다. 저장은 실행/공개 게시와 다르며, 사용자가 환경 설정에서 저장/게시했는지는 확인하지 않았다.

- install_script는 scripts/setup_cloud.sh와 같은 웹 설치/빌드/기본 브라우저 검증 흐름.
- start_skill은 /workspace/Test/web에서 npm run dev, 내부 readiness 확인, npm test를 안내.
- **start_skill의 일부 설명에는 과거 “in-memory checklist”가 아직 남아 있다.** 현재 소스와 최신 사용자 삭제 요구가 우선이며 그 문구를 근거로 체크리스트를 복구하면 안 된다.
- 이번 인계에서는 환경 draft를 수정하거나 게시하지 않았다.
- 서비스 프로세스는 스냅샷/새 런타임에 살아있다고 가정하지 않는다.

### 12.2 CI 정의와 실제 실행 구분

- `.github/workflows/web.yml`: Node 24, npm ci, Chromium 설치, build, server 테스트, Railway 서버 브라우저 테스트.
- `.github/workflows/tests.yml`: 기존 Python, Ubuntu/Windows × 3.11/3.12.
- `.github/workflows/pages.yml`: 과거 선택 버전 GitHub Pages 수동 실행. 기본 입력 v0.2.0은 최신 코드가 아니다.
- 정의 파일은 GitHub에 올라갔지만 API 제한으로 각 원격 Actions 결과는 확인하지 못했다. 로컬 53개 통과를 원격 CI 성공으로 표현하지 않는다.

## 13. 남은 일과 후속 에이전트의 권장 시작 절차

### 현재 사용자 요청을 이어받을 때

현재 요청은 **인계 파일 전달**이므로 추가 개발이나 배포 플랫폼 변경을 먼저 시작하지 않는다. 이 문서와 소스 bundle을 전달하면 된다.

### 이후 사이트 접속/배포 문제를 계속 요청받으면

1. 사용자 최신 요청과 main의 실제 원격 SHA를 확인한다. 필요 시 변경을 보존하고 최신 source를 가져온다.
2. Railway 서비스의 **현재 공개 URL**과 **최신 배포 소스 커밋/상태**를 확인한다. URL을 아직 받은 적 없으므로 실제 화면 검증에 필요하다.
3. build failure면 로그의 첫 실제 실패 명령과 해당 커밋을 확인한다. 이미 해결한 secret 오류가 보이면 옛 배포/캐시 소스인지 우선 확인한다.
4. service root `/`, Dockerfile 선택, 사용자 override, PORT/Target Port, `/health`와 domain 설정을 점검한다.
5. 접속할 수 있으면 `/health`, HTML/asset/worklet MIME, 로그인 동의/거부, 마이크/수동 재생을 실제 HTTPS에서 확인한다.
6. 계정 권한이나 네트워크 정책이 막으면 영향을 받지 않는 코드/검증부터 완료하고 구체적인 외부 조치만 요청한다. secret 값을 채팅에 요구하지 않는다.
7. 수정했다면 필요한 테스트를 실행하고 실패 이유를 진단한 뒤 사용자 승인 범위의 GitHub 반영을 한다. 스크린샷의 운영 성공을 보지 않았는데 “배포 완료”라고 쓰지 않는다.

### 다음 기능 개발 시 지킬 불변 조건

- 왼쪽 두 삭제 메뉴/카드/페이지/링크 복구 금지(새 명시 요청이 있을 때만 변경).
- 체험 로그인 범위를 진짜 사용자 인증이나 법정대리인 승인처럼 표시하지 않음.
- 동의 기본 미선택, 동의만으로 녹음/재생 자동 시작 없음.
- 동의 전 실제 마이크 요청 없음. 거부 시 합성 데모는 계속 가능.
- 이용 종료/취소 후 늦은 권한/재생 결과가 되살아나지 않음.
- 별도 저장/외부 전송을 암묵적으로 추가하지 않음.
- Railway Dockerfile에 unsupported secret mount를 재도입하지 않음.
- 기존 태그나 사용자의 작업을 force/reset/삭제로 덮어쓰지 않음.

## 14. 다운로드 산출물과 전달 방법

이 작업 환경의 주요 산출물:

- `artifacts/momo-web-v0.2.0-railway.zip`: 최신 추적 소스 전체, 루트 Dockerfile/railway.json 포함. unzip한 momo-web-railway 폴더를 프로젝트 루트로 사용.
- `artifacts/momo-desktop-chromium.png`: 최신 좌측 두 메뉴가 제거된 대시보드 스크린샷.
- `artifacts/momo-mobile-chromium.png`: 최신 모바일 대시보드.
- `artifacts/momo-mobile-consent.png`: 최신 동의 팝업 모바일 화면.
- `artifacts/momo-web-static.zip`, `momo-web-v0.2.0-netlify.zip`: **이전 정적 배포용 파일, 현재 Railway 소스 패키지가 아님**. 최신 Railway 작업에 사용하지 않음.
- 현재 인계 파일과 전체 bundle도 artifacts/에 생성한다. artifacts는 Git에서 제외되어 있어 파일 다운로드 방식으로 전달한다.

GitHub archive는 main의 최신 소스를 받을 수 있으나 저장소 접근 권한이 필요할 수 있다. 이 파일과 함께 제공한 source/ 폴더는 Git 메타데이터·node_modules·venv·음성·secret 없이 추적 소스만 포함한다. Git 이력/태그 확인은 권한이 있는 GitHub 저장소에서 한다.

## 15. 최초 요구사항 원문의 해석 우선순위

다음 부록 A는 사용자가 직접 올린 최초 Phase 0 요구사항 전문이다. 원문 파일명은 “붙여넣은 텍스트.txt”, 약 13.6KB였다. 처음에는 Python/Pi 기반을 요구했지만 이후 웹/Railway/메뉴 삭제/체험 동의로 변경됐다.

- 원문의 **Phase 0 범위와 개인정보/검증 원칙**은 계속 중요한 기준이다.
- **물리 기기 필수, Pi 우선 실행, Python만으로 제품 UI 구성**은 최신 웹 전환 요구로 대체됐다.
- **준비 체크리스트를 웹 카탈로그로 제공**하던 초기 웹 설계는 최신 명시 삭제 요청으로 폐기됐다.
- 이번 체험 동의 UI는 원문에서 요구한 실제 법정대리인 확인을 구현한 것이 아니며 그 경계를 유지한다.

---

## 부록 A. 사용자 최초 요구사항 원문 전체

# Phase 0 — 유아용 AI 친구 디바이스 개발 환경 및 기반 시스템 구축

## 1. 프로젝트 개요

만 3~6세 아동을 대상으로 하는 AI 친구 디바이스의 Phase 0 기반 시스템을 개발한다.

최종적으로 아이가 음성으로 AI와 대화하고, 함께 책을 읽거나 감정을 표현할 수 있는 디바이스를 제작할 예정이다.

전체 개발은 Phase 0~7로 구분하며, 이번 작업에서는 **Phase 0만 구현한다.**

### 기술 스택

- 개발 언어: Python 3.11 이상
- 최종 하드웨어: Raspberry Pi 5 (4GB RAM)
- 개발 환경: Windows PC 및 Raspberry Pi OS
- 실시간 AI: OpenAI Realtime API (Phase 1에서 구현)
- 대체 AI: Google Gemini Live API (향후 확장)
- 통신 방식: WebSocket
- 오디오: sounddevice, numpy
- 로컬 DB: SQLite (Phase 4에서 확장)
- 테스트: pytest
- 설정 관리: 환경변수 및 .env
- 로그: Python logging
- 패키지 관리: pip 및 requirements.txt

설계할 때 특정 플랫폼에 종속되는 코드를 최대한 줄이고 Windows와 Linux에서 실행 가능하도록 구성한다.

## 2. Phase 0 개발 목표

다음 기능을 구현한다.

1. 프로젝트 디렉터리와 Python 실행 환경 구축
2. 마이크 및 스피커 장치 확인
3. 오디오 녹음 및 재생 테스트
4. API 환경변수 및 보안 설정
5. 인증 서버와 연결할 수 있는 인터페이스 설계
6. 아동 개인정보 처리 및 최소 저장 구조
7. 로깅 및 오류 처리
8. 기본 테스트 코드
9. 개발 및 실행 방법 문서화

**중요: 이번 단계에서는 OpenAI Realtime API에 실제 음성 스트림을 전송하지 않는다. AI 응답 생성, 책 읽기, 감정 분석, 장기 대화 기억 기능도 구현하지 않는다.**

## 3. 폴더 구조

아래 구조를 기본으로 생성한다. 필요한 경우 합리적으로 확장할 수 있다.

```text
ai_friend/
├── main.py
├── config.py
├── requirements.txt
├── requirements-dev.txt
├── .env.example
├── .gitignore
├── README.md
│
├── audio/
│   ├── __init__.py
│   ├── devices.py
│   ├── microphone.py
│   ├── speaker.py
│   └── audio_test.py
│
├── realtime/
│   ├── __init__.py
│   ├── base_client.py
│   └── auth_interface.py
│
├── safety/
│   ├── __init__.py
│   ├── privacy.py
│   └── consent.py
│
├── infrastructure/
│   ├── __init__.py
│   ├── logger.py
│   ├── exceptions.py
│   └── platform_info.py
│
├── tests/
│   ├── test_config.py
│   ├── test_audio.py
│   ├── test_privacy.py
│   └── test_auth.py
│
└── docs/
    ├── architecture.md
    ├── privacy_policy_design.md
    ├── device_setup.md
    └── phase0_checklist.md
```

## 4. 오디오 시스템 구현

### 4.1 장치 검색

`audio/devices.py`

- 사용 가능한 입력 및 출력 장치 조회
- 장치 이름, ID, 채널 수, 기본 샘플레이트 출력
- 사용자가 장치 ID를 선택할 수 있도록 구현
- 장치가 없을 때 명확한 오류 표시
- Windows와 Raspberry Pi OS 모두 지원

### 4.2 마이크 테스트

`audio/microphone.py`

- 마이크 입력 테스트
- 기본 테스트 시간 5초
- PCM16 오디오 수집
- 모노 변환 지원
- 샘플레이트 24kHz를 목표로 구성
- 하드웨어가 해당 샘플레이트를 지원하지 않으면 가능한 샘플레이트로 녹음한 뒤 정확하게 리샘플링
- 녹음 중 입력 음량 및 클리핑 여부 측정
- 녹음 중 오류 발생 시 자원 해제

### 4.3 스피커 테스트

`audio/speaker.py`

- 사인파 또는 테스트 음원 재생
- 출력 음량 제한
- 선택한 출력 장치 사용
- 재생 중단 기능
- 출력 장치 오류 처리

### 4.4 오디오 통합 테스트

`audio/audio_test.py`

- 마이크로 5초 녹음
- 녹음 완료 후 사용자가 명시적으로 재생을 요청하면 스피커로 재생
- 기본적으로 음성 파일을 디스크에 저장하지 않음
- 녹음 데이터는 메모리에서 일시적으로 처리
- 테스트 종료 후 버퍼 정리
- 마이크 입력을 스피커로 실시간 출력하지 않음

이번 단계에서는 에코 제거 및 VAD 기능을 구현하지 않는다. 해당 기능은 Phase 2에서 개발한다.

## 5. API 및 환경변수 관리

`config.py`

다음 환경변수를 지원한다.

```env
APP_ENV=development
LOG_LEVEL=INFO

AUDIO_SAMPLE_RATE=24000
AUDIO_CHANNELS=1
AUDIO_INPUT_DEVICE=
AUDIO_OUTPUT_DEVICE=

AI_PROVIDER=openai
OPENAI_REALTIME_MODEL=
GEMINI_LIVE_MODEL=

AUTH_SERVER_URL=
DEVICE_ID=

ENABLE_AUDIO_STORAGE=false
ENABLE_TRANSCRIPT_STORAGE=false
```

- `.env.example`에는 실제 API 키나 개인 식별 정보를 넣지 않는다.
- `.env`는 Git 추적에서 제외한다.
- 환경변수 값을 타입과 범위에 따라 검증한다.
- 설정이 올바르지 않으면 명확한 오류를 반환한다.
- 로그에 API 키나 인증 토큰이 기록되지 않도록 한다.

API 모델명은 Phase 1에서 실제 지원 여부를 확인해 설정하도록 하며, 모델명이 없더라도 Phase 0 오디오 테스트는 실행할 수 있어야 한다.

## 6. AI API 인터페이스 설계

Phase 1에서 OpenAI Realtime API를 구현할 예정이다.

Phase 0에서는 직접 API에 연결하지 않고 추상 인터페이스만 정의한다.

`realtime/base_client.py`

다음 기능을 인터페이스로 정의한다.

- connect()
- disconnect()
- send_audio()
- receive_events()
- cancel_response()
- get_connection_state()

미구현 메서드는 명확하게 NotImplementedError를 발생시키거나 추상 메서드로 선언한다.

실시간 API는 추후 다음과 같이 확장할 수 있어야 한다.

- OpenAIRealtimeClient
- GeminiLiveClient

`realtime/auth_interface.py`

- 인증 서버로부터 단기 연결 권한을 획득하기 위한 추상 인터페이스
- 기기 ID 및 인증 상태 관리용 자료형
- 토큰 만료 시각 처리
- 인증 실패 예외
- 추후 토큰 갱신을 위한 인터페이스

이번 단계에서는 실제 인증 서버를 배포하거나 사용자 인증을 구현하지 않는다.

실제 서비스에서는 장기 API 키를 디바이스에 직접 배포하지 않도록 설계한다.

## 7. 아동 개인정보 보호 설계

이번 프로젝트의 대상은 만 3~6세 아동이다.

개인정보 보호를 기본 설정으로 적용한다.

### 기본 정책

- 원본 음성 저장 비활성화
- 대화 텍스트 저장 비활성화
- 비동의 상태에서는 아동 데이터의 외부 전송 금지
- 보호자 동의 상태를 확인하는 인터페이스 구현
- 사용자 데이터 삭제를 위한 인터페이스 설계
- 디버그 로그에 음성, 전사문, 이름, 전화번호 등의 개인정보를 기록하지 않음

`privacy.py`

다음 기능을 구현한다.

- is_audio_storage_allowed()
- is_transcript_storage_allowed()
- validate_data_processing_permission()
- delete_local_user_data()

`consent.py`

다음 상태를 정의한다.

- NOT_REQUESTED
- PENDING
- GRANTED
- REVOKED

보호자 동의 상태는 임의로 GRANTED로 초기화하지 않는다.

현재 단계에서는 보호자 본인 확인이나 법정대리인 확인을 완료한 것으로 간주하는 가짜 구현을 만들지 않는다.

또한 OpenAI를 포함한 외부 AI 제공자의 아동 데이터 처리 조건을 확인해야 하므로, 법정대리인의 동의만으로 API 전송이 자동 허용되도록 설계하지 않는다.

실제 아동 음성 전송은 서비스 제공자의 요건과 적용 가능한 개인정보 보호 요건을 충족한 후 별도로 활성화한다.

### 개인정보 문서

`docs/privacy_policy_design.md`에 다음 내용을 작성한다.

- 처리하려는 데이터 목록
- 각 데이터의 사용 목적
- 저장 여부 및 예상 보관기간
- 보호자 동의 및 철회 흐름
- 삭제 기능
- 외부 AI 제공자에게 전송되는 데이터
- 상용화 전에 검토해야 하는 국내 개인정보 보호 관련 사항
- 아동 데이터 전송을 금지해야 하는 조건

법률 준수를 검증했다고 주장하지 말고, 실제 확인이 필요한 사항을 명확하게 구분한다.

## 8. 로깅과 오류 처리

`infrastructure/logger.py`

Python logging 기반으로 구현한다.

로그에 포함할 정보:

- 프로그램 시작 및 종료
- 오디오 장치 연결 상태
- 오디오 샘플레이트 및 프레임 수
- 기능 실행 성공 여부
- 오류 유형
- 처리 소요시간

기록하면 안 되는 정보:

- 원본 음성 데이터
- 음성 전사문
- API 키
- 인증 토큰
- 아동의 개인정보

로그 파일 크기 제한과 순환 저장을 지원한다.

`infrastructure/exceptions.py`

다음 사용자 정의 예외를 구현한다.

- AudioDeviceError
- AudioFormatError
- AuthenticationError
- ConfigurationError
- PrivacyPermissionError

프로그램 종료 시 오디오 장치와 관련 리소스가 안전하게 해제되도록 한다.

## 9. 실행 인터페이스

`main.py`는 명령행에서 실행 가능하도록 구현한다.

다음 명령을 지원한다.

```bash
python main.py --help
python main.py --devices
python main.py --test-microphone
python main.py --test-speaker
python main.py --test-audio
python main.py --system-info
```

각 명령은 필요한 기능만 수행하도록 한다.

예를 들어 `--devices` 실행 시 API 연결이나 녹음이 발생하면 안 된다.

프로그램 시작 시 전체 환경을 검증하되, 아직 구현하지 않은 Phase 1 기능 때문에 오디오 테스트가 실패하지 않도록 한다.

## 10. 테스트 코드

pytest 기반 테스트를 작성한다.

테스트 항목:

1. 기본 환경변수 로딩
2. 잘못된 샘플레이트 감지
3. 장치가 없는 경우의 오류 처리
4. 오디오 PCM16 변환
5. 음성 저장 기본 비활성화
6. 비동의 상태에서 데이터 전송 차단
7. 토큰 관련 예외 처리
8. 개인정보가 로그에 기록되지 않는지 확인
9. 프로그램 종료 시 리소스 정리

실제 마이크·스피커가 필요한 테스트와 일반 단위 테스트를 구분한다.

CI 또는 마이크 없는 개발 PC에서도 단위 테스트를 실행할 수 있도록 오디오 장치 접근을 Mocking한다.

## 11. 문서 작성

`README.md`에 다음 내용을 작성한다.

- 프로젝트 개요
- 요구 Python 버전
- Windows 설치 방법
- Raspberry Pi OS 설치 방법
- 가상환경 생성
- 패키지 설치
- 오디오 장치 테스트
- 환경변수 설정
- 테스트 실행 방법
- 주요 폴더 설명
- Phase 1 연결 방법

`docs/architecture.md`에는 전체 모듈 구조와 데이터 흐름을 설명한다.

`docs/phase0_checklist.md`에는 Phase 0 완료 조건과 테스트 결과를 기록할 수 있도록 작성한다.

## 12. 완료 조건

아래 조건을 모두 만족하면 Phase 0가 완료된 것으로 본다.

- Python 프로그램이 정상 실행됨
- 오디오 입출력 장치를 조회할 수 있음
- 마이크 녹음 테스트가 실행됨
- 스피커 재생 테스트가 실행됨
- 녹음한 소리를 사용자의 요청에 따라 재생할 수 있음
- 기본 설정에서 음성 파일이 저장되지 않음
- API 키가 소스 코드에 포함되지 않음
- AI 제공자 인터페이스가 정의됨
- 인증 및 보호자 동의 인터페이스가 정의됨
- 기본 단위 테스트가 통과함
- README와 설계 문서가 생성됨

실제 하드웨어가 연결되지 않은 환경에서는 테스트를 통과했다고 허위로 보고하지 말고, 하드웨어 검증이 필요하다는 사실을 명시한다.

## 13. Codex 작업 방식

다음 순서로 작업한다.

1. 현재 프로젝트 디렉터리와 기존 파일을 확인한다.
2. 기존 코드가 있다면 무단으로 삭제하거나 덮어쓰지 않는다.
3. 폴더 구조와 의존성 파일을 구성한다.
4. 설정 및 오디오 모듈을 작성한다.
5. 추상 API 인터페이스를 작성한다.
6. 개인정보 및 인증 기반 모듈을 작성한다.
7. 테스트 코드를 작성한다.
8. 실행 가능한 테스트를 수행한다.
9. 발견된 오류를 수정한다.
10. README와 설계 문서를 완성한다.

기존 프로젝트에 통합하는 경우 현재 코드의 구조와 명명 규칙을 우선 확인하고 합리적으로 반영한다.

불필요하게 복잡한 프레임워크나 데이터베이스를 추가하지 않는다.

Phase 0 범위를 벗어나는 기능을 임의로 구현하지 않는다.

마지막으로 다음 내용을 보고한다.

- 생성 및 수정한 파일 목록
- 구현 기능 요약
- 설치된 의존성
- 실행한 테스트 및 결과
- 실행하지 못한 테스트와 이유
- 발견된 문제
- Phase 1을 시작하기 전에 필요한 작업

가능한 경우 실제 코드를 생성하고 테스트까지 수행한다. 단순히 구현 방법을 설명하는 것으로 작업을 끝내지 않는다.

---

## 부록 B. 현재 추적 파일 전체 목록

- `.dockerignore`
- `.github/workflows/pages.yml`
- `.github/workflows/tests.yml`
- `.github/workflows/web.yml`
- `.gitignore`
- `Dockerfile`
- `README.md`
- `ai_friend/.env.example`
- `ai_friend/.gitignore`
- `ai_friend/README.md`
- `ai_friend/audio/__init__.py`
- `ai_friend/audio/audio_test.py`
- `ai_friend/audio/devices.py`
- `ai_friend/audio/microphone.py`
- `ai_friend/audio/speaker.py`
- `ai_friend/audio/streams.py`
- `ai_friend/config.py`
- `ai_friend/docs/architecture.md`
- `ai_friend/docs/device_setup.md`
- `ai_friend/docs/file_manifest.md`
- `ai_friend/docs/phase0_checklist.md`
- `ai_friend/docs/phase1_readiness_review.md`
- `ai_friend/docs/privacy_policy_design.md`
- `ai_friend/infrastructure/__init__.py`
- `ai_friend/infrastructure/exceptions.py`
- `ai_friend/infrastructure/logger.py`
- `ai_friend/infrastructure/platform_info.py`
- `ai_friend/main.py`
- `ai_friend/pytest.ini`
- `ai_friend/realtime/__init__.py`
- `ai_friend/realtime/auth_interface.py`
- `ai_friend/realtime/base_client.py`
- `ai_friend/requirements-dev.txt`
- `ai_friend/requirements.txt`
- `ai_friend/safety/__init__.py`
- `ai_friend/safety/consent.py`
- `ai_friend/safety/privacy.py`
- `ai_friend/tests/conftest.py`
- `ai_friend/tests/test_audio.py`
- `ai_friend/tests/test_auth.py`
- `ai_friend/tests/test_config.py`
- `ai_friend/tests/test_hardware.py`
- `ai_friend/tests/test_main.py`
- `ai_friend/tests/test_privacy.py`
- `docs/free_hosting.md`
- `docs/railway_deployment.md`
- `docs/releases/v0.2.0.md`
- `docs/web_transition.md`
- `railway.json`
- `scripts/activate_cloud.sh`
- `scripts/publish_pages.py`
- `scripts/setup_cloud.sh`
- `scripts/setup_python.sh`
- `web/.gitignore`
- `web/.nvmrc`
- `web/README.md`
- `web/index.html`
- `web/package-lock.json`
- `web/package.json`
- `web/playwright.config.ts`
- `web/public/.nojekyll`
- `web/public/_headers`
- `web/public/capture-worklet.js`
- `web/public/favicon.svg`
- `web/scripts/serve.mjs`
- `web/scripts/test-pages.mjs`
- `web/scripts/test-railway.mjs`
- `web/src/audio-engine.ts`
- `web/src/audio-utils.ts`
- `web/src/icons.ts`
- `web/src/main.ts`
- `web/src/style.css`
- `web/src/tokens.css`
- `web/src/vite-env.d.ts`
- `web/tests/audio-utils.spec.ts`
- `web/tests/capture-worklet.spec.ts`
- `web/tests/playground.spec.ts`
- `web/tests/server.test.mjs`
- `web/tsconfig.json`
- `web/vite.config.ts`

## 부록 C. 이 인계 패키지의 기준 소스

- GitHub main / release 공통 SHA: `921e1d739615056a92a7f930244b3636860bb74d`
- 아래 해시는 인계 시 파일이 같은지 확인하기 위한 것으로 의존성 검증을 대체하지 않습니다.

- `Dockerfile`: SHA256 `5451ebcd2dc25925cc54d06e69dcde281a92106d85da98d4f0fdfd83ec66e88a`
- `railway.json`: SHA256 `db8e2fe33d5a3e44d34bae803f773af94989016c8d05bff7be89afb5708f3bb2`
- `web/index.html`: SHA256 `b8599c7663a0da75b7fe80d4f8e26d7156c6285f6f7eb55905d679685fb2944b`
- `web/src/main.ts`: SHA256 `d7287ff87e56ccfc5389f42f253cb98abda10edb418ea66827d369e9ba501f56`
- `web/src/audio-engine.ts`: SHA256 `58e2f6d4bcb01cae2d94765f2a683f47c4cf20e60ff633e639bf39aff53e9345`
- `web/scripts/serve.mjs`: SHA256 `08f9b164be0d6a0a26cb4ddfdc20a77cc93d97ce5afeb67bf2ba6c805ebe75a3`
- `web/package-lock.json`: SHA256 `cc4eaed4cfea13d24e7c0ae8da7cc9cc4907593644a4eef05e14d44e7a10d4bf`
- `web/tests/playground.spec.ts`: SHA256 `f9db46dace5881f263ed736c68af411b6d73a55ef38273b520e85588382d78dd`

이 문서에 API 키/인증 토큰/비밀번호/개인 credential 값은 포함하지 않았습니다.
