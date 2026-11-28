import test from 'node:test';
import assert from 'node:assert/strict';
import {createReader} from '../scripts/role-reading.mjs';
test('every offered role waits at its own lines, repeats and finishes in order',()=>{
  for(const book of createReader().run(JSON.stringify({action:'choose'})).titles){
    const reader=createReader(),run=(action,role)=>reader.run(JSON.stringify({action,book,role}));
    for(const role of run('choose').roles){
      let turn=run('start',role),count=0;
      while(!turn.finished){
        assert.ok(turn.cue);assert.ok(turn.narration.every(row=>row[0]!==role));
        assert.deepEqual(run('repeat'),turn);
        assert.ok(++count<20);turn=run('next');
      }
      assert.ok(count>=2);
    }
    const start=run('start',run('choose').roles[0]);
    assert.equal(run('solo').narration[0][1],start.cue);
    run('stop');assert.equal(reader.current(),undefined);
  }
});

test('a role-only reply uses the chosen title; advancing after the ending is silent',()=>{
  const reader=createReader();
  const run=args=>reader.run(JSON.stringify(args));
  run({action:'choose',book:'토끼와 거북이'});
  const first=run({action:'start',role:'토끼'});
  assert.equal(first.book,'토끼와 거북이');
  const ending=run({action:'solo'});
  assert.ok(ending.narration.length>0);
  assert.deepEqual(run({action:'next'}).narration,[]);
  assert.deepEqual(run({action:'repeat'}),ending);
  run({action:'stop'});
  assert.equal(run({action:'start',role:'토끼'}).role,'토끼');
  assert.equal(createReader().run(JSON.stringify({action:'start', book:'금도끼와 은도끼'})).role,'산신령');
  assert.ok(createReader().run(JSON.stringify({action:'start'})).cue);
});

test('unqualified requests announce a database title and immediately return its ordered lines',()=>{
  const books={'테스트 책':[['해설','첫 문장'],['친구','끝 문장']]};
  const reader=createReader(()=>books);
  const turn=reader.run('{"action":"read"}');
  assert.equal(turn.book,'테스트 책');
  assert.ok(turn.announceTitle);
  assert.deepEqual(turn.narration,books[turn.book]);
  assert.ok(reader.run('{"action":"read","book":"없는 책"}').error);
  assert.ok(createReader(()=>{throw Error();}).run('{"action":"read"}').error);
});
