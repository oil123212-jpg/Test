import { clearMemory } from './device-memory';
import './style.css';
import './mobile.css';
import './profile.css';
import './contrast.css';
import './welcome.css';
import { mountIcons } from './icons';
import { RealtimeConversation, realtimeErrors, type ConversationState } from './realtime-client';
import { mountLifeGuide } from './life-guide';
import { mountStoryPlay } from './story-play';
import { mountChildProfile } from './child-profile';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
// UI acknowledgement for this tab only; never a verified guardian/auth state.
let localAudioConsent = false;
let authenticated = false;
const accountChannel = typeof BroadcastChannel==='function' ? new BroadcastChannel('momo-account-change') : null;
if(accountChannel)accountChannel.onmessage=()=>location.reload();
async function auth(action:string, data?:unknown, method = data===undefined?'GET':'POST') {
  const res=await fetch('/api/auth/'+action,{method,credentials:'same-origin',cache:'no-store',
    headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
  const result=await res.json();
  if(!res.ok)throw Error(result.code||'ACCOUNT_UNAVAILABLE');
  return result;
}
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
const faces = {hello:'인사하는', listening:'귀 기울이는', thinking:'생각하는', speaking:'이야기하는', singing:'노래하는', sleepy:'눈을 감은'};
type Face = keyof typeof faces;
let contentFace: Face | null = null;
function showFace(state: ConversationState) {
  const face = contentFace ?? ({idle:'hello', connecting:'thinking', listening:'listening', thinking:'thinking', speaking:'speaking'} as const)[state];
  const element = $('conversation-face');
  element.dataset.face = face;
  element.setAttribute('aria-label', faces[face] + ' 모모');
}
const conversation = new RealtimeConversation({
  expression(value) {
    contentFace = Object.hasOwn(faces,value) ? value as Face : null;
    showFace(realtimeState);
  },
  readingCue(role,text){const cue=$('reading-cue');cue.hidden=!text;cue.textContent=text?role+' 차례 · '+text:'';},
  state(value) {
    realtimeState = value;
    if (value === 'idle') contentFace = null;
    showFace(value);
    $('momo-state-line').dataset.state=value;
    const labels = { idle:'대화 준비', connecting:'연결 중', listening:'듣고 있어요', thinking:'답변 준비 중', speaking:'모모가 말하고 있어요' };
    $('realtime-status').textContent = labels[value];
    $('realtime-message').textContent = value === 'idle' ? '대화 시작을 누르면 마이크를 연결해요.' : value === 'connecting' ? '마이크와 AI를 연결하고 있어요…' : value === 'listening' ? '네 차례야. 모모가 듣고 있어.' : value === 'thinking' ? '잠깐만, 모모가 생각하고 있어.' : '이번엔 모모가 이야기할게.';
    $('conversation-orb').classList.toggle('active',value === 'speaking' || value === 'listening');
    if(value === 'idle') { $('realtime-mute').textContent='마이크 끄기'; $('realtime-mute').setAttribute('aria-pressed','false'); }
    updateConversationButtons();
  },
  error(code) { const message=realtimeErrors[code] || realtimeErrors.UPSTREAM_UNAVAILABLE; $('realtime-message').textContent=message; $('realtime-status').textContent='연결 확인 필요'; toast(message,true); },
  level(peak) { $('conversation-orb').style.setProperty('--voice-scale',String(1+Math.min(.2,peak*.3))); },
});
const memoryChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('momo-forget-topic'):null;
function forgetTopic(){
  clearMemory(); conversation.stop(); memoryChannel?.postMessage('forget');
  if(authenticated)void auth('history',undefined,'DELETE').then(()=>toast('계정의 대화 로그를 지웠어요.')).catch(()=>toast('대화 로그 삭제에 실패했어요. 다시 시도해 주세요.',true));
}
if(memoryChannel) memoryChannel.onmessage=()=>conversation.stop();
$('forget-topic').addEventListener('click',()=>{
  forgetTopic();

});
const childProfile = mountChildProfile(profile => conversation.updateProfile(profile), () => {if(localAudioConsent)void lifeGuide.login();else openLogin();},forgetTopic,()=>{if(settingsDialog.dataset.onboarding) settingsDialog.close();});
const lifeGuide = mountLifeGuide(guide => conversation.updateLifeGuide(guide), () => { if (localAudioConsent) void lifeGuide.login(); else openLogin(); }, (value,error) => childProfile.session(value,error));
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
  $('child-profile-form').hidden = !localAudioConsent;
  $('profile-login').hidden = localAudioConsent;
  $('login-button').textContent = authenticated ? '로그아웃' : '로그인';
  $('login-button').setAttribute('aria-haspopup', localAudioConsent ? 'false' : 'dialog');
}
const loginDialog = $<HTMLDialogElement>('login-screen');
function openLogin() {
  if(authenticated){openConsent();return;}
  if(!loginDialog.open)loginDialog.showModal();
}
async function restore(offerConsent=false) {
  const state=await auth('session');
  authenticated=state.authenticated;localAudioConsent=authenticated && state.consent;
  const google=$<HTMLButtonElement>('login-google');
  google.disabled=!state.google;
  $('google-status').hidden=!!state.google;
  updateConsentButton();
  if(localAudioConsent)await lifeGuide.login();
  else if(authenticated && offerConsent)openConsent();
}
$('login-google').addEventListener('click',()=>location.assign('/api/auth/google'));
$('account-login-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const submitter=(event as SubmitEvent).submitter;
  const username=$<HTMLInputElement>('account-name'),password=$<HTMLInputElement>('account-password');
  const buttons=Array.from($('account-login-form').querySelectorAll('button'));
  for(const b of buttons)b.disabled=true;
  try {
    await auth(submitter?.id==='account-register'?'register':'login',{username:username.value,password:password.value});
    password.value='';username.value='';$('account-error').textContent='';loginDialog.close();
    accountChannel?.postMessage('changed');
    await restore(true);
  }catch(e){$('account-error').textContent=e instanceof Error && e.message==='NAME_UNAVAILABLE'?'이미 사용 중인 아이디예요.':e instanceof Error && e.message==='INVALID_CREDENTIALS'?'아이디와 비밀번호를 확인해 주세요.':'로그인할 수 없어요. 잠시 후 다시 시도해 주세요.';}
  finally{for(const b of buttons)b.disabled=false;}
});
$('login-back').addEventListener('click',()=>loginDialog.close());
$('profile-login').addEventListener('click',openLogin);
function openConsent() {
  consentCheckbox.checked = false;
  consentAccept.disabled = true;
  if (!consentDialog.open) consentDialog.showModal();
}
function endSession(message?: string) {
  storyPlay.reset();
  lifeGuide.logout(); authenticated=false; clearMemory();
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
  openLogin();
  return false;
}
$('login-button').addEventListener('click', () => {
  if (authenticated) void signOut();
  else openLogin();
});
async function signOut(){
  conversation.stop();
  try{await auth('logout',{});endSession();accountChannel?.postMessage('changed');location.replace(location.pathname);}
  catch{toast('로그아웃을 완료하지 못했어요. 다시 시도해 주세요.',true);}
}
consentCheckbox.addEventListener('change', () => { consentAccept.disabled = !consentCheckbox.checked; });
$('consent-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!consentCheckbox.checked) { consentCheckbox.focus(); return; }
  try{await auth('consent',{policy:'account-log-48h-v1',accepted:true});}
  catch{toast('동의를 저장하지 못했어요. 다시 시도해 주세요.',true);return;}
  localAudioConsent = true;
  void lifeGuide.login();
  updateConsentButton(); consentDialog.close('accepted');
  selectSettingsTab(0);
  settingsDialog.dataset.onboarding = 'true';
  $('settings-title').textContent = '아이 정보 입력';
  $('profile-skip').hidden = false;
  if (!settingsDialog.open) settingsDialog.showModal();
  $('profile-name').focus();

});
async function declineConsent() {
  try{await auth('consent',{policy:'account-log-48h-v1',accepted:false});consentDialog.close('declined');await signOut();}
  catch{toast('동의 여부를 저장하지 못했어요.',true);}
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
$('profile-skip').addEventListener('click',()=>settingsDialog.close());
settingsDialog.addEventListener('close',()=>{
  delete settingsDialog.dataset.onboarding;
  $('settings-title').textContent = '설정';
  $('profile-skip').hidden = true;
});
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
const storyPlay = mountStoryPlay($('story-play-view'));
function route() {
  const name = location.hash.slice(1) || 'overview';
  const known = name === 'life-guide' || name === 'story-play' ? name : 'overview';
  if (name !== known) history.replaceState(null, '', `${location.pathname}${location.search}#overview`);
  document.querySelectorAll<HTMLElement>('[data-route]').forEach(link => {
    const active = link.dataset.route === known; link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('overview-view').hidden = known !== 'overview';
  $('story-play-view').hidden = known !== 'story-play';
  if (known === 'story-play') { conversation.stop(); void storyPlay.open(); } else storyPlay.reset();
  $('life-guide-view').hidden = known !== 'life-guide';
  $('page-name').textContent = known === 'life-guide' ? '라이프 가이드' : known === 'story-play' ? '동화 역할극' : '대시보드';
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
window.addEventListener('pagehide', () => {
  if (consentDialog.open) consentDialog.close();
  conversation.stop();storyPlay.reset();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { conversation.stop(); storyPlay.reset(); } });
window.addEventListener('keydown', event => { if (event.key === 'Escape' && realtimeState !== 'idle') conversation.stop(); });
route(); updateConversationButtons(); updateConsentButton();

window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
clearMemory();
const oauthStatus=new URLSearchParams(location.search).get('login');
if(oauthStatus){history.replaceState(null,'',location.pathname+location.hash);if(oauthStatus==='failed')toast('구글 로그인을 완료하지 못했어요.',true);}
void restore(oauthStatus==='ok').catch(()=>{updateConsentButton();});
