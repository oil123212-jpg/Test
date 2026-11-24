import test from 'node:test';
import assert from 'node:assert/strict';
import {createReader,readingTool} from '../scripts/role-reading.mjs';
test('every offered role waits at its own lines, repeats and finishes in order',()=>{
  for(const book of readingTool.parameters.properties.book.enum){
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
