import { emptyLifeGuide, LIFE_ACTIVITIES, parseLifeGuide, slotLabel, type LifeActivity, type LifeGuide } from '../shared/life-guide.mjs';
const STORAGE_KEY = 'momo.life-guide.v1';
export function mountLifeGuide(onChange: (guide: LifeGuide) => void) {
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const enabled = element<HTMLInputElement>('life-guide-enabled');
  const zone = element<HTMLSelectElement>('life-guide-timezone');
  const status = element('life-guide-save-status');
  let guide = emptyLifeGuide();
  let loaded = false, storageError = false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { guide = parseLifeGuide(JSON.parse(saved)); loaded = true; }
  } catch { storageError = true; }
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
    for (let period = 0; period < 4; period++) {
      const group = document.createElement('details');
      group.open = period === ({ meal: 1, sleep: 3, tidy: 2 }[activity]);
      const heading = document.createElement('summary'); heading.textContent = ['새벽 · 00:00–06:00', '아침 · 06:00–12:00', '오후 · 12:00–18:00', '저녁 · 18:00–24:00'][period]; group.append(heading);
      const grid = document.createElement('div'); grid.className = 'life-guide-slots';
      for (let slot = period * 12; slot < (period + 1) * 12; slot++) {
        const labelElement = document.createElement('label'); labelElement.className = 'life-guide-slot';
        const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.activity = activity; input.value = String(slot); input.id = `life-${activity}-${slot}`;
        input.setAttribute('aria-label', `${label} ${slotLabel(slot)}`);
        const text = document.createElement('span'); text.textContent = slotLabel(slot);
        labelElement.append(input, text); grid.append(labelElement);
      }
      group.append(grid); fieldset.append(group);
    }
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'text-button'; clear.textContent = `${label} 선택 비우기`;
    clear.addEventListener('click', () => { fieldset.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.checked = false; }); dirty(); });
    fieldset.append(clear); categories.append(fieldset);
  }
  function readDraft(): LifeGuide {
    const slots = { meal: [], sleep: [], tidy: [] } as Record<LifeActivity, number[]>;
    categories.querySelectorAll<HTMLInputElement>('input:checked').forEach(input => slots[input.dataset.activity as LifeActivity].push(Number(input.value)));
    return parseLifeGuide({ version: 1, enabled: enabled.checked, timeZone: zone.value, slots });
  }
  function summaries() {
    const draft = readDraft();
    for (const activity of Object.keys(LIFE_ACTIVITIES) as LifeActivity[]) {
      const values = draft.slots[activity];
      element(`life-guide-${activity}-summary`).textContent = values.length ? `${values.length}개 선택 · ${values.map(slotLabel).join(', ')}` : '선택한 시간이 없어요';
    }
  }
  function render() {
    enabled.checked = guide.enabled; zone.value = guide.timeZone;
    categories.querySelectorAll<HTMLInputElement>('input').forEach(input => {
      input.checked = guide.slots[input.dataset.activity as LifeActivity].includes(Number(input.value));
      if (input.checked) input.closest('details')!.open = true;
    });
    summaries(); updateConversationStatus();
  }
  function updateConversationStatus() {
    element('life-guide-conversation-status').textContent = guide.enabled ? `라이프 가이드 켜짐 · ${guide.timeZone} 기준, 해당 시간대에 가끔 생활 이야기를 건네요.` : '라이프 가이드 꺼짐 · 부모님 페이지에서 생활 시간을 설정할 수 있어요.';
  }
  function dirty() { summaries(); status.textContent = '변경한 내용이 있어요. 저장하고 적용을 눌러 주세요.'; }
  element('life-guide-form').addEventListener('change', dirty);
  element('life-guide-form').addEventListener('submit', event => {
    event.preventDefault();
    const next = readDraft();
    if (next.enabled && !Object.values(next.slots).some(values => values.length)) {
      status.textContent = '생활 이야기를 연결하려면 시간을 하나 이상 선택해 주세요.'; return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      guide = next; loaded = true; storageError = false; onChange(guide); updateConversationStatus();
      status.textContent = next.enabled ? '저장했어요. 지금 대화 중이면 다음 답변부터 새 설정을 사용해요.' : '저장했어요. 생활 화두 제안은 꺼져 있어요.';
    } catch { status.textContent = '브라우저에 저장하지 못했어요. 저장소 사용 설정을 확인해 주세요. 변경 전 설정을 유지해요.'; }
  });
  element('life-guide-delete').addEventListener('click', () => {
    // Disable immediately even when browser persistence is unavailable.
    guide = emptyLifeGuide(); onChange(guide); render();
    try { localStorage.removeItem(STORAGE_KEY); loaded = false; status.textContent = '저장한 생활 시간을 삭제했어요. 생활 화두 제안을 껐어요.'; }
    catch { status.textContent = '현재 대화의 생활 화두를 껐어요. 브라우저 설정에서 사이트 저장소도 삭제해 주세요.'; }
  });
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try { guide = event.newValue ? parseLifeGuide(JSON.parse(event.newValue)) : emptyLifeGuide(); }
    catch { guide = emptyLifeGuide(); }
    if (!zones.has(guide.timeZone)) { zones.add(guide.timeZone); zone.add(new Option(guide.timeZone, guide.timeZone)); }
    onChange(guide); render(); status.textContent = '다른 탭에서 변경한 생활 시간을 적용했어요.';
  });
  render();
  if (storageError) status.textContent = '저장한 설정을 읽지 못해 라이프 가이드를 껐어요. 시간을 다시 선택해 저장해 주세요.';
  else if (loaded) status.textContent = guide.enabled ? '저장된 생활 시간을 불러왔어요.' : '저장된 생활 시간이 있어요. 생활 화두 제안은 꺼져 있어요.';
  return { current: () => guide };
}
