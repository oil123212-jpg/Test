"""Build the public, text-free-of-transcripts catalogue from the supplied Korean corpus ZIP."""
import argparse
from collections import Counter, defaultdict, deque
import csv
import io
import os
from pathlib import Path
import re
import sqlite3
import tempfile
from zipfile import ZipFile

# Public labels, cues and replies are editorial Korean. No transcript strings are
# interpolated. A card is emitted only for combinations witnessed in the corpus.
TOPICS = {
    "책과 이야기": ("책|이야기|동화|읽어", "이야기"),
    "그림": ("그림|그렸|그리기|색칠", "그림"),
    "블록": ("블록|블럭|쌓기", "블록"),
    "퍼즐": ("퍼즐|조각 맞", "퍼즐"),
    "인형": ("인형", "인형"),
    "가게 놀이": ("가게|손님|주문|한잔 주세요|한 잔 주세요", "가게 놀이"),
    "요리": ("요리|썰어|냄비|프라이팬", "요리"),
    "음식": ("과자|사과|피망|바나나|딸기|김치|당근|빵", "먹거리"),
    "탈것": ("자동차|기차|버스|비행기|자전거|트럭", "탈것"),
    "동물": ("토끼|강아지|고양이|사자|코끼리|기린|호랑이", "동물"),
    "옷 입기": ("바지|양말|모자|치마|신발", "옷차림"),
    "씻기": ("칫솔|양치|세수|목욕|비누", "씻기"),
    "잠자리": ("잘 시간|잘래|이불|베개|자장가", "잠자리"),
    "음악": ("노래|피아노|북소리|악기", "음악"),
    "수 세기": ("몇 개|몇개|하나 둘|세어|세 봐", "수 세기"),
    "색깔": ("무슨 색|빨간색|파란색|노란색|초록색|색깔", "색깔"),
    "물건 찾기": ("어디 있|어딨|어디 갔|찾았다|찾았어", "물건 찾기"),
    "함께 놀기": ("놀이|놀자|놀아|장난감", "놀이"),
    "감정 대화": ("무서|울어|울고|슬퍼|속상|화났", "마음"),
    "자연": ("나무|나뭇잎|구름|꽃잎|바람|무지개", "자연"),
    "스티커": ("스티커|스티카", "스티커"),
    "공놀이": ("축구|공놀이|공을|공 던", "공놀이"),
    "전화 놀이": ("여보세요|전화기|전화해", "전화"),
    "공룡": ("공룡|티라노|트리케라", "공룡"),
    "가족 놀이": ("엄마 놀이|아기 인형|소꿉|아기야", "가족 놀이"),
    "친구": ("친구|짝꿍", "친구"),
    "유치원": ("유치원|어린이집", "유치원"),
    "비와 눈": ("비가|눈이 와|우산|빗방울", "날씨"),
    "병원 놀이": ("병원 놀이|청진기|의사 선생님", "병원 놀이"),
    "목욕 놀이": ("목욕|거품|욕조", "목욕 놀이"),
    "바다": ("바다|물고기|고래|상어", "바다"),
    "곤충": ("나비|애벌레|개미|무당벌레", "곤충"),
    "공간과 크기": ("위에|아래에|밑에|옆에|커다란|작은 거", "위치나 크기"),
    "모양": ("동그라미|세모|네모|동그랗|삼각형", "모양"),
    "종이 놀이": ("종이|접어|색종이", "종이 놀이"),
    "옛이야기": ("옛날 옛날|옛날에|도깨비|공주님|임금님", "옛이야기"),
    "기념일": ("생일|크리스마스|선물", "기념일"),
    "숨바꼭질": ("숨바꼭질|꼭꼭 숨어", "숨바꼭질"),
}
# The condition refers to the child's turn. Only adjacent same-session adult
# replies count as supporting evidence; generic 'yes' is not classified.
INTENTS = {
    "거절": ("싫어|안 할래|그만해|안 먹", "아이가 거절하거나 그만하려 함", "거절을 받아 주고 하던 활동을 멈춘다.", "응, 여기서 그만하자."),
    "반복": ("한 번 더|한번 더|또 해|다시 해|다시 읽", "방금 한 활동을 반복해 달라고 함", "직전 활동에서 아이가 원한 부분만 반복한다.", "좋아, 아까 그 부분부터 한 번 더!"),
    "위치 질문": ("어디|어딨", "무엇이 어디 있는지 물음", "찾는 대상을 짚고, 보이지 않는 위치는 단정하지 않는다.", "같이 찾아볼까? 마지막으로 어디서 봤어?"),
    "발견": ("찾았|여기 있|여깄|이거다", "아이가 찾던 것을 알아봄", "위치를 되묻지 않고 발견에 호응한다.", "찾았구나!"),
    "이름 질문": ("뭐야|뭐예|뭐지|뭔데|이름이 뭐", "대상의 이름을 물음", "앞 대화로 대상이 분명하면 이름을 말하고 아니면 단서 하나를 묻는다.", "어떤 모양인지 말해 줄래?"),
    "이유 질문": ("왜", "아이가 이유를 물음", "직전 대상에 맞춰 쉬운 이유 한 가지만 말한다.", ""),
    "방법 질문": ("어떻게|어떡해", "방법이나 다음 행동을 물음", "현재 시도에서 이어갈 작은 단계 하나를 제안한다.", ""),
    "정정": ("아니야|아닌데|그거 아니", "아이가 앞의 말을 바로잡음", "자기 추측을 거두고 아이가 고친 내용을 받아 준다.", "아, 내가 다르게 생각했네. 네 말을 들을게."),
    "선택": ("이걸로|이거 할래|저거 할래|하고 싶|할래", "하고 싶은 것을 고름", "선택을 되짚고 다음 행동을 아이에게 맡긴다.", "그래, 네가 고른 걸로 하자."),
    "직접 하기": ("내가 할|내가 해|혼자 할", "스스로 해 보려 함", "대신 해결하지 않고 기다려 준다.", "네가 해 보고 싶구나. 기다릴게."),
    "도움 요청": ("도와|해 줘|해줘|해 주세|해주세요", "도움을 요청함", "할 수 있는 말이나 놀이로 돕고 실제 물건을 움직인 척하지 않는다.", ""),
    "수량 질문": ("몇 개|몇개|몇 마리", "몇 개인지 물음", "실제로 보지 못한 개수를 추측하지 않고 같이 세도록 돕는다.", "하나씩 짚으면서 세어 볼까?"),
    "두려움": ("무서워|무섭", "두렵다고 표현함", "감정을 먼저 받아 주고 활동을 계속할지 아이에게 맡긴다.", "무서웠구나. 잠깐 멈출까?"),
    "취향 표현": ("맛있|좋아해|재밌|재미있|예쁘|이쁘", "좋았던 느낌을 표현함", "아이의 느낌을 되짚고 어른의 평가를 보태지 않는다.", ""),
    "소유": ("내 거|내꺼|내 거야|내 건데", "누구의 것인지 말함", "소유에 대한 말을 받아 주고 갈등 여부를 미리 단정하지 않는다.", "네 거라고 말해 주는구나."),
    "보여 주기": ("이거 봐|이것 봐|여기 봐", "관심 있는 것을 보여 주려 함", "보고 있다는 표현 대신 아이가 설명할 기회를 준다.", "어떤 걸 보여 주고 싶었어?"),
    "긍정 확인": ("맞아|그렇지|그치|맞지", "상대의 말을 확인함", "바로 앞의 말에서 확인된 부분만 받아 준다.", "응, 그 얘기였구나."),
    "모름": ("몰라|모르겠", "잘 모르겠다고 표현함", "정답을 재촉하지 않고 단서 하나를 주거나 쉬어 간다.", "괜찮아, 천천히 같이 생각해 보자."),
    "부재": ("없어|없네|없다", "기대했던 것이 없다고 함", "무엇을 기대했는지 직전 문맥에서 찾아 반응한다.", "아, 찾던 게 없었구나."),
    "완료": ("다 했|다했|다 됐|됐다|끝났", "하던 일이 끝났다고 알림", "끝낸 것을 인정하고 즉시 다음 과제를 주지 않는다.", "다 했구나!"),
    "대상 지정": ("이거야|요거야|저거야|이거예", "대화 중 특정 대상을 지목함", "지목한 대상이 분명할 때만 이름을 사용한다.", "아, 그걸 말한 거구나."),
    "흉내": ("멍멍|야옹|칙칙폭폭|부릉|꿀꿀|어흥|깡총", "소리나 움직임을 흉내 냄", "아이가 낸 소리나 리듬을 한 번 받아 놀이로 연결한다.", ""),
    "상태 변화": ("떨어졌|깨졌|무너졌|고장났|부러졌", "놀이 중 달라진 상태를 알림", "변화를 알아주고 아이가 도움을 원할 때만 방법을 보탠다.", ""),
    "건네기": ("여기요|여기 있어요|받으세요|드세요", "놀이 속에서 상대에게 건넴", "놀이 역할을 유지하며 짧게 받아 준다.", "네, 고마워요!"),
    "기억": ("아까|어제|저번에", "앞서 있었던 일을 꺼냄", "아이가 말한 범위 안에서 경험을 이어 듣는다.", ""),
    "역할 제안": ("내가 엄마|내가 아빠|내가 손님|내가 선생|너는 아기", "놀이 역할을 제안함", "아이가 정한 역할로 한마디를 이어 간다.", ""),
}

CURATED = [
    ('책과 이야기', '발견', '찾던 책을 발견함', '찾은 기쁨에 짧게 호응하고 아이가 고른 책을 이어간다.', '찾았구나! 그 책부터 읽을까?'),
    ('책과 이야기', '도움 요청', '아이가 빨리 읽어 달라고 함', '퀴즈를 멈추고 읽던 대목을 이어간다.', '응, 이어서 읽을게.'),
    ('물건 찾기', '위치 질문', '그림 속 동물이 어디 있는지 물음', '찾는 대상을 되짚어 주고 아이가 발견할 시간을 준다.', '토끼를 찾고 있구나. 어디에 숨었을까?'),
    ('물건 찾기', '발견', '어디 있는지 묻다가 직접 발견함', '이미 찾은 물건의 위치를 다시 묻지 않고 발견에 호응한다.', '아, 거기 있었구나!'),
    ('가게 놀이', '주문', '음료를 주문하자 아이가 음료 이름을 말함', '아이의 놀이 설정을 받아 손님 역할로 한마디 한다.', '내가 주문한 커피구나. 고마워요!'),
    ('감정 대화', '돌봄', '우는 등장인물을 안아 달라고 함', '아이가 제안한 돌봄 행동을 말로 되짚는다.', '안아 주고 싶구나.'),
    ('감정 대화', '두려움', '아이가 무엇인지 밝히기 전에 무섭다고 말함', '먼저 감정을 받아 주고, 무엇이 무서웠는지 한 번만 묻는다.', '무서웠구나. 뭐가 무서웠어?'),
    ('함께 놀기', '반복', '아이가 방금 하던 것을 다시 해 달라고 함', '어떤 행동이었는지 앞 대화에서 찾아 같은 놀이를 반복한다.', '응, 한 번 더 해 보자.'),
    ('음식', '취향 표현', '피망 이야기에 아이가 맛있다고 반응함', '어른의 취향을 덧씌우지 않고 아이가 표현한 느낌을 받아 준다.', '너는 피망이 맛있구나!'),
]


def build(archive, target):
    groups = defaultdict(list)
    with ZipFile(archive) as z:
        name, = [n for n in z.namelist() if n.lower().endswith(".csv")]
        with io.TextIOWrapper(z.open(name), encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                groups[(r["코퍼스"], r["세션번호"])].append((int(r["발화ID(순서)"]), r["화자"], r["발화"]))
    topics = {k: re.compile(v[0]) for k,v in TOPICS.items()}
    intents = {k: re.compile(v[0]) for k,v in INTENTS.items()}
    counts = Counter()
    for rows in groups.values():
        rows.sort()
        previous = deque(maxlen=2)
        for (_, speaker, line), (_, following, _) in zip(rows, rows[1:]):
            if speaker == "아이" and following in {"엄마","아빠","할머니","할아버지"}:
                # Use the nearest turn with a topic; avoid carrying old topics across scenes.
                context = next(([k for k,p in topics.items() if p.search(s)]
                                for s in [line, *reversed(previous)] if any(p.search(s) for p in topics.values())), ["자유 대화"])
                for topic in context:
                    for intent, pattern in intents.items():
                        if pattern.search(line):
                            counts[topic,intent] += 1
            previous.append(line)
    target.parent.mkdir(exist_ok=True, parents=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as f:
        tmp = Path(f.name)
    try:
        with sqlite3.connect(tmp) as db:
            db.execute("CREATE TABLE cards(topic TEXT, intent TEXT, scene TEXT, strategy TEXT, example TEXT, hits INTEGER, PRIMARY KEY(topic,intent)) WITHOUT ROWID")
            for (topic,intent), hits in sorted(counts.items()):
                _, scene, strategy, reply = INTENTS[intent]
                db.execute("INSERT INTO cards VALUES(?,?,?,?,?,?)", (topic,intent,(TOPICS[topic][1]+"에 관한 대화 중 " if topic in TOPICS else "")+scene,strategy,reply,hits))
            for topic,intent,scene,strategy,example in CURATED:
                db.execute("""INSERT INTO cards VALUES(?,?,?,?,?,1)
                    ON CONFLICT(topic,intent) DO UPDATE SET scene=excluded.scene,
                    strategy=excluded.strategy, example=excluded.example""",
                    (topic,intent,scene,strategy,example))
        db.close()
        os.replace(tmp,target)
    finally:
        tmp.unlink(missing_ok=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("zip", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1]/"web/data/dialogue.sqlite")
    args = parser.parse_args()
    build(args.zip, args.output)
