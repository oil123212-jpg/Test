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
2. 별도 음성 전송 동의 후 대화 시작을 누르고 브라우저의 마이크 권한을 허용합니다.
3. 마이크 끄기·응답 중단·대화 종료로 대화를 조절합니다. 이용 종료는 탭의 동의와 세션을 정리합니다.
4. 설정의 첫 탭에서 이름·3~6세 나이·64개 관심사를 입력합니다. 관심사는 카테고리 없이 펼쳐져 있으며 선택한 버튼이 맨 위로 이동합니다. 같은 버튼을 다시 눌러 해제합니다. 프로필 저장을 누르면 SQL에 저장합니다.
5. 오디오 설정 탭에서 마이크·출력 장치·음량을 선택합니다. 오디오 초기화는 프로필과 생활 시간표를 삭제하지 않습니다.

HTTPS 또는 브라우저가 신뢰하는 로컬 주소에서 마이크를 사용할 수 있습니다. 출력 장치 선택은 브라우저 지원 여부에 따라 제한됩니다. 장치 목록 조회는 마이크 권한을 자동 요청하지 않습니다. 탭 비활성화·페이지 종료 시 대화 연결을 정리합니다.

체험 로그인은 계정이나 보호자 본인 인증 없이 쿠키로 브라우저를 구분하는 테스트용 기능입니다. 같은 브라우저로 재로그인하면 저장된 프로필·생활 시간표를 복원합니다. 음성·대화 내용은 이 앱의 DB에 저장하지 않습니다. OpenAI의 별도 데이터 처리 조건은 적용됩니다.

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
