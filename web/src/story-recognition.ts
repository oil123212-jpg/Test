interface LocalRecognition {
  lang: string;
  processLocally: boolean;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: {resultIndex: number; results: ArrayLike<{isFinal: boolean; 0: {transcript: string}}>}) => void) | null;
  onerror: ((ev: {error: string}) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
interface LocalRecognitionClass {
  new(): LocalRecognition;
  available(options: {langs: string[]; processLocally: boolean}): Promise<string>;
  install?(options: {langs: string[]; processLocally: boolean}): Promise<boolean>;
}
const options = {langs: ['ko-KR'], processLocally: true};

function localClass() {
  const browser = window as Window & {SpeechRecognition?: LocalRecognitionClass; webkitSpeechRecognition?: LocalRecognitionClass};
  return [browser.SpeechRecognition, browser.webkitSpeechRecognition].find(Ctor =>
    typeof Ctor?.available === 'function' && 'processLocally' in Ctor.prototype);
}

export async function prepareLocalRecognition() {
  const Ctor = localClass();
  if (!window.isSecureContext || !Ctor) return false;
  const state = await Ctor.available(options);
  if (state === 'available') return true;
  if (state !== 'downloadable' && state !== 'downloading') return false;
  return !!(await Ctor.install?.(options));
}

export function localRecognition() {
  const Ctor = localClass();
  if (!Ctor) return undefined;
  const recognition = new Ctor();
  recognition.processLocally = true;
  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = false;
  return recognition;
}
