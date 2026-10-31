# Railway 배포

배포 대상은 Railway입니다. GitHub는 소스/버전 관리용이며 GitHub Pages나 Netlify 설정이 필요하지 않습니다.

## 기존 GitHub 저장소에서 배포

Railway 서비스의 Source를 다음과 같이 지정합니다.

- Repository: `oil123212-jpg/Test`
- Branch: `main` (최신 웹사이트 및 Railway 설정 반영)
- Root Directory: `/` (저장소 루트). `/web`로 설정하지 않습니다.
- Builder: Dockerfile (루트 `Dockerfile` 및 `railway.json` 포함)
- Healthcheck: `/health` (설정 파일에 포함)

Dockerfile이 웹 의존성을 설치하고 빌드합니다. 실행 단계에는 Node와 정적 빌드만 포함하며 `0.0.0.0:$PORT`로 요청을 받습니다. 별도의 Build/Start Command override는 제거하고 Dockerfile의 CMD를 사용하세요. Python/PortAudio 및 API 키는 필요하지 않습니다.

기존 Railway 서비스가 이 저장소의 `main`을 연결했다면 새 커밋 배포를 확인하거나 Deployments에서 Redeploy를 실행합니다. 다른 브랜치가 연결되어 있으면 Source의 Branch를 `main`으로 변경합니다.

배포한 뒤 Settings → Networking → Public Networking에서 Generate Domain을 실행합니다. 이미 도메인이 있다면 그 도메인을 사용하세요. Target Port를 직접 설정해야 한다면 Railway가 앱에 주입한 PORT와 일치시켜야 합니다. 고정 포트를 선택하려면 서비스 변수 PORT=3000과 도메인의 Target Port=3000을 함께 설정하세요. Dockerfile의 EXPOSE는 실제 listen 포트를 강제하지 않습니다. Railway가 제공하는 HTTPS 도메인에서 마이크를 사용할 수 있습니다. 도메인의 `/health` 응답과 데모·실제 녹음·재생을 확인하세요.

## ZIP에서 작업하는 경우

`momo-web-v0.2.0-railway.zip`은 **소스·Dockerfile·Railway 설정** 묶음입니다. 압축을 풀고 Dockerfile이 있는 폴더를 프로젝트 루트로 사용하세요. 기존 정적 파일 ZIP과 달리 dist 폴더만 배포하는 구성이 아닙니다.

Railway CLI를 사용한다면 자신의 계정에서 `railway login`, `railway link`로 프로젝트/서비스를 선택한 뒤 프로젝트 루트에서 `railway up`으로 배포합니다. 기존 Railway 프로젝트가 있다면 그 프로젝트/서비스를 선택하세요. 이 클라우드에는 Railway 계정/프로젝트 인증이 연결되어 있지 않으므로 실제 Railway 배포는 여기서 완료했다고 주장하지 않습니다.

## 로컬 점검

`cd web`, `npm ci`, `npm run build`, `npm start`를 실행합니다. 기본 포트는 3000이며 Railway에서는 PORT 환경변수를 사용합니다.

- `npm run test:server`: healthcheck, 보안 헤더, MIME, HEAD, 업로드 차단, 숨김 파일/경로/심볼릭 링크 보호 검증
- `npm run test:railway`: 배포용 Node 서버를 대상으로 기존 브라우저 기능 전체 검증

이 설정은 배포 플랫폼을 Railway에 맞춘 것입니다. Railway의 계정 요금/크레딧 정책을 무료라고 보장하지 않습니다. 실제 AI 호출은 여전히 구현하지 않았습니다.

## 현재 검증 결과

Node 배포 서버 테스트 7개, 해당 서버를 대상으로 한 데스크톱/모바일 Chromium 테스트 30개가 통과했습니다. 실제 Railway 계정의 배포/HTTPS 주소 생성은 별도이며 완료로 표시하지 않습니다.

Docker 이미지 빌드 및 비관리자 컨테이너 실행도 검증했습니다. 임의 PORT=43123에서 health/HTML/worklet 응답이 모두 200이었습니다. 이 클라우드의 TLS 중계 인증서는 호스트 신뢰 저장소를 임시 build_ca secret으로 전달해 검증했으며 TLS 검증을 비활성화하지 않았습니다. 일반 Railway 빌드는 추가 인증서 없이 실행하고, 사설 중계가 있는 빌드 환경에서만 신뢰할 수 있는 CA를 build_ca로 제공할 수 있습니다. 인증서 묶음은 소스/이미지에 복사하지 않습니다.

## main 반영 확인

기본 브랜치 main에 웹사이트, Dockerfile, railway.json, Node 실행 서버를 통합했습니다. 예전 main에는 배포 설정이 없어 기본 브랜치를 연결한 서비스에서 최신 웹사이트가 실행되지 않을 수 있었습니다. 기존 버전 태그와 release 브랜치는 삭제하거나 재지정하지 않았습니다.
