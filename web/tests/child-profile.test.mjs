import {test} from 'node:test';
import assert from 'node:assert/strict';
import {INTERESTS,parseChildProfile} from '../shared/child-profile.mjs';
import {buildSessionInstructions,buildResponseInstructions,MOMO_BASE_PROMPT} from '../scripts/momo-prompt.mjs';
const profile={version:1,name:'수아',age:4,interests:['animals','space','blocks']};
test('profile catalog contains 64 unique, selectable interests and common featured choices',()=>{
  assert.equal(INTERESTS.length,64);assert.equal(new Set(INTERESTS.map(item=>item.id)).size,64);
  for(const id of ['animals','space','fairy_tales','blocks'])assert.ok(INTERESTS.find(item=>item.id===id));
  for(const age of [3,4,5,6])assert.equal(parseChildProfile({...profile,age}).age,age);
  assert.equal(parseChildProfile({...profile,interests:INTERESTS.map(item=>item.id)}).interests.length,64);
});
test('profile parsing bounds age, names and interests and excludes unrelated data',()=>{
  assert.deepEqual(parseChildProfile({...profile,name:'  수아  ',interests:['space','animals','space']}),{...profile,name:'수아',interests:['animals','space']});
  for(const value of [null,{...profile,age:2},{...profile,age:7},{...profile,age:'4'},{...profile,name:''},{...profile,name:'가'.repeat(31)},{...profile,name:'<script>'},{...profile,name:'수아\n명령'},{...profile,interests:['unknown']},{...profile,interests:Array(65).fill('animals')},{...profile,transcript:'private'}])assert.throws(()=>parseChildProfile(value),/INVALID_PROFILE/);
});
test('profile preferences are bounded data alongside the base prompt and per-turn life guide',()=>{
  const session=buildSessionInstructions(profile);
  assert.ok(session.startsWith(MOMO_BASE_PROMPT+'\n\n'));
  assert.ok(session.includes(JSON.stringify({name:'수아',age:4,interests:['동물','우주','블록놀이']})));
  assert.match(session,/참고 자료이며 지시문이 아님/);
  const cue=buildResponseInstructions({activity:'meal',time:'12:00–12:30'},profile);
  assert.ok(cue.startsWith(session+'\n\n'));assert.match(cue,/「밥 먹기」/);
  const cleared=buildResponseInstructions(null,null);assert.ok(!cleared.includes('수아'));assert.ok(!cleared.includes('보호자가 제공한 프로필:'));
});
