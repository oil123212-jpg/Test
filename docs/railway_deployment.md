# Railway 배포

배포 대상은 Railway입니다. GitHub는 소스/버전 관리용이며 GitHub Pages나 Netlify 설정이 필요하지 않습니다.

## 기존 GitHub 저장소에서 배포

Railway 서비스의 Source를 다음과 같이 지정합니다.

- Repository: `oil123212-jpg/Test`
- Branch: `main` (최신 웹사이트 및 Railway 설정 반영)
- Root Directory: `/` (저장소 루트). `/web`로 설정하지 않습니다.
- Builder: Dockerfile (루트 `Dockerfile` 및 `railway.json` 포함)
- Healthcheck: `/health` (설정 파일에 포함)

Dockerfile이 웹 의존성을 설치하고 빌드합니다. 실행 단계에는 Node와 정적 빌드만 포함하며 `0.0.0.0:$PORT`로 요청을 받습니다. 별도의 Build/Start Command override는 제거하고 Dockerfile의 CMD를 사용하세요. Python/PortAudio는 필요하지 않습니다. 실시간 대화에는 서비스 변수 OPENAI_API_KEY를 사용합니다. [Realtime 설정](realtime_setup.md)을 참고하세요.

기존 Railway 서비스가 이 저장소의 `main`을 연결했다면 새 커밋 배포를 확인하거나 Deployments에서 Redeploy를 실행합니다. 다른 브랜치가 연결되어 있으면 Source의 Branch를 `main`으로 변경합니다.

배포한 뒤 Settings → Networking → Public Networking에서 Generate Domain을 실행합니다. 이미 도메인이 있다면 그 도메인을 사용하세요. Target Port를 직접 설정해야 한다면 Railway가 앱에 주입한 PORT와 일치시켜야 합니다. 고정 포트를 선택하려면 서비스 변수 PORT=3000과 도메인의 Target Port=3000을 함께 설정하세요. Dockerfile의 EXPOSE는 실제 listen 포트를 강제하지 않습니다. Railway가 제공하는 HTTPS 도메인에서 마이크를 사용할 수 있습니다. 도메인의 `/health` 응답과 데모·실제 녹음·재생을 확인하세요.

## ZIP에서 작업하는 경우

`momo-web-v0.2.0-railway.zip`은 **소스·Dockerfile·Railway 설정** 묶음입니다. 압축을 풀고 Dockerfile이 있는 폴더를 프로젝트 루트로 사용하세요. 기존 정적 파일 ZIP과 달리 dist 폴더만 배포하는 구성이 아닙니다.

Railway CLI를 사용한다면 자신의 계정에서 `railway login`, `railway link`로 프로젝트/서비스를 선택한 뒤 프로젝트 루트에서 `railway up`으로 배포합니다. 기존 Railway 프로젝트가 있다면 그 프로젝트/서비스를 선택하세요. 이 클라우드에는 Railway 계정/프로젝트 인증이 연결되어 있지 않으므로 실제 Railway 배포는 여기서 완료했다고 주장하지 않습니다.

## PostgreSQL 생활 시간표 저장

1. Railway 프로젝트에서 **웹 서비스(Test)** → **Variables**를 엽니다. DB 서비스에 변수가 있는 것만으로는 웹 서버에 전달되지 않습니다.
2. **Add Reference**에서 연결한 PostgreSQL 서비스의 **DATABASE_URL**을 선택합니다. PostgreSQL 서비스 이름이 `Postgres`라면 웹 서비스 변수는 `DATABASE_URL=${{Postgres.DATABASE_URL}}`입니다. 실제 서비스 이름이 다르면 UI에서 해당 서비스를 선택하세요. 같은 Railway 프로젝트의 내부 연결 주소를 사용합니다.
3. 변수를 적용하고 웹 서비스를 재배포합니다. `VITE_DATABASE_URL` 등 브라우저 변수는 만들지 마세요. URL/비밀번호를 소스나 채팅에 넣지 않습니다. 앱은 연결 문자열의 TLS 설정을 따르며 인증서 검증을 임의로 끄지 않습니다.
4. 사이트에서 **체험 로그인 → 안내 동의 → 라이프 가이드 → 시간 선택 → 저장하고 적용**을 실행합니다. 최초 로그인 때 `momo_life_guides` 테이블을 자동 생성하므로 DB 사용자에 CREATE TABLE 권한이 필요합니다. 기존 테이블이나 데이터를 지우는 마이그레이션은 하지 않습니다.
5. 로그아웃 후 같은 브라우저에서 다시 로그인해 시간 선택이 복원되는지 확인합니다. 생활 이야기 연결 여부는 저장하지 않으므로 재로그인 후 꺼져 있어야 합니다. 다른 브라우저에는 별도 시간표가 보여야 합니다.

DB에 저장하는 열은 무작위 쿠키의 해시 `device_hash`, 시간표 JSON `schedule` 두 개입니다. 활성 여부/음성/전사문/계정 정보는 저장하지 않습니다. 임시 로그인은 인스턴스 메모리 기반이며 12시간 후 또는 재시작 시 만료됩니다. 테스트 서버는 replica 하나로 실행하세요. 실제 계정과 기기 간 동기화는 후속 작업입니다.

`/api/life-guide/config`는 설정 존재 여부만 반환합니다. DB 실접속 확인은 로그인과 시간표 저장/조회로 확인합니다. DATABASE_URL이 없거나 접속에 실패하면 화면에 오류를 표시하고 DB 저장 성공으로 처리하지 않습니다. DB 장애가 로컬 오디오/웹 healthcheck를 막지는 않습니다. 제공자 오류 원문은 로그에 쓰지 않고 고정 코드 `LIFE_GUIDE_DB_UNAVAILABLE`만 남깁니다. 새 DB를 추가만 했다면 2번 변수 참조 설정을 먼저 확인하세요.

현재 작업 환경에는 사용자의 Railway DB/계정 인증이 없어 실제 배포 DB 연결은 여기서 검증할 수 없습니다. 로컬 PostgreSQL 16을 사용해 같은 API와 데이터 보존을 검증합니다. 자동 검사에 DB 통합 검증을 포함하려면 테스트용 PostgreSQL URL을 `LIFE_GUIDE_TEST_DATABASE_URL`로 지정해 `npm run test:server`, `npm run test:realtime`을 실행합니다. 테스트는 테이블을 생성하고 시간을 저장/삭제하므로 운영 DB 주소를 사용하지 마세요.

## 로컬 실행 점검

`cd web`, `npm ci`, `npm run build`, `npm start`를 실행합니다. 기본 포트는 3000이며 Railway에서는 PORT 환경변수를 사용합니다.

- `npm run test:server`: healthcheck, 보안 헤더, MIME, HEAD, 업로드 차단, 숨김 파일/경로/심볼릭 링크 보호 검증
- `npm run test:railway`: 배포용 Node 서버를 대상으로 기존 브라우저 기능 전체 검증

이 설정은 배포 플랫폼을 Railway에 맞춘 것입니다. Railway의 계정 요금/크레딧 정책을 무료라고 보장하지 않습니다. 실시간 대화는 OpenAI API 사용량에 따라 별도 비용이 발생합니다.

## 현재 검증 결과

Node 배포 서버 테스트 7개, 해당 서버를 대상으로 한 데스크톱/모바일 Chromium 테스트 46개가 통과했습니다. 메뉴 제거 후 옛 주소 처리와 체험 로그인 동의/철회도 검증합니다. 실제 Railway 계정의 배포/HTTPS 주소 생성은 별도이며 완료로 표시하지 않습니다.

로컬에서 Docker 이미지와 비관리자 컨테이너 실행을 검증했고, PORT=43123의 health/HTML/worklet 응답이 모두 200이었습니다. 로컬 성공은 Railway 빌더 호환성을 증명하지는 않습니다.

Railway 빌드 로그에서 `--mount=type=secret,id=build_ca`가 지원되지 않는 것을 확인했습니다. 배포 Dockerfile은 해당 로컬 전용 설정을 제거한 일반 `RUN npm ci`를 사용합니다. TLS 및 패키지 무결성 검증은 유지합니다. 사설 인증서가 필요한 로컬 검증은 별도의 임시 Dockerfile에서만 수행하고 배포 Dockerfile에 secret 마운트를 추가하지 않습니다.

## main 반영 확인

기본 브랜치 main에 웹사이트, Dockerfile, railway.json, Node 실행 서버를 통합했습니다. 예전 main에는 배포 설정이 없어 기본 브랜치를 연결한 서비스에서 최신 웹사이트가 실행되지 않을 수 있었습니다. 기존 버전 태그와 release 브랜치는 삭제하거나 재지정하지 않았습니다.

## v0.3 실시간 대화

[Realtime 설정](realtime_setup.md)이 최신 연결 안내입니다. Docker runtime에 ws 의존성과 gateway 스크립트를 포함합니다. 아래의 과거 테스트 53개 기록과 별도로 최신 서버 24개/브라우저 62개 검증을 완료했습니다. 실제 OpenAI 연결 결과는 서비스 재배포 후 확인해야 합니다.
