# 모모 웹

브라우저에서 OpenAI Realtime 음성 대화를 제공합니다. 홈에는 이미지 생성으로 제작한 모모 캐릭터와 실시간 대화 영역을 표시하고, 별도 오디오 테스트·녹음 데모·해당 메뉴는 제거했습니다. 이전 `#audio` 주소는 홈으로 돌아옵니다.

## 실행과 배포

Node.js 24 이상에서 실행합니다.

```bash
npm ci
npm run dev
```

개발 서버 기본 포트는 5173입니다. 실제 대화·DB 기능은 `npm run build` 후 `npm start`로 실행하는 Node 서버와 Railway 변수 설정이 필요합니다. 배포는 저장소 루트 Dockerfile과 `railway.json`, GitHub `main`을 사용합니다.

- [Realtime API 키와 Railway 변수](../docs/realtime_setup.md)
- [Railway 배포와 PostgreSQL 연결](../docs/railway_deployment.md)
- [아이 프로필과 SQL 저장](../docs/child_profile.md)
- [라이프 가이드](../docs/life_guide.md)
- [모모 답변 프롬프트](../docs/momo_prompt.md)

API 키는 서버의 `OPENAI_API_KEY`, PostgreSQL 연결은 `DATABASE_URL`로 설정합니다. 브라우저에 장기 API 키를 넣지 않습니다. 정적 호스팅만으로 실시간 중계와 DB 저장을 실행할 수 없습니다.

## 이용 흐름

1. 체험 로그인에서 개인정보 처리 안내를 확인하고 동의합니다. 이 동작으로 마이크를 자동 시작하지 않습니다.
2. 대화 화면 중앙의 마이크 버튼을 누르고 브라우저의 마이크 권한을 허용합니다.
3. 같은 마이크 버튼을 다시 누르면 대화를 종료합니다. 이용 종료는 탭의 동의와 세션을 정리합니다.
4. 설정의 첫 탭에서 이름·3~6세 나이·64개 관심사를 입력합니다. 관심사는 카테고리 없이 펼쳐져 있으며 선택한 버튼이 맨 위로 이동합니다. 같은 버튼을 다시 눌러 해제합니다. 프로필 저장을 누르면 SQL에 저장합니다.
5. 오디오 설정 탭에서 마이크·출력 장치·음량을 선택합니다. 오디오 초기화는 프로필과 생활 시간표를 삭제하지 않습니다.

HTTPS 또는 브라우저가 신뢰하는 로컬 주소에서 마이크를 사용할 수 있습니다. 출력 장치 선택은 브라우저 지원 여부에 따라 제한됩니다. 장치 목록 조회는 마이크 권한을 자동 요청하지 않습니다. 탭 비활성화·페이지 종료 시 대화 연결을 정리합니다.

로그인한 계정에 동의 여부·안내 버전·시각을 저장합니다. 선택한 아이 별명·나이·관심사와 생활 시간표는 같은 계정으로 다시 로그인하면 불러옵니다. 아이디 로그인은 비밀번호 검증값을, 구글 로그인은 구글에서 발급한 계정 식별자를 사용합니다. 로그인 및 음성 전송을 포함한 개인정보 이용에 동의하고 마이크 버튼을 누르면, Railway를 거쳐 미국 OpenAI가 음성을 처리합니다. 모모는 아이의 발화와 모모의 답변을 텍스트로 계정에 저장합니다. 각 발화는 생성 시점부터 48시간 동안만 이용하며 만료된 행은 서버 정리 작업으로 삭제합니다. 음성 파일은 저장하지 않습니다. 이전 대화의 최근 주제를 다음 답변에 참고합니다.

## 구성

- `src/main.ts`: 대화 UI·동의·설정·화면 이동
- `src/child-profile.ts`: 관심사 선택과 프로필 API
- `src/life-guide.ts`: 생활 시간표와 DB 로그인
- `src/realtime-client.ts`, `public/realtime-worklet.js`: 실시간 음성 수집·재생
- `public/momo-character.png`: 이미지 생성으로 제작한 캐릭터 원본
- `scripts/realtime-gateway.mjs`: OpenAI WebSocket 중계
- `scripts/life-guide-store.mjs`: PostgreSQL 저장과 세션

## 검증

```bash
npm run build
npm run test:realtime
npm run test:server
```

`test:realtime`은 데스크톱·모바일 Chromium에서 캐릭터 로딩, 관심사 정렬·해제·키보드, 프로필/시간표 저장과 실패 처리, 동의와 실제 중계 코드의 음성 흐름을 검사합니다. 제거한 로컬 녹음 UI 검사는 새 화면 흐름 검사로 교체했습니다. OpenAI와 DB는 fixture를 사용하며 실제 Railway 접속이나 유료 API 호출 성공을 의미하지 않습니다. PostgreSQL 통합 검사는 별도 테스트 DB 설정 시 실행합니다.

모바일 검사는 Chromium 에뮬레이션입니다. 가상 마이크 플래그는 자동화 테스트에서만 사용하며 제품은 사용자의 실제 마이크 권한을 요청합니다.

### 동화 역할극

음성 대화에서 “책 읽자”라고 하면 서버가 SQLite 책장에서 한 권을 골라 제목부터 바로 읽습니다. 제목을 지정하면 해당 책을 조회합니다. DB에 책이 없거나 조회에 실패하면 안내하고 낭독을 멈춥니다. 음성 대화와 역할극 화면은 모두 `web/data/books.sqlite`의 순서 있는 대본을 사용합니다.

메뉴 **동화 역할극**에서 책과 배역을 선택합니다. 토끼와 거북이, 금도끼와 은도끼, 단군이야기, 우렁이 색시, 견우와 직녀, 토끼전은 제공된 PDF에서 추출했습니다. source_pages에는 페이지별 추출 텍스트를, lines에는 낭독할 본문과 화자를 보관합니다. 6권 각각의 PDF 20페이지를 순서대로 보관합니다. 모모는 해설과 나머지 등장인물을 한국어 로컬 TTS로 읽습니다.

보호자가 **자동 넘김 켜기**를 선택하면 한국어 로컬 인식 지원 여부를 확인합니다. 지원 기기에 언어팩이 없으면 설치를 시도합니다. 아이의 차례에만 마이크를 열고, 확정 인식 결과가 대사의 어절 중 65% 이상(올림)을 원래 순서대로 포함하면 다음으로 넘어갑니다. 누락·삽입을 허용하지만 동의어·조사 변형까지 같다고 판정하지는 않습니다. 재시도·마이크 차단·미지원 기기에는 **다시 듣기 시작** 또는 **직접 넘기기**가 있습니다. 이 화면은 클라우드 인식으로 전환하지 않으며 음성·전사문을 서버에 전송하거나 저장하지 않습니다.

- 판정과 대본 테스트: `node --test tests/story-match.test.mjs tests/role-reading.test.mjs`
- Node 24·의존성 설치 후 배포 서버 기반 브라우저 검사: `npm run test:railway` (음성 모의 객체 사용)
- 실제 태블릿의 HTTPS 주소에서 언어팩, 권한, 한국어 TTS, 아이 차례에서만 켜지는 마이크와 화면 이동 시 종료를 확인합니다.
- Railway 설정 및 환경변수 목록: [Railway 배포 안내](../docs/railway_deployment.md)

## 계정 로그인
Railway에서 DATABASE_URL을 설정하면 아이디 가입과 로그인이 활성화됩니다. Google Cloud에 웹 애플리케이션 OAuth 클라이언트를 만들고 승인된 리디렉션 URI를 `https://test-production-a904.up.railway.app/api/auth/google/callback`으로 등록합니다. Railway 서버 변수에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 및 PUBLIC_APP_ORIGIN(경로와 끝 슬래시 없는 HTTPS 원점)을 설정합니다. 비밀값은 프런트엔드에 넣지 않습니다. 기존 브라우저별 데이터는 계정에 자동 연결하지 않습니다.
