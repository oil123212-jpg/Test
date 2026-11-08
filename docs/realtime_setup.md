# Realtime 음성 대화 — v0.3.0

현재 Railway의 main 배포는 Node 서버가 OpenAI API 키를 보관하는 WebSocket 중계 방식입니다. 브라우저의 마이크 PCM을 전송하고 AI 음성 청크를 같은 AudioContext에서 순서대로 재생합니다. ‘지금의 연결 상태’ 카드는 제거했습니다.

## Railway에서 사용하기

- Repository: oil123212-jpg/Test, Branch: main, Root Directory: /
- 루트 Dockerfile/railway.json 사용. Build/Start Command override 없이 실행합니다.
- 기존 OPENAI_API_KEY는 **Railway 서비스 Variables**에만 둡니다. 브라우저·VITE_*·소스·로그에는 넣지 않습니다.
- OPENAI_REALTIME_MODEL: 미설정 시 gpt-realtime-2. 실제 계정의 사용 가능한 모델로 바꿀 수 있습니다.
- OPENAI_REALTIME_VOICE: 미설정 시 marin.
- REALTIME_MAX_SECONDS: 기본 120, 10~300 범위.
- REALTIME_ACCESS_CODE: 선택. 공개 서비스에는 충분히 긴 테스트 접근 코드를 설정하는 것을 권장합니다. 설정하면 대화 화면에 입력란이 표시됩니다.
- PUBLIC_APP_ORIGIN: 선택. 지정 시 https://test-production-a904.up.railway.app처럼 정확한 서비스 Origin을 사용합니다. 미설정 시 요청 Host와 브라우저 Origin이 일치해야 합니다.

배포 후 체험 로그인에서 안내에 동의하고, 실시간 대화 영역의 **별도 음성 전송 동의**를 체크한 뒤 대화 시작을 누르세요. 마이크를 허용하면 말이 끝났을 때 서버 VAD가 발화를 확정하고 Railway가 응답을 요청합니다. 마이크 끄기/켜기, 응답 중단, 대화 종료를 제공합니다. 이용 종료·외부 전송 동의 철회·탭 비활성화 때 연결과 마이크를 정리합니다. 부모님용 [라이프 가이드](life_guide.md)에서 생활 시간을 선택하면 해당 시간대의 대화에 가끔 생활 화두를 연결합니다.

기본 답변은 [모모 프롬프트](momo_prompt.md)의 3~6세 수준으로 구성합니다. 개별 연령 설정이 없으므로 3~4세도 이해할 수 있는 말로 시작합니다. 현재 체험 로그인과 음성 전송 체크박스는 계정 인증이나 보호자 본인·법정대리인 확인 기능이 아닙니다. 음성 전송 문구는 “대화 중 음성이 OpenAI로 실시간 전송되는 것에 동의합니다.”이며, 서버 중계 구조와 데이터 처리 방식은 그대로입니다.

## 구현

1. GET /api/realtime/config: 키 값 없이 설정 여부, 모델, 접근 코드 필요 여부, 시간 제한만 반환.
2. POST /api/realtime/session: 동일 Origin + JSON + 현재 정책 버전 + 명시적 외부 음성 전송 동의를 검증. 정책 버전은 realtime-voice-v2이며 화면에 없는 adultTest 항목을 전송하거나 요구하지 않습니다. 선택적 접근 코드 확인 후 짧은 일회용 권한 발급.
3. HttpOnly/SameSite=Strict 쿠키와 일회용 token을 묶어 브라우저 WebSocket의 첫 start 메시지에서 확인. URL query에 token/제공자 키를 넣지 않음.
4. Railway → wss://api.openai.com/v1/realtime?model=... 연결, Authorization 헤더로 서버 키 전달.
5. session.update: 24kHz PCM input/output, server_vad(create_response:false, interrupt_response:true), audio 응답, 최대 출력 512 tokens, 한국어 안내. committed 이벤트마다 서버가 현재 생활표와 제안 빈도를 판단해 개별 instructions의 response.create를 전송. 중복 발화 확정과 취소 중 응답 겹침 방지.
6. 브라우저 AudioContext를 24kHz로 생성해 기기 샘플레이트 변환은 Web Audio에 맡김. AudioWorklet이 모노 PCM16 little-endian을 20ms(960바이트)씩 전송. 해당 포맷을 지원하지 않는 브라우저는 안내 후 중단.
7. OpenAI response.output_audio.delta를 binary PCM으로 전달하고 브라우저에서 최대 8초까지 재생 대기. 마이크 echoCancellation/noiseSuppression을 활성화함.
8. speech_started/응답 중단 시 재생 큐 제거. 수동 중단은 response.cancel 전송. 정확한 청취 길이 기반 conversation.item.truncate는 이 초기 구현에 포함하지 않음.
9. DELETE /api/realtime/session은 자신의 일회용 session token 범위에서 연결을 정리. 늦게 도착한 이전 세션 삭제가 새 세션을 종료하지 않도록 처리.

## 비용·접근·개인정보 경계

- 기본 동시 연결 2개, 서버 인스턴스당 시간당 연결 시도 20회, 세션 최대 120초. admission 요청도 분당 40회 제한.
- 이 제한은 **인스턴스 메모리** 기반이므로 재시작 때 초기화되고 여러 replica가 공유하지 않습니다. 전역 금액 한도를 보장하지 않습니다.
- 체험 로그인은 계정 인증이 아닙니다. 공개 URL에서 비용을 보호하려면 REALTIME_ACCESS_CODE를 설정하고, 향후 실제 계정/공유 사용량 제한을 구현하세요.
- 서버가 허용하는 클라이언트 명령은 start, cancel, clear, end, 검증된 life_guide.update와 제한된 binary PCM뿐입니다. 모델/자유 형식 프롬프트/임의 provider event를 브라우저에서 지정할 수 없습니다.
- provider 메시지 원문·키·전사문은 브라우저로 전달하거나 로그에 기록하지 않습니다. 알려진 오류 코드를 한국어로 안내합니다.
- 앱은 음성 파일/전사문을 저장하지 않습니다. 연결 확인용 쿠키와 토큰은 짧은 수명의 메모리/쿠키이며 오디오를 포함하지 않습니다. OpenAI의 자체 처리·보관 조건은 별도로 적용됩니다.
- 사용자 입력 텍스트나 대화 전사문은 현재 UI에 표시하지 않으며, 음성만 전달합니다.
- 생활표의 시간대·슬롯 번호는 PostgreSQL에 브라우저별로 저장합니다. 동의/활성 여부는 DB에 저장하지 않습니다. 활성 설정만 Realtime 중계에 보내며, OpenAI에는 선택된 화두의 생활 항목과 현재 30분만 전달합니다. 이용 종료와 생활표 삭제는 별개입니다. [저장·빈도·삭제 상세](life_guide.md)를 참고하세요.

## 오류 안내

- 키 설정 필요: Railway의 OPENAI_API_KEY가 없거나 이 변경 전의 서버를 실행 중인지 확인.
- API 키/프로젝트 권한: 잘못된 키, 프로젝트 권한, 사용 가능한 모델 확인.
- API 잔액/한도: API 결제 크레딧 및 모델 rate limit 확인. ChatGPT 구독과 별도.
- 모델 사용 불가: OPENAI_REALTIME_MODEL을 계정이 지원하는 Realtime 모델로 변경.
- 연결 시간 초과: HTTPS/WSS, 서버 egress, API 서비스 상태 확인.
- 세션/이용 한도: 종료 후 기다리거나 운영자가 설정을 검토. 무제한 재연결하지 않음.

## 테스트 및 실제 접속 확인 상태

- 2026-11-08 npm run test:server: 서버·생활표·실제 WebSocket 중계 프로토콜 테스트 **42개 통과**(실제 PostgreSQL 16 저장/재시작/삭제 포함).
- npm run test:realtime: 가상 마이크 + 실제 브라우저 Web Audio + Node 중계 + 모의 OpenAI 서버와 실제 PostgreSQL 16으로 **76개 통과**(데스크톱/모바일 Chromium 설정, 순수 함수 검사 포함).
- 합계 118개. 키 비노출, 동의·Origin·권한·재사용 방지, PCM 보존, 취소 후 늦은 음성 필터, 한도·시간 종료·오류 정리, 재접속 경합, 생활표 시간대·제안 빈도·활성 수정·끼어들기, DB 저장/삭제·브라우저 분리·재로그인·실패 처리·이전 로컬 시간표 초안을 검증했습니다.
- 테스트 fixture는 별도 스크립트이고 프로덕션 Docker에 복사하지 않습니다. 테스트에서는 실제 OpenAI API를 호출하지 않습니다.
- 이 작업 환경에는 사용자가 Railway에 저장한 실제 키가 없고 공개 도메인 HTTPS 요청도 프록시의 403으로 차단됩니다. 실제 OpenAI 계정의 응답 성공·잔액·모델 권한 및 최신 Railway 배포는 재배포 후 사용자 환경에서 확인해야 합니다.

공식 프로토콜은 OpenAI SDK의 docs/realtime.md 및 src/resources/realtime/realtime.ts를 참고했습니다. 오래된 beta의 response.audio.delta 대신 GA의 response.output_audio.delta를 사용합니다.

## 로컬 개발

API 키는 Node 서버 프로세스 환경변수로만 전달합니다. `npm run build` 후 `npm start`로 3000번 서버를 실행하세요. 별도 셸에서 `npm run dev`를 실행하면 Vite가 /api/realtime HTTP/WS를 3000번으로 중계합니다. 로컬 env 파일을 Vite 공개 변수로 넣지 마세요. 실제 API 없이 개발하려면 `npm run test:realtime`의 모의 서버 통합 테스트를 사용합니다.
