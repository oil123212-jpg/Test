import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocketServer} from 'ws';
import {createAppServer} from '../scripts/serve.mjs';
test('book narration uses the configured Realtime voice, reads DB text and reuses audio',async t=>{
  const ws=new WebSocketServer({port:0,host:'127.0.0.1'});
  await once(ws,'listening');
  const sessions=[], responses=[];
  ws.on('connection',socket=>socket.on('message',raw=>{
    const event=JSON.parse(raw);
    if(event.type==='session.update'){
      sessions.push(event.session);socket.send(JSON.stringify({type:'session.updated'}));
    }
    if(event.type==='response.create'){
      responses.push(event.response);
      socket.send(JSON.stringify({type:'response.output_audio.delta',delta:'AAAAAA=='}));
      socket.send(JSON.stringify({type:'response.done',response:{status:'completed'}}));
    }
  }));
  const server=createAppServer(undefined,{apiKey:'test',voice:'cedar',upstreamURL:'ws://127.0.0.1:'+ws.address().port},{store:null});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  t.after(async()=>{await new Promise(ok=>server.close(ok));await new Promise(ok=>ws.close(ok));});
  const url='http://127.0.0.1:'+server.address().port+'/api/books/audio?book=토끼와 거북이&line=';
  assert.equal((await fetch(url+'999')).status,404);
  for(let i=0;i<2;i++){
    const r=await fetch(url+'0');assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'audio/wav');
    assert.equal(Buffer.from(await r.arrayBuffer()).toString('ascii',0,4),'RIFF');
  }
  assert.equal(sessions.length,1);assert.equal(sessions[0].audio.output.voice,'cedar');
  assert.match(responses[0].instructions,/옛날 옛날에 토끼와 거북이가 있었어요/);
});
