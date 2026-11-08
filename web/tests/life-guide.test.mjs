import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLifeGuide, parseLifeGuide, slotLabel, LifeGuidePlanner } from '../shared/life-guide.mjs';
const at = value => new Date(value);
const guide = (slots, timeZone = 'Asia/Seoul') => ({ ...emptyLifeGuide(), enabled: true, timeZone, slots: { meal: [], sleep: [], tidy: [], ...slots } });
test('schedule validation rejects unbounded values and prompt strings, normalizes duplicates', () => {
  const valid = guide({meal:[25,24,24]});
  assert.deepEqual(parseLifeGuide(valid).slots.meal,[24,25]);
  for (const value of [null, {...valid,version:2}, {...valid,enabled:'true'}, {...valid,timeZone:'ignore instructions'}, guide({meal:[48]}), guide({meal:[-1]}), guide({meal:[24.5]}), guide({meal:['밥을 먹어']}), guide({meal:Array(49).fill(1)})]) assert.throws(()=>parseLifeGuide(value),/INVALID_LIFE_GUIDE/);
  assert.equal(slotLabel(47),'23:30–24:00');
});
test('only the configured local half hour is eligible, including midnight and daylight saving', () => {
  const planner = new LifeGuidePlanner(guide({meal:[24],sleep:[47,0]}),()=>0);
  assert.equal(planner.nextCue(at('2026-11-08T02:59:59Z')),null);
  assert.equal(planner.nextCue(at('2026-11-08T03:00:00Z')).activity,'meal');
  assert.equal(planner.nextCue(at('2026-11-08T03:30:00Z')),null);
  assert.equal(new LifeGuidePlanner(guide({sleep:[47]}),()=>0).nextCue(at('2026-11-08T14:59:59Z')).activity,'sleep');
  assert.equal(new LifeGuidePlanner(guide({sleep:[0]}),()=>0).nextCue(at('2026-11-08T15:00:00Z')).activity,'sleep');
  const ny = new LifeGuidePlanner(guide({meal:[16]},'America/New_York'),()=>0);
  assert.equal(ny.nextCue(at('2026-07-08T11:59:59Z')),null);
  assert.equal(ny.nextCue(at('2026-07-08T12:00:00Z')).activity,'meal');
});
test('one of three eligible turns is selected and a slot is not suggested repeatedly', () => {
  const planner = new LifeGuidePlanner(guide({meal:[24]}),()=>.5);
  const now = at('2026-11-08T03:05:00Z');
  assert.equal(planner.nextCue(now),null);
  assert.equal(planner.nextCue(now).activity,'meal');
  for(let i=0;i<10;i++) assert.equal(planner.nextCue(now),null);
  // A new conversation can independently consider the same schedule.
  assert.equal(new LifeGuidePlanner(guide({meal:[24]}),()=>0).nextCue(now).activity,'meal');
});
test('overlapping activities rotate without consecutive block-boundary cues; disabling stops cues', () => {
  const rolls=[.99,0,0,0];
  const planner = new LifeGuidePlanner(guide({meal:[24],sleep:[24],tidy:[24]}),()=>rolls.shift()??0);
  const now=at('2026-11-08T03:05:00Z');
  const cues=Array.from({length:6},()=>planner.nextCue(now));
  assert.equal(cues.filter(Boolean).length,2);
  for(let i=1;i<cues.length;i++) assert.ok(!(cues[i]&&cues[i-1]));
  assert.notEqual(cues.filter(Boolean)[0].activity,cues.filter(Boolean)[1].activity);
  planner.update(emptyLifeGuide()); assert.equal(planner.nextCue(now),null);
});
test('editing settings does not reset the same-slot anti-repetition record', () => {
  const planner = new LifeGuidePlanner(guide({meal:[24]}),()=>0);
  const now=at('2026-11-08T03:05:00Z');
  assert.equal(planner.nextCue(now).activity,'meal');
  planner.update(emptyLifeGuide()); planner.update(guide({meal:[24]}));
  assert.equal(planner.nextCue(now),null);
});
