import './style.css';
import { mountIcons } from './icons';
import { AudioEngine } from './audio-engine';
import { demoRecording, waveform, wipe, type RecordingData } from './audio-utils';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const engine = new AudioEngine();
let recording: RecordingData | null = null;
let mode: 'microphone' | 'demo' = 'microphone';
let state: 'idle' | 'requesting' | 'recording' | 'processing' | 'playing' = 'idle';
let operationId = 0;
let microphoneChecked = false;
let volume = .1;
let toastTimeout: ReturnType<typeof setTimeout>;
mountIcons();
function toast(message: string, error = false) {
  clearTimeout(toastTimeout); $('toast').textContent = message;
  $('toast').classList.toggle('error', error); $('toast').hidden = false;
  toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 6500);
}
function updateState(next = state) {
  state = next;
  const busy = next !== 'idle';
  for (const id of ['record', 'mode-microphone', 'mode-demo', 'try-demo', 'check-microphone', 'input-device', 'test-speaker']) $<HTMLButtonElement>(id).disabled = busy;
  $<HTMLButtonElement>('check-microphone').disabled = busy || mode === 'demo';
  $<HTMLSelectElement>('input-device').disabled = busy || mode === 'demo';
  $<HTMLButtonElement>('play').disabled = busy || !recording;
  $<HTMLButtonElement>('clear').disabled = !recording || busy;
  $<HTMLButtonElement>('stop').disabled = !busy;
  $('audio-state').textContent = { idle: recording ? '녹음 완료' : '준비됨', requesting: '권한 확인 중', recording: '녹음 중', processing: '변환 중', playing: '재생 중' }[next];
  $('audio-state').classList.toggle('busy', busy);
  $('buffer-status').textContent = recording ? `${(recording.pcm.length / recording.sampleRate).toFixed(1)}초 · 메모리에만` : '비어 있음';
  $('record-label').textContent = mode === 'demo' ? '데모 녹음 만들기' : '5초 녹음하기';
  $('microphone-status').textContent = microphoneChecked ? '권한 확인됨 · 사용 종료' : '확인 전';
  if (next === 'recording') $('microphone-status').textContent = '녹음 중 · 마이크 사용';
}
function draw(levels: number[] = []) {
  const canvas = $<HTMLCanvasElement>('waveform'), ctx = canvas.getContext('2d')!;
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height); ctx.strokeStyle = '#e9eddf'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
  const bins = levels.length || 84;
  for (let i = 0; i < bins; i++) {
    const value = levels[i] || 0, bar = Math.max(4, Math.min(1, value * 2) * 130);
    ctx.fillStyle = value > 0 ? '#9eae85' : '#c7d0b9'; ctx.beginPath();
    ctx.roundRect(i * width / bins + 2, (height - bar) / 2, Math.max(3, width / bins - 5), bar, 3); ctx.fill();
  }
}
function resetAudio(message?: string) {
  operationId++; engine.cancel(); wipe(recording); recording = null;
  $('wave-label').textContent = mode === 'demo' ? '합성 음원으로 안전하게 체험해요' : '당신의 목소리를 기다리고 있어요';
  $('recording-clock').innerHTML = '00:00 <span>/ 00:05</span>';
  $('signal-label').textContent = mode === 'demo' ? '데모 음원 · 실제 녹음 아님' : '마이크 대기 중';
  draw(); updateState('idle'); if (message) toast(message);
}
function selectMode(next: typeof mode) {
  resetAudio(); mode = next;
  for (const name of ['microphone', 'demo']) {
    const selected = name === mode; $(`mode-${name}`).classList.toggle('selected', selected);
    $(`mode-${name}`).setAttribute('aria-pressed', String(selected));
  }
  resetAudio();
}
function showRecording() {
  if (!recording) return;
  $('wave-label').textContent = recording.source === 'demo' ? '합성 음원이에요. 다시 듣기를 눌러 보세요' : '녹음했어요. 다시 듣기를 눌러 확인하세요';
  $('recording-clock').innerHTML = '00:05 <span>/ 00:05</span>';
  $('signal-label').textContent = `RMS ${recording.rms.toFixed(3)} · peak ${recording.peak.toFixed(3)}${recording.clipped ? ' · 클리핑 감지' : ' · 클리핑 없음'}`;
  draw(waveform(recording.pcm)); updateState('idle');
}
function errorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : '', message = error instanceof Error ? error.message : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return '마이크 접근이 허용되지 않았어요. 브라우저 권한을 확인하거나 데모 음원을 사용해 주세요.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '선택한 마이크가 없어요. 연결한 장치를 확인하고 다시 선택해 주세요.';
  if (name === 'NotReadableError' || message === 'DeviceDisconnected') return '마이크를 사용할 수 없어요. 연결 상태와 다른 앱의 장치 사용을 확인해 주세요.';
  if (message === 'SecureContextRequired') return '마이크는 HTTPS 또는 로컬 개발 환경에서 사용할 수 있어요. 지금은 데모 음원으로 체험할 수 있어요.';
  if (message === 'WebAudioRequired') return '이 브라우저는 필요한 오디오 기능을 지원하지 않아요. 최신 Chrome, Edge 또는 Safari로 시도해 주세요.';
  if (message === 'CaptureTimeout') return '마이크 입력이 도착하지 않아 중단했어요. 장치를 다시 연결해 주세요.';
  return '오디오를 처리하지 못했어요. 장치 연결을 확인하고 다시 시도해 주세요.';
}
async function run(next: typeof state, action: (id: number) => Promise<void>) {
  const id = ++operationId; updateState(next);
  try { await action(id); }
  catch (error) {
    if (id === operationId && !(error instanceof Error && error.name === 'AbortError')) {
      if (next === 'requesting') microphoneChecked = false;
      toast(errorMessage(error), true);
    }
  }
  finally { if (id === operationId) updateState('idle'); }
}
function fillDevices(devices: MediaDeviceInfo[]) {
  for (const [id, kind, fallback] of [['input-device', 'audioinput', '시스템 기본 마이크'], ['output-device', 'audiooutput', '시스템 기본 스피커']]) {
    const select = $<HTMLSelectElement>(id), previous = select.value;
    select.replaceChildren(new Option(fallback, ''));
    devices.filter(device => device.kind === kind && device.deviceId !== 'default' && device.deviceId !== 'communications').forEach((device, index) => {
      select.add(new Option(device.label || `${kind === 'audioinput' ? '마이크' : '스피커'} ${index + 1}`, device.deviceId));
    });
    if (Array.from(select.options).some(option => option.value === previous)) select.value = previous;
  }
}
$('mode-microphone').addEventListener('click', () => selectMode('microphone'));
$('mode-demo').addEventListener('click', () => selectMode('demo'));
$('try-demo').addEventListener('click', () => {
  selectMode('demo'); recording = demoRecording(); showRecording();
  $('audio-lab').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
  toast('마이크를 사용하지 않는 합성 음원을 준비했어요. 다시 듣기를 눌러 보세요.');
});
$('record').addEventListener('click', () => {
  if (mode === 'demo') { wipe(recording); recording = demoRecording(); showRecording(); return; }
  wipe(recording); recording = null; draw();
  void run('requesting', async id => {
    const levels: number[] = [];
    const result = await engine.record($<HTMLSelectElement>('input-device').value,
      () => { if (id === operationId) { microphoneChecked = true; updateState('recording'); $('wave-label').textContent = '목소리를 듣고 있어요. 스피커로 출력하지 않아요'; } },
      (elapsed, peak) => {
        if (id !== operationId) return;
        levels.push(peak); if (levels.length > 84) levels.shift(); draw(levels);
        $('recording-clock').innerHTML = `00:0${Math.min(5, Math.floor(elapsed))} <span>/ 00:05</span>`;
        $('signal-label').textContent = peak >= .999 ? '클리핑 감지 · 입력 음량을 낮춰 주세요' : `입력 peak ${peak.toFixed(3)}`;
        if (elapsed >= 5) updateState('processing');
      });
    if (id !== operationId) { wipe(result); return; }
    recording = result; showRecording(); toast('녹음이 끝나 마이크를 닫았어요. 직접 다시 듣기를 눌러 주세요.');
  });
});
$('check-microphone').addEventListener('click', () => void run('requesting', async id => {
  const devices = await engine.inspectInput($<HTMLSelectElement>('input-device').value);
  if (id !== operationId) return;
  microphoneChecked = true; fillDevices(devices); toast('마이크 권한과 장치를 확인했어요. 녹음은 시작하지 않았어요.');
}));
$('play').addEventListener('click', () => {
  if (!recording) return;
  const current = recording;
  void run('playing', async id => {
    await engine.play(current, volume, $<HTMLSelectElement>('output-device').value);
    if (id === operationId) toast('재생을 마쳤어요. 녹음은 이 탭에만 있어요.');
  });
});
$('test-speaker').addEventListener('click', () => void run('playing', async id => {
  toast('기기 볼륨을 낮춰 주세요. 짧은 테스트 소리를 재생해요.');
  await engine.tone(volume, $<HTMLSelectElement>('output-device').value);
  if (id === operationId) toast('테스트 음원 재생을 마쳤어요. 실제로 들렸는지 확인해 주세요.');
}));
$('stop').addEventListener('click', () => resetAudio('작업을 중단하고 임시 음성을 정리했어요.'));
$('clear').addEventListener('click', () => resetAudio('녹음 데이터를 지웠어요.'));
$('reset-session').addEventListener('click', () => {
  selectMode('microphone');
  microphoneChecked = false; fillDevices([]);
  volume = .1; $<HTMLInputElement>('volume').value = '10'; $('volume-value').textContent = '10%';
  updateState(); toast('세션의 음성과 체크 상태를 모두 지웠어요.');
  document.querySelectorAll<HTMLInputElement>('.checklist input').forEach(input => { input.checked = false; });
  $('checklist-count').textContent = '0 / 5 확인';
});
$('open-settings').addEventListener('click', () => $<HTMLDialogElement>('settings-dialog').showModal());
$('open-help').addEventListener('click', () => $<HTMLDialogElement>('help-dialog').showModal());
$<HTMLInputElement>('volume').addEventListener('input', event => {
  const value = Number((event.target as HTMLInputElement).value); volume = Math.max(.01, Math.min(.2, value / 100));
  $('volume-value').textContent = `${Math.round(volume * 100)}%`;
});
$<HTMLSelectElement>('output-device').disabled = !engine.canSelectOutput;
if (!engine.canSelectOutput) $('output-note').textContent = '이 브라우저에서는 시스템 기본 스피커를 사용해요. 기기의 오디오 설정에서 바꿔 주세요.';
document.querySelectorAll('.checklist input').forEach(input => input.addEventListener('change', () => {
  $('checklist-count').textContent = `${document.querySelectorAll('.checklist input:checked').length} / 5 확인`;
}));
function route() {
  const name = location.hash.slice(1) || 'overview';
  const known = ['overview', 'audio', 'privacy', 'checklist'].includes(name) ? name : 'overview';
  if ((known === 'privacy' || known === 'checklist') && state !== 'idle') resetAudio('진행 중인 오디오 작업을 중단했어요.');
  for (const view of ['overview', 'privacy', 'checklist']) $(`${view}-view`).hidden = view !== (known === 'audio' ? 'overview' : known);
  document.querySelectorAll<HTMLElement>('[data-route]').forEach(link => {
    const active = link.dataset.route === known; link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('page-name').textContent = { overview: '대시보드', audio: '오디오 테스트', privacy: '개인정보 보호', checklist: '준비 체크리스트' }[known]!;
  if (known === 'audio') $('audio-lab').scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
window.addEventListener('pagehide', () => resetAudio());
document.addEventListener('visibilitychange', () => { if (document.hidden) resetAudio('탭이 비활성화되어 임시 음성을 정리했어요.'); });
window.addEventListener('keydown', event => { if (event.key === 'Escape' && state !== 'idle') resetAudio('작업을 중단했어요.'); });
route(); draw(); updateState();
