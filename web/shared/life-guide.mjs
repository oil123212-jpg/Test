export const LIFE_ACTIVITIES = Object.freeze({ meal: '밥 먹기', sleep: '잠자리 준비', tidy: '청소·정리' });
export function emptyLifeGuide() {
  return { version: 1, enabled: false, timeZone: 'Asia/Seoul', slots: { meal: [], sleep: [], tidy: [] } };
}
// Only bounded, structured schedule data can reach the provider prompt.
export function parseLifeGuide(value) {
  if (!value || typeof value !== 'object' || value.version !== 1 || typeof value.enabled !== 'boolean' ||
      typeof value.timeZone !== 'string' || value.timeZone.length > 80 || !value.slots) throw new Error('INVALID_LIFE_GUIDE');
  try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }).format(); }
  catch { throw new Error('INVALID_LIFE_GUIDE'); }
  const slots = {};
  for (const activity of Object.keys(LIFE_ACTIVITIES)) {
    const list = value.slots[activity];
    if (!Array.isArray(list) || list.length > 48 || list.some(slot => !Number.isInteger(slot) || slot < 0 || slot > 47)) throw new Error('INVALID_LIFE_GUIDE');
    slots[activity] = [...new Set(list)].sort((a, b) => a - b);
  }
  return { version: 1, enabled: value.enabled, timeZone: value.timeZone, slots };
}
export function slotLabel(slot) {
  const time = value => `${String(Math.floor(value / 2)).padStart(2, '0')}:${value % 2 ? '30' : '00'}`;
  return `${time(slot)}–${time(slot + 1)}`;
}
export class LifeGuidePlanner {
  constructor(guide = emptyLifeGuide(), random = Math.random) {
    this.random = random;
    this.seen = new Set();
    this.update(guide);
  }
  update(guide) {
    this.guide = parseLifeGuide(guide);
    this.formatter = new Intl.DateTimeFormat('en-CA', { timeZone: this.guide.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    this.position = 0;
    this.chosen = -1;
    this.previousChosen = false;
  }
  nextCue(now = new Date()) {
    if (!this.guide.enabled) return null;
    const parts = Object.fromEntries(this.formatter.formatToParts(now).map(part => [part.type, part.value]));
    const slot = Number(parts.hour) * 2 + Math.floor(Number(parts.minute) / 30);
    const prefix = `${this.guide.timeZone}/${parts.year}-${parts.month}-${parts.day}/${slot}/`;
    const due = Object.keys(LIFE_ACTIVITIES).filter(activity => this.guide.slots[activity].includes(slot) && !this.seen.has(prefix + activity));
    if (!due.length) return null;
    // One randomly placed opportunity in each block of three eligible turns.
    // Avoid two consecutive suggestions at a block boundary.
    if (this.position === 0) this.chosen = (this.previousChosen ? 1 : 0) + Math.floor(this.random() * (this.previousChosen ? 2 : 3));
    const chosen = this.position === this.chosen;
    this.position = (this.position + 1) % 3;
    this.previousChosen = chosen;
    if (!chosen) return null;
    const activity = due[Math.floor(this.random() * due.length)];
    this.seen.add(prefix + activity);
    return { activity, label: LIFE_ACTIVITIES[activity], time: slotLabel(slot) };
  }
}
