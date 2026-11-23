import json
import os
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sqlite3
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DB = Path(__file__).with_name("dialogues.sqlite3")

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = int(os.getenv("PORT", "8000"))
if not DB.is_file():
    raise SystemExit("먼저 momo_realtime.zip의 dialogues.sqlite3를 app.py 옆에 복사해 주세요.")
with closing(sqlite3.connect(DB.resolve().as_uri() + "?mode=ro", uri=True)) as catalog:
    ACTIVITIES = [row[0] for row in catalog.execute("SELECT DISTINCT activity FROM cards ORDER BY activity")]
    INTENTS = [row[0] for row in catalog.execute("SELECT DISTINCT intent FROM cards ORDER BY intent")]
RULES = """너는 3~6세 아이의 한국어 음성 친구 모모다. 한국어로 짧게 한두 문장을 말한다.
직전 활동과 역할을 기억하고 아이의 말과 감정을 먼저 받아 준다. 질문은 한 번에 하나만 한다.
'이거'가 나오면 직전 대화를 보고, 대상을 모를 때만 묻는다. 보이지 않는 장면을 지어내지 않는다.
아이가 활동을 바꾸면 따라간다. 참고할 예시가 필요한 새 상황에서만 lookup_examples를 호출한다.
평범한 맞장구와 같은 장면의 후속 발화에는 바로 답한다. 등록된 의도에 맞지 않으면 검색을 생략한다.
예시는 말하는 방식만 참고한다. 예시 속 사물, 가족, 경험을 현재 아이에게 옮기지 않는다.
검색 결과가 비면 실제 대화만으로 답한다. 책 본문이 없으면 원문인 것처럼 읽지 않는다."""
TOOL = {"type":"function","name":"lookup_examples","description":"현재 활동과 아이의 의도에 맞는 짧은 대화 예시 조회",
        "parameters":{"type":"object","properties":{"activity":{"type":"string","enum":ACTIVITIES},
        "intent":{"type":"string","enum":INTENTS + ["전체"]}},"required":["activity","intent"],"additionalProperties":False}}

def lookup(activity, intent="전체"):
    if activity not in ACTIVITIES or intent not in INTENTS + ["전체"]:
        raise ValueError("등록되지 않은 태그예요.")
    with closing(sqlite3.connect(DB.resolve().as_uri() + "?mode=ro", uri=True)) as con:
        con.row_factory = sqlite3.Row
        rows = con.execute("""SELECT scene, strategy, example FROM cards
            WHERE activity=? AND (intent=? OR ?='전체') ORDER BY source_id LIMIT 2""", (activity,intent,intent))
        return [dict(row) for row in rows]

def session_config(mode):
    hints = ""
    if mode != "자유 대화":
        hints = f"\n시작 활동은 {mode}. 초기 참고 예시: " + json.dumps(lookup(mode), ensure_ascii=False)
    return {"type":"realtime","model":os.getenv("OPENAI_REALTIME_MODEL","gpt-realtime"),
            "instructions":RULES+hints, "tools":[TOOL], "tool_choice":"auto",
            "audio":{"output":{"voice":"marin"}}}

class Handler(BaseHTTPRequestHandler):
    def reply(self, code, data, mime="application/json"):
        body = data if isinstance(data, bytes) else json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Cache-Control","no-store")
        self.send_header("Content-Length",str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/modes":
            return self.reply(200, ["자유 대화"] + ACTIVITIES)
        files = {"/":("index.html","text/html"), "/app.js":("app.js","text/javascript")}
        if self.path not in files:
            return self.reply(404, {})
        name, mime = files[self.path]
        self.reply(200,(ROOT/"static"/name).read_bytes(),mime)

    def do_POST(self):
        if self.headers.get("Host") != f"{HOST}:{PORT}" or self.headers.get("Origin") != f"http://{HOST}:{PORT}":
            return self.reply(403, {"error":"로컬 페이지에서 실행해 주세요."})
        try:
            size = int(self.headers.get("Content-Length","0"))
            if not (0 < size <= 4096):
                raise ValueError("요청 크기를 확인해 주세요.")
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError("JSON 객체가 필요해요.")
            if self.path == "/examples":
                return self.reply(200, {"examples":lookup(data.get("activity"), data.get("intent"))})
            if self.path != "/session":
                return self.reply(404,{})
            config = session_config(data.get("mode"))
            key = os.environ.get("OPENAI_API_KEY")
            if not key:
                return self.reply(503, {"error":"서버에 OPENAI_API_KEY를 설정해 주세요."})
            req = Request("https://api.openai.com/v1/realtime/client_secrets",
                data=json.dumps({"session":config}).encode(),
                headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"})
            with urlopen(req, timeout=20) as upstream:
                token = json.load(upstream)["value"]
            self.reply(200, {"value":token})
        except ValueError as exc:
            self.reply(400, {"error":str(exc)})
        except HTTPError as exc:
            self.reply(502, {"error":f"OpenAI 세션 발급 실패 (HTTP {exc.code}). 키, 모델 권한과 잔액을 확인해 주세요."})
        except (URLError, TimeoutError):
            self.reply(502, {"error":"OpenAI 연결 시간이 초과되었거나 연결할 수 없어요."})

if __name__ == "__main__":
    print(f"http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
