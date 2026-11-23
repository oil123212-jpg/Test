# 모모 상황별 대화 예시 조회

개인 PC용 Python 3.10+ 음성 대화 앱입니다. 전달받은 momo_realtime.zip에서 dialogues.sqlite3를 이 디렉터리에 복사하세요. DB 재구성 도구는 같은 ZIP의 build_db.py입니다.

Windows PowerShell에서 이 디렉터리를 열고 실행하세요.

```powershell
$env:OPENAI_API_KEY = "본인의 API 키"
py app.py
```

http://127.0.0.1:8000 에서 시작 활동을 고르고 대화를 시작하세요. 서버는 DB에서 활동 및 의도 목록을 읽어 Realtime 도구를 등록합니다. 세션에 짧은 지침과 활동별 예시를 설정하고 대화 중 모델이 요청하면 최대 두 개의 예시를 조회합니다.
