import { createReader, type ReadingTurn } from '../shared/reader.mjs';
import { createStoryMatcher } from '../shared/story-match.mjs';
import { localRecognition, prepareLocalRecognition } from './story-recognition';
import './story-play.css';

export function mountStoryPlay(root: HTMLElement) {
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#story-${id}`)!;
  const book = get<HTMLSelectElement>('book'), role = get<HTMLSelectElement>('role');
  const start = get<HTMLButtonElement>('start'), next = get<HTMLButtonElement>('next');
  const replay = get<HTMLButtonElement>('replay'), skip = get<HTMLButtonElement>('skip');
  const status = get('status'), speaker = get('speaker'), line = get('line'), stage = get('stage');
  const auto = get<HTMLButtonElement>('auto'), setup = get('setup'), retry = get<HTMLButtonElement>('retry');
  let enabled = false, setupToken = 0;
  let recognition: ReturnType<typeof localRecognition>;
  let listeningTimer: ReturnType<typeof setTimeout> | undefined;
  let matcher: ReturnType<typeof createStoryMatcher> | undefined;
  let reader = createReader({});
  const run = (action: string, options = {}) => reader.run(JSON.stringify({ action, ...options }));
  const synth = window.speechSynthesis;
  let turn: ReadingTurn | undefined;
  let generation = 0, row = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let utterance: SpeechSynthesisUtterance | undefined;

  function stopListening() {
    clearTimeout(listeningTimer);
    const active = recognition;
    recognition = undefined;
    if (active) {
      active.onresult = active.onerror = active.onend = null;
      try { active.abort(); } catch { /* Already ended. */ }
    }
  }
  function cancel() {
    stopListening(); matcher = undefined;
    retry.hidden = true;
    generation++;
    clearTimeout(timer);
    if (utterance) { utterance = undefined; synth.cancel(); }
  }
  function reset() {
    cancel(); run('stop'); turn = undefined; stage.hidden = true;
    status.textContent = '역할극 시작을 누르면 바로 읽어요.';
  }
  function leave() {
    setupToken++; enabled = false;
    auto.disabled = false; auto.setAttribute('aria-pressed', 'false');
    auto.textContent = '자동 넘김 켜기'; setup.textContent = '';
    reset();
  }
  function chooseBook() {
    reset();
    const selection = run('choose', { book: book.value });
    role.replaceChildren();
    if ('roles' in selection) for (const name of selection.roles) role.add(new Option(name, name));
    start.disabled = !role.value;
  }
  function waiting() {
    if (!turn) return;
    skip.hidden = true;
    next.hidden = turn.finished;
    speaker.textContent = turn.finished ? '이야기 끝!' : `내 차례 · ${turn.role}`;
    line.textContent = turn.finished ? '함께 읽어서 즐거웠어!' : turn.cue;
    status.textContent = turn.finished ? '다른 역할로 다시 시작할 수 있어요.' : '소리 내어 읽어요. 필요하면 직접 넘길 수 있어요.';
    if (!turn.finished && enabled) listen();
  }
  function listen() {
    if (!turn || turn.finished || next.hidden || !enabled || recognition) return;
    matcher ??= createStoryMatcher(turn.cue);
    retry.hidden = true;
    let active: ReturnType<typeof localRecognition>;
    try { active = localRecognition(); } catch { active = undefined; }
    const pause = (message: string) => {
      stopListening(); retry.hidden = false; status.textContent = message;
    };
    if (!active) { pause('이 기기에서는 자동 넘김을 사용할 수 없어요.'); return; }
    recognition = active;
    let processed = 0;
    active.onresult = event => {
      if (recognition !== active) return;
      for (let i = Math.max(processed, event.resultIndex); i < event.results.length; i++) {
        if (!event.results[i].isFinal) break;
        processed = i + 1;
        if (matcher?.accept(event.results[i][0].transcript)) { play('next'); return; }
      }
    };
    active.onend = () => {
      if (recognition === active) pause('아직 다음 차례로 넘어가지 않았어요. 이어 읽거나 직접 넘겨도 좋아요.');
    };
    active.onerror = event => {
      if (recognition !== active) return;
      pause(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? '마이크 권한을 확인하거나 직접 넘겨 주세요.'
        : '잘 듣지 못했어요. 다시 들려주거나 직접 넘겨도 좋아요.');
    };
    try {
      active.start();
      status.textContent = '듣고 있어요. 편하게 소리 내어 읽어 보세요.';
      listeningTimer = setTimeout(() => pause('잠깐 쉬어도 좋아요. 준비되면 이어 읽을 수 있어요.'), 30000);
    } catch { pause('마이크를 시작하지 못했어요. 다시 시도하거나 직접 넘겨 주세요.'); }
  }
  function speakRow() {
    if (!turn) return;
    const entry = turn.narration[row];
    if (!entry) { waiting(); return; }
    const [name, text] = entry;
    speaker.textContent = `모모 차례 · ${name}`; line.textContent = text;
    status.textContent = '모모가 읽어주고 있어요.';
    next.hidden = true; skip.hidden = false;
    const token = ++generation;
    const failed = () => {
      if (token !== generation) return;
      cancel(); status.textContent = '기기 음성으로 읽지 못했어요. 화면의 대사를 읽고 다음으로 넘어갈 수 있어요.';
    };
    try {
      const voice = synth?.getVoices().find(v => v.localService && /^ko(?:[-_]|$)/i.test(v.lang));
      if (!voice) { failed(); return; }
      const speech = new SpeechSynthesisUtterance(text);
      utterance = speech; speech.voice = voice; speech.lang = 'ko-KR'; speech.rate = .85;
      speech.onend = () => {
        if (token !== generation) return;
        clearTimeout(timer); utterance = undefined; row++; speakRow();
      };
      speech.onerror = failed;
      timer = setTimeout(failed, Math.max(15000, text.length * 450));
      synth.speak(speech);
    } catch { failed(); }
  }
  function play(action: string) {
    cancel();
    const result = run(action, action === 'start' ? {book: book.value, role: role.value} : {});
    if (!('cue' in result)) return;
    turn = result; row = 0; stage.hidden = false; replay.disabled = !turn.narration.length;
    speakRow();
  }
  let loading = false;
  async function open() {
    if (loading || book.options.length) return;
    loading = true;
    status.textContent = '책장을 여는 중이에요.';
    try {
      const endpoint = location.hostname === 'oil123212-jpg.github.io'
        ? 'https://test-production-a904.up.railway.app/api/books' : '/api/books';
      const response = await fetch(endpoint, {credentials:'omit'});
      if (!response.ok) throw new Error();
      const books = await response.json();
      reader = createReader(books);
      for (const title of Object.keys(books)) book.add(new Option(title, title));
      chooseBook();
    } catch {
      status.textContent = '책장을 열 수 없어요. 잠시 후 다시 들어와 주세요.';
    } finally { loading = false; }
  }
  // Request the voice list early so browsers that initialize it asynchronously can populate it.
  synth?.getVoices();
  book.addEventListener('change', chooseBook);
  role.addEventListener('change', () => { reset(); start.disabled = !role.value; });
  start.addEventListener('click', () => play('start'));
  next.addEventListener('click', () => { if (turn && !next.hidden && !turn.finished) play('next'); });
  replay.addEventListener('click', () => { if (turn) play('repeat'); });
  skip.addEventListener('click', () => { if (turn && !skip.hidden) { cancel(); row++; speakRow(); } });
  retry.addEventListener('click', listen);
  auto.addEventListener('click', async () => {
    if (enabled) {
      enabled = false; stopListening(); matcher = undefined; retry.hidden = true;
      auto.setAttribute('aria-pressed', 'false'); auto.textContent = '자동 넘김 켜기';
      setup.textContent = '자동 넘김을 껐어요.';
      if (turn && !turn.finished && !next.hidden) status.textContent = '소리 내어 읽고 직접 넘길 수 있어요.';
      return;
    }
    const token = ++setupToken;
    auto.disabled = true; setup.textContent = '한국어 기기 음성 인식을 준비하고 있어요…';
    let ready = false;
    try { ready = await prepareLocalRecognition(); } catch { /* Manual mode remains available. */ }
    if (token !== setupToken) return;
    auto.disabled = false; enabled = ready;
    auto.setAttribute('aria-pressed', String(ready));
    auto.textContent = ready ? '자동 넘김 끄기' : '자동 넘김 켜기';
    setup.textContent = ready ? '아이 차례에만 마이크로 들어요.' : '한국어 기기 음성 인식을 사용할 수 없어요. 직접 넘길 수 있어요.';
    if (ready) listen();
  });
  get('stop').addEventListener('click', () => { leave(); start.focus(); });
  chooseBook();
  return { reset: leave, open };
}
