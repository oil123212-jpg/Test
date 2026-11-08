import { emptyLifeGuide, LIFE_ACTIVITIES, parseLifeGuide, slotLabel, type LifeActivity, type LifeGuide } from '../shared/life-guide.mjs';
import { PARENT_SETTINGS_POLICY } from '../shared/child-profile.mjs';
export function mountLifeGuide(onChange: (guide: LifeGuide) => void, requestLogin: () => void, onSession: (loggedIn:boolean,error?:unknown) => void) {
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const enabled = element<HTMLInputElement>('life-guide-enabled');
  const zone = element<HTMLSelectElement>('life-guide-timezone');
  const status = element('life-guide-save-status');
  let guide = emptyLifeGuide();
  let draftSlots = emptyLifeGuide().slots;
  let draftDirty = false;
  let loggedIn = false, busy = false, generation = 0, sessionId: string | null = null;
  let controller: AbortController | null = null;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('momo.life-guide') : null;
  let deviceZone = 'Asia/Seoul';
  try { deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
  const zones = new Set(['Asia/Seoul', deviceZone, guide.timeZone, 'UTC']);
  for (const value of zones) zone.add(new Option(value === 'Asia/Seoul' ? '한국 시간 (Asia/Seoul)' : value === deviceZone ? `이 기기의 시간대 (${value})` : value, value));
  const categories = element('life-guide-categories');
  for (const [activity, label] of Object.entries(LIFE_ACTIVITIES) as [LifeActivity, string][]) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'card life-guide-category';
    const legend = document.createElement('legend'); legend.textContent = label; fieldset.append(legend);
    const summary = document.createElement('p'); summary.id = `life-guide-${activity}-summary`; summary.className = 'life-guide-selection'; fieldset.append(summary);
    const timeLabel = document.createElement('label'); timeLabel.className = 'field-label'; timeLabel.htmlFor = `life-${activity}-time`; timeLabel.textContent = '시간 선택';
    const select = document.createElement('select'); select.id = timeLabel.htmlFor; select.dataset.activity = activity; select.className = 'life-guide-time'; select.setAttribute('aria-label',`${label} 시간 선택`);
    select.add(new Option('시간 선택', ''));
    for (let period = 0; period < 4; period++) {
      const group = document.createElement('optgroup'); group.label = ['새벽', '아침', '오후', '저녁'][period];
      for (let slot = period * 12; slot < (period + 1) * 12; slot++) group.append(new Option(slotLabel(slot),String(slot)));
      select.append(group);
    }
    select.addEventListener('change', () => {
      if (select.value === '') return;
      const slot = Number(select.value);
      if (Number.isInteger(slot) && slot >= 0 && slot < 48 && !draftSlots[activity].includes(slot)) {
        draftSlots[activity].push(slot); draftSlots[activity].sort((a,b) => a-b);
      }
      select.value = ''; dirty();
    });
    const selected = document.createElement('ul'); selected.id = `life-${activity}-selected`; selected.className = 'life-guide-selected'; selected.setAttribute('aria-label',`${label} 선택한 시간`);
    fieldset.append(timeLabel, select, selected);
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'text-button'; clear.textContent = `${label} 선택 비우기`;
    clear.addEventListener('click', () => { draftSlots[activity] = []; dirty(); });
    fieldset.append(clear); categories.append(fieldset);
  }
  function readDraft(): LifeGuide {
    return parseLifeGuide({ version: 1, enabled: enabled.checked, timeZone: zone.value, slots:draftSlots });
  }
  function summaries() {
    const draft = readDraft();
    for (const activity of Object.keys(LIFE_ACTIVITIES) as LifeActivity[]) {
      const values = draft.slots[activity];
      element(`life-guide-${activity}-summary`).textContent = values.length ? `${values.length}개 선택` : '선택한 시간이 없어요';
      const list = element(`life-${activity}-selected`); list.replaceChildren();
      for (const slot of values) {
        const item = document.createElement('li');
        const text = document.createElement('span'); text.textContent = slotLabel(slot);
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label',`${LIFE_ACTIVITIES[activity]} ${slotLabel(slot)} 삭제`);
        remove.disabled = busy;
        remove.addEventListener('click', () => {
          draftSlots[activity] = draftSlots[activity].filter(value => value !== slot); dirty(); element(`life-${activity}-time`).focus();
        });
        item.append(text,remove); list.append(item);
      }
      const select = element<HTMLSelectElement>(`life-${activity}-time`);
      for (const option of select.options) if (option.value !== '') option.disabled = values.includes(Number(option.value));
    }
  }
  function render() {
    renderDraft(guide); draftDirty = false; updateConversationStatus(); controls();
  }
  function renderDraft(value: LifeGuide) {
    const draft = parseLifeGuide(value);
    if (!zones.has(draft.timeZone)) { zones.add(draft.timeZone); zone.add(new Option(draft.timeZone,draft.timeZone)); }
    enabled.checked = draft.enabled; zone.value = draft.timeZone; draftSlots = draft.slots;
    summaries();
  }
  function controls() {
    element('life-guide-form').querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input,select,button').forEach(input => { input.disabled = busy; });
    element<HTMLButtonElement>('life-guide-delete').disabled = !loggedIn || busy;
    element<HTMLButtonElement>('life-guide-login').disabled = busy;
    element('life-guide-login').hidden = loggedIn;
  }
  function updateConversationStatus() {
    element('life-guide-conversation-status').textContent = guide.enabled ? `라이프가이드 연결 켜짐 · ${guide.timeZone} 기준, 해당 시간대에 가끔 생활 이야기를 건네요.` : '라이프가이드 연결 꺼짐 · 부모님 페이지에서 생활 시간을 설정할 수 있어요.';
  }
  function dirty() { draftDirty = true; summaries(); status.textContent = '변경한 내용이 있어요. 저장하고 적용을 눌러 주세요.'; }
  enabled.addEventListener('change',dirty); zone.addEventListener('change',dirty);
  const errorMessage = (error: unknown) => {
    const code = error instanceof Error ? error.message : '';
    if (code === 'DATABASE_NOT_CONFIGURED') return 'DB 연결 설정이 필요해요. Railway 웹 서비스의 DATABASE_URL을 확인해 주세요.';
    if (code === 'LOGIN_REQUIRED') return '저장용 로그인이 만료됐어요. 로그인하고 불러오기를 다시 눌러 주세요.';
    if (code === 'DATABASE_UNAVAILABLE') return 'DB에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
    return '서버에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.';
  };
  async function api(method: string, path = '', value?: unknown, signal?: AbortSignal) {
    const response = await fetch('/api/life-guide' + path, {method,credentials:'same-origin',cache:'no-store',signal,
      headers: value ? {'Content-Type':'application/json'} : {}, body:value ? JSON.stringify(value) : undefined});
    const result = await response.json();
    if (!response.ok) { if (response.status === 401) { loggedIn = false; onSession(false); controls(); } throw new Error(result.code); }
    return result;
  }
  async function login() {
    const pendingDraft = draftDirty ? readDraft() : null;
    const id = ++generation; controller?.abort(); controller = new AbortController();
    busy = true; controls(); status.textContent = 'DB에서 이 브라우저의 생활 시간을 불러오고 있어요…';
    try {
      const result = await api('POST','/login',{consent:true,policy:PARENT_SETTINGS_POLICY},controller.signal);
      if (id !== generation) return;
      sessionId = result.sessionId;
      const saved = await api('GET','',undefined,controller.signal);
      if (id !== generation) return;
      guide = saved.schedule ? parseLifeGuide({...saved.schedule,enabled:false}) : emptyLifeGuide();
      loggedIn = true; onChange(guide); render();
      onSession(true);
      status.textContent = saved.schedule ? 'DB에서 생활 시간을 불러왔어요. 라이프가이드 연결은 직접 켜 주세요.' : '아직 저장한 생활 시간이 없어요. 시간을 선택해 DB에 저장해 주세요.';
      // Preserve an old local time table as an unsaved draft; never upload silently.
      if (!saved.schedule) {
        try {
          const legacy = localStorage.getItem('momo.life-guide.v1');
          if (legacy) {
            guide = {...parseLifeGuide(JSON.parse(legacy)),enabled:false}; render();
            status.textContent = '기존 브라우저의 시간을 불러왔어요. 아직 DB에 저장되지 않았어요. 저장하고 적용을 눌러 주세요.';
          }
        } catch {}
      }
      if (pendingDraft) {
        renderDraft(pendingDraft); draftDirty = true;
        status.textContent = '선택한 시간을 유지했어요. 저장하고 적용을 눌러 주세요.';
      }
    } catch(error) { if (id === generation) { loggedIn = false; onSession(false,error); status.textContent = errorMessage(error); } }
    finally { if (id === generation) { busy = false; controls(); } }
  }
  function logout() {
    generation++; controller?.abort(); controller = null; loggedIn = false; busy = false;
    onSession(false);
    guide = emptyLifeGuide(); onChange(guide); render(); status.textContent = '체험 로그인 후 저장된 생활 시간을 불러올 수 있어요.';
    if (sessionId) {
      const token = sessionId; sessionId = null;
      void fetch('/api/life-guide/logout',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'X-Device-Session':token}}).catch(()=>{});
    }
  }
  element('life-guide-login').addEventListener('click',requestLogin);
  element('life-guide-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!loggedIn) { requestLogin(); return; }
    const next = readDraft();
    if (next.enabled && !Object.values(next.slots).some(values => values.length)) {
      status.textContent = '라이프가이드를 연결하려면 시간을 하나 이상 선택해 주세요.'; return;
    }
    const id = generation; busy = true; controls(); status.textContent = 'DB에 저장하고 있어요…';
    try {
      const {enabled: _enabled,...schedule} = next;
      await api('PUT','',schedule);
      if (id !== generation) return;
      guide = next; onChange(guide); updateConversationStatus(); channel?.postMessage({type:'changed'});
      draftDirty = false;
      try { localStorage.removeItem('momo.life-guide.v1'); } catch {}
      status.textContent = next.enabled ? 'DB에 저장했어요. 다음 답변부터 새 설정을 사용해요.' : 'DB에 저장했어요. 라이프가이드 연결은 꺼져 있어요.';
    } catch(error) { if (id === generation) status.textContent = errorMessage(error) + ' 변경 전 설정을 유지해요.'; }
    finally { if (id === generation) { busy = false; controls(); } }
  });
  element('life-guide-delete').addEventListener('click', async () => {
    if (!loggedIn || busy) return;
    const id = generation;
    // Stop prompting immediately, even if the database is temporarily unavailable.
    guide = emptyLifeGuide(); onChange(guide); render();
    busy = true; controls();
    try { await api('DELETE'); if(id !== generation) return; try {localStorage.removeItem('momo.life-guide.v1');}catch {} channel?.postMessage({type:'changed'}); status.textContent = 'DB의 생활 시간을 삭제했어요. 라이프가이드 연결을 껐어요.'; }
    catch(error) { if(id === generation) status.textContent = '현재 대화의 라이프가이드 연결은 껐지만 DB 삭제는 완료하지 못했어요. ' + errorMessage(error); }
    finally { if(id === generation) {busy = false; controls();} }
  });
  if (channel) channel.onmessage = async () => {
    if (!loggedIn || busy) return;
    const id = generation; busy = true; controls();
    // Withdraw old cues while loading a change from another tab.
    guide = {...guide,enabled:false}; onChange(guide);
    try { const result = await api('GET'); if(id !== generation) return; guide = result.schedule ? parseLifeGuide({...result.schedule,enabled:false}) : emptyLifeGuide(); onChange(guide); render(); status.textContent = '다른 탭에서 변경한 DB 시간표를 불러왔어요. 연결은 직접 켜 주세요.'; }
    catch(error) { if(id === generation) status.textContent = errorMessage(error); }
    finally { if(id === generation) {busy = false; controls();} }
  };
  render();
  status.textContent = '체험 로그인 후 저장된 생활 시간을 불러올 수 있어요.';
  return { current: () => guide, login, logout };
}
