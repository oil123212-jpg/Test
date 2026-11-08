import './style.css';
import './mobile.css';
import './profile.css';
import './contrast.css';
import { mountIcons } from './icons';
import { RealtimeConversation, realtimeErrors, type ConversationState } from './realtime-client';
import { mountLifeGuide } from './life-guide';
import { mountChildProfile } from './child-profile';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
// UI acknowledgement for this tab only; never a verified guardian/auth state.
let localAudioConsent = false;
let volume = .1;
let realtimeState: ConversationState = 'idle';
let realtimeAvailable = false;
let requiresAccessCode = false;
let toastTimeout: ReturnType<typeof setTimeout>;
mountIcons();
function toast(message: string, error = false) {
  clearTimeout(toastTimeout); $('toast').textContent = message;
  $('toast').classList.toggle('error', error); $('toast').hidden = false;
  toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 6500);
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
function updateConversationButtons() {
  $<HTMLButtonElement>('realtime-connect').disabled = !realtimeAvailable || realtimeState !== 'idle';
  $<HTMLButtonElement>('realtime-end').disabled = realtimeState === 'idle';
  for (const id of ['realtime-mute','realtime-interrupt']) $<HTMLButtonElement>(id).disabled = realtimeState === 'idle' || realtimeState === 'connecting';
}
const conversation = new RealtimeConversation({
  state(value) {
    realtimeState = value;
    const labels = { idle:'대화 준비', connecting:'연결 중', listening:'듣고 있어요', thinking:'답변 준비 중', speaking:'모모가 말하고 있어요' };
    $('realtime-status').textContent = labels[value];
    $('realtime-message').textContent = value === 'idle' ? '대화 시작을 누르면 마이크를 연결해요.' : value === 'connecting' ? '마이크와 AI를 연결하고 있어요…' : value === 'listening' ? '편하게 말해 주세요. 말이 끝나면 모모가 대답해요.' : value === 'thinking' ? '잠깐만요, 대답을 준비하고 있어요.' : '모모의 대답을 듣고 있어요.';
    $('conversation-orb').classList.toggle('active',value === 'speaking' || value === 'listening');
    if(value === 'idle') { $('realtime-mute').textContent='마이크 끄기'; $('realtime-mute').setAttribute('aria-pressed','false'); }
    updateConversationButtons();
  },
  error(code) { const message=realtimeErrors[code] || realtimeErrors.UPSTREAM_UNAVAILABLE; $('realtime-message').textContent=message; $('realtime-status').textContent='연결 확인 필요'; toast(message,true); },
  level(peak) { $('conversation-orb').style.setProperty('--voice-scale',String(1+Math.min(.2,peak*.3))); },
});
const childProfile = mountChildProfile(profile => conversation.updateProfile(profile), () => {if(localAudioConsent)void lifeGuide.login();else openConsent();});
const lifeGuide = mountLifeGuide(guide => conversation.updateLifeGuide(guide), () => { if (localAudioConsent) void lifeGuide.login(); else openConsent(); }, (value,error) => childProfile.session(value,error));
$('realtime-connect').addEventListener('click', () => {
  if(!requireAudioConsent()) return;
  if(!$<HTMLInputElement>('realtime-consent').checked) { $<HTMLInputElement>('realtime-consent').focus(); toast('실시간 음성 전송 안내에 동의해 주세요.'); return; }
  const code=$<HTMLInputElement>('realtime-access-code').value;
  if(requiresAccessCode && !code) { $<HTMLInputElement>('realtime-access-code').focus(); toast('이용 코드를 입력해 주세요.'); return; }
  conversation.stop();
  void conversation.start($<HTMLSelectElement>('input-device').value,$<HTMLSelectElement>('output-device').value,volume,code,lifeGuide.current(),childProfile.current());
  $<HTMLInputElement>('realtime-access-code').value='';
});
$('realtime-end').addEventListener('click', () => conversation.stop());
$('realtime-interrupt').addEventListener('click', () => conversation.interrupt());
$('realtime-mute').addEventListener('click', () => {
  const muted=conversation.toggleMute(); $('realtime-mute').textContent=muted?'마이크 켜기':'마이크 끄기'; $('realtime-mute').setAttribute('aria-pressed',String(muted));
});
$<HTMLInputElement>('realtime-consent').addEventListener('change', event => {
  if(!(event.target as HTMLInputElement).checked) conversation.stop();
});
void conversation.config().then(config => {
  realtimeAvailable=config.available; requiresAccessCode=config.requiresAccessCode;
  $('realtime-access-field').hidden=!requiresAccessCode;
  $('realtime-message').textContent=config.available ? '별도 전송 동의 후 대화 시작을 눌러 주세요.' : 'Railway에 OPENAI_API_KEY를 설정하면 대화할 수 있어요.';
  $('realtime-status').textContent=config.available?'연결 준비':'키 설정 필요'; updateConversationButtons();
}).catch(() => { $('realtime-message').textContent='대화 서버에 연결하지 못했어요. 잠시 후 새로고침해 주세요.'; });
const consentDialog = $<HTMLDialogElement>('consent-dialog');
const consentCheckbox = $<HTMLInputElement>('consent-checkbox');
const consentAccept = $<HTMLButtonElement>('consent-accept');
function updateConsentButton() {
  $('login-button').textContent = localAudioConsent ? '이용 종료' : '체험 로그인';
  $('login-button').setAttribute('aria-haspopup', localAudioConsent ? 'false' : 'dialog');
}
function openConsent() {
  consentCheckbox.checked = false;
  consentAccept.disabled = true;
  if (!consentDialog.open) consentDialog.showModal();
}
function endSession(message?: string) {
  lifeGuide.logout();
  localAudioConsent = false;
  $<HTMLInputElement>('realtime-consent').checked = false;
  $<HTMLInputElement>('realtime-access-code').value = '';
  consentCheckbox.checked = false; consentAccept.disabled = true;
  conversation.stop(); fillDevices([]);
  volume = .1; $<HTMLInputElement>('volume').value = '10'; $('volume-value').textContent = '10%';
  updateConsentButton(); updateConversationButtons();
  if (message) toast(message);
}
function requireAudioConsent() {
  if (localAudioConsent) return true;
  openConsent();
  return false;
}
$('login-button').addEventListener('click', () => {
  if (localAudioConsent) endSession('이용을 종료하고 동의와 임시 음성을 정리했어요.');
  else openConsent();
});
consentCheckbox.addEventListener('change', () => { consentAccept.disabled = !consentCheckbox.checked; });
$('consent-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!consentCheckbox.checked) { consentCheckbox.focus(); return; }
  localAudioConsent = true;
  void lifeGuide.login();
  updateConsentButton(); consentDialog.close('accepted');
  toast('동의를 확인했어요. 음성 전송 동의 후 대화 시작을 눌러 주세요.');
});
function declineConsent() {
  consentDialog.close('declined');
  endSession('동의하지 않았어요. 설정과 안내를 확인할 수 있어요.');
}
$('consent-decline').addEventListener('click', declineConsent);
$('consent-close').addEventListener('click', declineConsent);
consentDialog.addEventListener('cancel', event => { event.preventDefault(); declineConsent(); });
consentDialog.addEventListener('close', () => { consentCheckbox.checked = false; consentAccept.disabled = true; });
$('reset-session').addEventListener('click', () => {
  conversation.stop();fillDevices([]);
  volume=.1;$<HTMLInputElement>('volume').value='10';$('volume-value').textContent='10%';
  conversation.setVolume(volume);toast('오디오 설정을 초기화했어요.');
});
const settingsDialog=$<HTMLDialogElement>('settings-dialog');
const settingsTabs=[$('profile-tab'),$('audio-settings-tab')];
function selectSettingsTab(index:number) {
  settingsTabs.forEach((tab,position)=>{const active=index===position;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$(tab.getAttribute('aria-controls')!).hidden=!active;});
}
settingsTabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>selectSettingsTab(index));
  tab.addEventListener('keydown',event=>{
    const next=event.key==='Home'?0:event.key==='End'?1:['ArrowRight','ArrowLeft'].includes(event.key)?1-index:null;
    if(next!==null){event.preventDefault();selectSettingsTab(next);settingsTabs[next].focus();}
  });
});
$('open-settings').addEventListener('click', () => {selectSettingsTab(0);settingsDialog.showModal();void navigator.mediaDevices?.enumerateDevices().then(fillDevices).catch(()=>{});});
$('settings-close').addEventListener('click',()=>settingsDialog.close());
$('settings-done').addEventListener('click',()=>settingsDialog.close());
$('open-help').addEventListener('click', () => $<HTMLDialogElement>('help-dialog').showModal());
$<HTMLInputElement>('volume').addEventListener('input', event => {
  const value = Number((event.target as HTMLInputElement).value); volume = Math.max(.01, Math.min(.2, value / 100));
  $('volume-value').textContent = `${Math.round(volume * 100)}%`;
  conversation.setVolume(volume);
});
$<HTMLSelectElement>('output-device').disabled = !(typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype);
if (!(typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype)) $('output-note').textContent = '이 브라우저에서는 시스템 기본 스피커를 사용해요. 기기의 오디오 설정에서 바꿔 주세요.';
function route() {
  const name = location.hash.slice(1) || 'overview';
  const known = name === 'life-guide' ? 'life-guide' : 'overview';
  if (name !== known) history.replaceState(null, '', `${location.pathname}${location.search}#overview`);
  document.querySelectorAll<HTMLElement>('[data-route]').forEach(link => {
    const active = link.dataset.route === known; link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('overview-view').hidden = known === 'life-guide';
  $('life-guide-view').hidden = known !== 'life-guide';
  $('page-name').textContent = known === 'life-guide' ? '라이프 가이드' : '대시보드';
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
window.addEventListener('pagehide', () => {
  if (consentDialog.open) consentDialog.close();
  endSession();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) conversation.stop(); });
window.addEventListener('keydown', event => { if (event.key === 'Escape' && realtimeState !== 'idle') conversation.stop(); });
route(); updateConversationButtons(); updateConsentButton();
