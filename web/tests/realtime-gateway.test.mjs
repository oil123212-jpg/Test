import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { createAppServer } from '../scripts/serve.mjs';
import { REALTIME_POLICY } from '../shared/realtime-policy.mjs';
import { MOMO_BASE_PROMPT } from '../scripts/momo-prompt.mjs';

async function setup(t, options={}) {
  const messages=[], providers=[], clients=[];
  const provider = new WebSocketServer({port:0,host:'127.0.0.1', ...(options.rejectStatus ? {verifyClient:(_info,done)=>done(false,options.rejectStatus)} : {})}); await once(provider,'listening');
  provider.on('connection',(socket,req)=> {
    providers.push(socket); assert.equal(req.headers.authorization,'Bearer test-server-key');
    socket.on('message',raw=>{
      const event=JSON.parse(raw.toString());messages.push(event);
      if(event.type==='session.update' && !options.noAck) socket.send(JSON.stringify({type:'session.updated'}));
    });
  });
  const app=createAppServer(undefined,{apiKey:'test-server-key',model:'test-model',upstreamURL:`ws://127.0.0.1:${provider.address().port}`, ...options});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${app.address().port}`;
  t.after(async()=>{
    clients.forEach(s=>s.terminate());providers.forEach(s=>s.terminate());
    app.closeAllConnections();await new Promise(resolve=>app.close(resolve)); await new Promise(resolve=>provider.close(resolve));
  });
  async function session(body={consent:true,policy:REALTIME_POLICY}, headers={}) {
    const response=await fetch(origin+'/api/realtime/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
    return {response,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  async function socket(grant, cookie=grant.cookie) {
    const ws=new WebSocket(origin.replace('http:','ws:')+'/api/realtime',{headers:{Origin:origin,...(cookie?{Cookie:cookie}:{})}});clients.push(ws);
    const events=[];
    ws.on('message',(data,binary)=>events.push(binary?{binary:Buffer.from(data)}:JSON.parse(data.toString())));
    ws.on('error',()=>{});await once(ws,'open');
    ws.send(JSON.stringify({type:'start',token:grant.body.token}));
    return {ws,events};
  }
  return {origin,messages,providers,clients,session,socket,app};
}
async function until(fn) {
  const end=Date.now()+2500;
  while(Date.now()<end){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,10));}
  assert.fail('Timed out waiting for protocol event');
}
test('configuration never returns the provider key and disabled server refuses sessions',async t=>{
  const f=await setup(t,{apiKey:''}); const config=await(await fetch(f.origin+'/api/realtime/config')).json();
  assert.equal(config.available,false);assert.ok(!JSON.stringify(config).includes('test-server-key'));
  assert.equal((await f.session()).response.status,503);
});
test('origin, explicit voice consent and current policy version are enforced',async t=>{
  const f=await setup(t);
  assert.equal((await f.session({}, {Origin:'https://evil.example'})).response.status,403);
  for(const body of [{policy:REALTIME_POLICY},{consent:false,policy:REALTIME_POLICY},{consent:true,adultTest:true,policy:'realtime-adult-test-v1'}]) assert.equal((await f.session(body)).response.status,403);
  assert.equal(f.providers.length,0);
});
test('optional access code is checked before a connection grant is issued',async t=>{
  const f=await setup(t,{accessCode:'owner-only'});
  assert.equal((await f.session()).body.code,'ACCESS_DENIED');
  assert.equal((await f.session({consent:true,policy:REALTIME_POLICY,accessCode:'owner-only'})).response.status,200);
});
test('one-use cookie-bound ticket sets fixed session and relays exact nonzero PCM',async t=>{
  const f=await setup(t);const grant=await f.session();
  assert.match(grant.response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const {ws,events}=await f.socket(grant);await until(()=>events.find(e=>e.type==='ready'));
  const config=f.messages.find(e=>e.type==='session.update');
  assert.equal(config.session.instructions,MOMO_BASE_PROMPT);
  assert.match(config.session.instructions,/3~6세/);
  assert.equal(config.session.audio.input.format.rate,24000);assert.equal(config.session.audio.input.turn_detection.type,'server_vad');
  assert.equal(config.session.audio.input.turn_detection.create_response,false);
  const pcm=Buffer.from([0x12,0x34,0x56,0x78]);ws.send(pcm);
  await until(()=>f.messages.find(e=>e.type==='input_audio_buffer.append'));
  assert.deepEqual(Buffer.from(f.messages.find(e=>e.type==='input_audio_buffer.append').audio,'base64'),pcm);
  f.providers[0].send(JSON.stringify({type:'response.created',response:{id:'r1'}}));
  f.providers[0].send(JSON.stringify({type:'response.output_audio.delta',response_id:'r1',delta:pcm.toString('base64')}));
  await until(()=>events.find(e=>e.binary));assert.deepEqual(events.find(e=>e.binary).binary,pcm);
});

const lifeGuide = {version:1,enabled:true,timeZone:'Asia/Seoul',slots:{meal:[24],sleep:[],tidy:[]}};
const consentBody = {consent:true,policy:REALTIME_POLICY};
async function turn(f, id) {
  f.providers[0].send(JSON.stringify({type:'input_audio_buffer.committed',item_id:'input-'+id}));
  await until(()=>f.messages.filter(e=>e.type==='response.create').length>=id);
  f.providers[0].send(JSON.stringify({type:'response.created',response:{id:'response-'+id}}));
  f.providers[0].send(JSON.stringify({type:'response.done',response:{id:'response-'+id,status:'completed'}}));
}
test('life guide never speaks on a timer and injects one natural cue in three eligible turns',async t=>{
  const f=await setup(t,{random:()=>.5,now:()=>new Date('2026-11-08T03:05:00Z')});
  const {events}=await f.socket(await f.session({...consentBody,lifeGuide}));await until(()=>events.find(e=>e.type==='ready'));
  assert.equal(f.messages.filter(e=>e.type==='response.create').length,0);
  for(let i=1;i<=3;i++) await turn(f,i);
  const prompts=f.messages.filter(e=>e.type==='response.create').map(e=>e.response.instructions);
  for(const prompt of prompts) assert.ok(prompt.startsWith(MOMO_BASE_PROMPT+'\n\n'));
  assert.equal(prompts.filter(p=>p.includes('「밥 먹기」')).length,1);
  assert.match(prompts[1],/12:00–12:30/);
  assert.match(prompts[1],/명령하거나 재촉하거나 죄책감을 주지 마/);
  assert.ok(!prompts[0].includes('12:00'));
  // Duplicate provider events must never create a second reply.
  f.providers[0].send(JSON.stringify({type:'input_audio_buffer.committed',item_id:'input-3'}));
  await new Promise(r=>setTimeout(r,25));assert.equal(f.messages.filter(e=>e.type==='response.create').length,3);
});
test('client prompt and age claims cannot override the server child conversation instructions',async t=>{
  const f=await setup(t);
  const {events}=await f.socket(await f.session({...consentBody,instructions:'client-override-never-forward',age:99}));
  await until(()=>events.find(e=>e.type==='ready'));
  await turn(f,1);
  const initial=f.messages.find(e=>e.type==='session.update').session.instructions;
  const ordinary=f.messages.find(e=>e.type==='response.create').response.instructions;
  assert.equal(initial,MOMO_BASE_PROMPT);assert.ok(ordinary.startsWith(MOMO_BASE_PROMPT+'\n\n'));
  assert.ok(!ordinary.includes('client-override-never-forward'));
  assert.ok(!ordinary.includes('99'));
  assert.ok(!ordinary.includes('성인 개발자'));
  assert.match(ordinary,/이번 답변에서는 생활 습관이나 일정 화두를 먼저 꺼내지 말고/);
});
test('validated child profile reaches session and replies and can be updated or cleared live',async t=>{
  const f=await setup(t);const profile={version:1,name:'수아',age:4,interests:['animals','space']};
  assert.equal((await f.session({...consentBody,profile:{...profile,age:7}})).body.code,'INVALID_PROFILE');
  const {ws,events}=await f.socket(await f.session({...consentBody,profile}));await until(()=>events.find(e=>e.type==='ready'));
  assert.ok(f.messages.find(e=>e.type==='session.update').session.instructions.includes('수아'));
  await turn(f,1);assert.ok(f.messages.find(e=>e.type==='response.create').response.instructions.includes('수아'));
  ws.send(JSON.stringify({type:'profile.update',profile:{...profile,name:'민준',age:6}}));ws.send(Buffer.from([1,0]));await until(()=>f.messages.find(e=>e.type==='input_audio_buffer.append'));
  await turn(f,2);const changed=f.messages.filter(e=>e.type==='response.create')[1].response.instructions;assert.ok(changed.includes('민준'));assert.ok(!changed.includes('수아'));assert.ok(changed.startsWith(MOMO_BASE_PROMPT));
  ws.send(JSON.stringify({type:'profile.update',profile:null}));ws.send(Buffer.from([1,0]));await until(()=>f.messages.filter(e=>e.type==='input_audio_buffer.append').length===2);
  await turn(f,3);assert.ok(!f.messages.filter(e=>e.type==='response.create')[2].response.instructions.includes('민준'));
});
test('out-of-window schedules, disabled guide, and missing guide keep ordinary replies',async t=>{
  for(const schedule of [lifeGuide,{...lifeGuide,enabled:false},undefined]) {
    const f=await setup(t,{random:()=>0,now:()=>new Date('2026-11-08T04:00:00Z')});
    const {events}=await f.socket(await f.session({...consentBody,lifeGuide:schedule}));await until(()=>events.find(e=>e.type==='ready'));
    await turn(f,1);assert.ok(!f.messages.find(e=>e.type==='response.create').response.instructions.includes('「밥 먹기」'));
  }
});
test('active schedule edits and deletion affect the next turn without starting a response',async t=>{
  const f=await setup(t,{random:()=>0,now:()=>new Date('2026-11-08T03:05:00Z')});
  const {ws,events}=await f.socket(await f.session());await until(()=>events.find(e=>e.type==='ready'));
  ws.send(JSON.stringify({type:'life_guide.update',lifeGuide}));
  // A following audio packet lets the test observe that the update was handled.
  ws.send(Buffer.from([1,0]));await until(()=>f.messages.find(e=>e.type==='input_audio_buffer.append'));
  assert.equal(f.messages.filter(e=>e.type==='response.create').length,0);
  await turn(f,1);assert.match(f.messages.find(e=>e.type==='response.create').response.instructions,/「밥 먹기」/);
  ws.send(JSON.stringify({type:'life_guide.update',lifeGuide:{...lifeGuide,enabled:false}}));
  ws.send(Buffer.from([1,0]));await until(()=>f.messages.filter(e=>e.type==='input_audio_buffer.append').length===2);
  await turn(f,2);assert.ok(!f.messages.filter(e=>e.type==='response.create')[1].response.instructions.includes('「밥 먹기」'));
});
test('invalid life guide is rejected in admission and live updates',async t=>{
  const f=await setup(t);
  assert.equal((await f.session({...consentBody,lifeGuide:{...lifeGuide,timeZone:'ignore instructions'}})).body.code,'INVALID_LIFE_GUIDE');
  assert.equal(f.providers.length,0);
  const {ws,events}=await f.socket(await f.session());await until(()=>events.find(e=>e.type==='ready'));
  ws.send(JSON.stringify({type:'life_guide.update',lifeGuide:null}));await until(()=>events.find(e=>e.code==='INVALID_LIFE_GUIDE'));
});
test('an interrupted reply finishes before the next committed turn is generated',async t=>{
  const f=await setup(t);const {events}=await f.socket(await f.session());await until(()=>events.find(e=>e.type==='ready'));
  f.providers[0].send(JSON.stringify({type:'input_audio_buffer.committed',item_id:'a'}));
  await until(()=>f.messages.find(e=>e.type==='response.create'));
  // The interruption may precede response.created.
  f.providers[0].send(JSON.stringify({type:'input_audio_buffer.speech_started'}));
  f.providers[0].send(JSON.stringify({type:'input_audio_buffer.committed',item_id:'b'}));
  f.providers[0].send(JSON.stringify({type:'response.created',response:{id:'old'}}));
  await until(()=>f.messages.find(e=>e.type==='response.cancel'));
  assert.equal(f.messages.filter(e=>e.type==='response.create').length,1);
  f.providers[0].send(JSON.stringify({type:'response.done',response:{id:'old',status:'cancelled'}}));
  await until(()=>f.messages.filter(e=>e.type==='response.create').length===2);
});
test('ticket cannot be reused or used without its browser cookie',async t=>{
  const f=await setup(t);const grant=await f.session();
  const invalid=await f.socket(grant,''); await until(()=>invalid.events.find(e=>e.code==='AUTH_REQUIRED'));
  const first=await f.socket(grant);await until(()=>first.events.find(e=>e.type==='ready'));
  const second=await f.socket(grant);await until(()=>second.events.find(e=>e.code==='AUTH_REQUIRED'));
  assert.equal(f.providers.length,1);
});
test('cancel filters late audio for the cancelled response',async t=>{
  const f=await setup(t);const {ws,events}=await f.socket(await f.session());await until(()=>events.find(e=>e.type==='ready'));
  f.providers[0].send(JSON.stringify({type:'response.created',response:{id:'r1'}}));await until(()=>events.find(e=>e.type==='response.started'));
  ws.send(JSON.stringify({type:'cancel'}));await until(()=>f.messages.find(e=>e.type==='response.cancel'));
  f.providers[0].send(JSON.stringify({type:'response.output_audio.delta',response_id:'r1',delta:'AAABAA=='}));
  await new Promise(r=>setTimeout(r,30));assert.equal(events.filter(e=>e.binary).length,0);
});
test('upstream errors are sanitized and never echo credentials or transcript',async t=>{
  const f=await setup(t);const {events}=await f.socket(await f.session());await until(()=>events.find(e=>e.type==='ready'));
  f.providers[0].send(JSON.stringify({type:'error',error:{code:'insufficient_quota',message:'test-server-key private-transcript'}}));
  await until(()=>events.find(e=>e.code==='API_QUOTA'));assert.ok(!JSON.stringify(events).includes('test-server-key'));assert.ok(!JSON.stringify(events).includes('private-transcript'));
});
test('JSON null cannot crash the relay and arbitrary provider commands are rejected',async t=>{
  const f=await setup(t);let pair=await f.socket(await f.session());await until(()=>pair.events.find(e=>e.type==='ready'));
  pair.ws.send('null');await until(()=>pair.events.find(e=>e.code==='INVALID_REQUEST'));
  await until(()=>f.app.listening);pair=await f.socket(await f.session());await until(()=>pair.events.find(e=>e.type==='ready'));
  pair.ws.send(JSON.stringify({type:'response.create'}));await until(()=>pair.events.find(e=>e.code==='INVALID_REQUEST'));
  assert.ok(!f.messages.find(e=>e.type==='response.create'));
});
test('session deletion terminates both sides and clears the cookie',async t=>{
  const f=await setup(t);const grant=await f.session();const {ws,events}=await f.socket(grant);await until(()=>events.find(e=>e.type==='ready'));
  const closed=once(ws,'close');const res=await fetch(f.origin+'/api/realtime/session',{method:'DELETE',headers:{Origin:f.origin,Cookie:grant.cookie}});
  assert.equal(res.status,200);assert.match(res.headers.get('set-cookie'),/Max-Age=0/);await closed;
});
test('authenticated users can open more than two concurrent and twenty hourly conversations',async t=>{
  const f=await setup(t);
  for(let i=0;i<21;i++){
    const grant=await f.session();
    assert.equal(grant.response.status,200);
    const pair=await f.socket(grant);
    await until(()=>pair.events.some(e=>e.type==='ready'));
  }
  assert.equal(f.providers.filter(socket=>socket.readyState===WebSocket.OPEN).length,21);
});
test('session ready timeout terminates a stalled handshake',async t=>{
  const f=await setup(t,{noAck:true,handshakeTimeoutMs:120});const p=await f.socket(await f.session());
  await until(()=>p.events.find(e=>e.code==='CONNECT_TIMEOUT'));
});
test('continuous PCM beyond the former two-minute budget reaches the client',async t=>{
  const f=await setup(t);
  const p=await f.socket(await f.session());
  await until(()=>p.events.find(e=>e.type==='ready'));
  assert.equal(f.messages.find(e=>e.type==='session.update').session.max_output_tokens,'inf');
  const delta=Buffer.alloc(48000).toString('base64');
  let received=0;
  p.ws.on('message',(data,binary)=>{if(binary)received+=data.length;});
  for(let i=0;i<13;i++){
    for(let j=0;j<10;j++)f.providers[0].send(JSON.stringify({type:'response.output_audio.delta',response_id:'long',delta}));
    await until(()=>received===(i+1)*10*48000);
  }
  assert.equal(p.ws.readyState,WebSocket.OPEN);
});
test('a delayed old-session DELETE cannot kill a newly started session',async t=>{
  const f=await setup(t);const first=await f.session();const a=await f.socket(first);await until(()=>a.events.find(e=>e.type==='ready'));
  const second=await f.session({consent:true,policy:REALTIME_POLICY},{Cookie:first.cookie});
  const b=await f.socket(second);await until(()=>b.events.find(e=>e.type==='ready'));
  const response=await fetch(f.origin+'/api/realtime/session',{method:'DELETE',headers:{Origin:f.origin,Cookie:first.cookie,'X-Realtime-Session':first.body.token}});
  assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);
  assert.equal(b.ws.readyState,WebSocket.OPEN);
  b.ws.send(Buffer.from([1,0]));await until(()=>f.messages.find(e=>e.type==='input_audio_buffer.append'));
});
test('admission attempts are bounded even when access codes are wrong',async t=>{
  const f=await setup(t,{accessCode:'private',admissionLimit:2});
  assert.equal((await f.session()).response.status,403);assert.equal((await f.session()).response.status,403);
  assert.equal((await f.session()).response.status,429);
});

for (const [status,code] of [[401,'API_AUTH_FAILED'],[429,'API_QUOTA'],[404,'MODEL_UNAVAILABLE']]) {
  test(`upstream HTTP ${status} handshake failure is mapped safely`,async t=>{
    const f=await setup(t,{rejectStatus:status});const {events}=await f.socket(await f.session());
    await until(()=>events.find(e=>e.code===code));
    assert.equal(f.providers.length,0);
  });
}

test('server handles a tagged DB lookup and continues the same turn once', async t => {
  const f = await setup(t);
  const {events} = await f.socket(await f.session(consentBody));
  await until(() => events.some(e => e.type === 'ready'));
  const provider = f.providers[0];
  const emit = event => provider.send(JSON.stringify(event));
  const creates = () => f.messages.filter(e => e.type === 'response.create');
  assert.equal(f.messages[0].session.tools[0].name, 'lookup_examples');
  emit({type:'input_audio_buffer.committed',item_id:'query-turn'});
  await until(() => creates().length === 1);
  emit({type:'response.created',response:{id:'lookup'}});
  const done = {type:'response.done',response:{id:'lookup',status:'completed',output:[{
    type:'function_call',call_id:'query1',name:'lookup_examples',
    arguments:JSON.stringify({topic:'책과 이야기',intent:'발견'}),
  }]}};
  emit(done);
  emit(done);
  await until(() => creates().length === 2);
  const results = f.messages.filter(e => e.type === 'conversation.item.create');
  assert.equal(results.length,1);
  assert.equal(results[0].item.call_id,'query1');
  assert.match(JSON.parse(results[0].item.output).examples[0].scene,/책/);
  assert.equal(creates()[1].response.instructions,creates()[0].response.instructions);
  assert.equal(creates()[1].response.tool_choice,'none');
  emit({type:'response.created',response:{id:'spoken'}});
  emit({type:'response.done',response:{id:'spoken',status:'completed'}});
  await until(() => events.some(e => e.type === 'response.done'));
  assert.equal(events.filter(e => e.type === 'response.done').length,1);
});

test('unmatched tags, unknown tools and malformed lookup inputs return no examples', async () => {
  const {lookupDialogue} = await import('../scripts/dialogue-examples.mjs');
  for (const args of ['null','{',JSON.stringify({topic:'없는 주제',intent:'전체'}),
    JSON.stringify({topic:'책과 이야기',intent:'없는 의도'})]) {
    assert.deepEqual(lookupDialogue({name:'lookup_examples',arguments:args}),{examples:[]});
  }
  assert.deepEqual(lookupDialogue({name:'other',arguments:'{}'}),{examples:[]});
  assert.equal(lookupDialogue({name:'lookup_examples',arguments:'{"topic":"책과 이야기","intent":"전체"}'}).examples.length,2);
});

test('anonymous turns cannot inject a remembered topic into a later session',async t=>{
  const f=await setup(t);
  const first=await f.socket(await f.session({...consentBody}));
  await until(()=>first.events.some(e=>e.type==='ready'));
  assert.equal(f.messages[0].session.audio.input.transcription.language,'ko');
  f.providers[0].send(JSON.stringify({type:'conversation.item.input_audio_transcription.completed',transcript:'민수랑 놀이터에 갔어'}));
  const saved=await until(()=>first.events.find(e=>e.type==='memory.topic'));
  assert.equal(saved.topic,'playground');
  assert.deepEqual(Object.keys(saved).sort(),['at','topic','type']);
  const next=await f.socket(await f.session({...consentBody,previous:saved}));
  await until(()=>next.events.some(e=>e.type==='ready'));
  f.providers[1].send(JSON.stringify({type:'input_audio_buffer.committed',item_id:'new'}));
  const reply=await until(()=>f.messages.find(e=>e.type==='response.create'));
  assert.doesNotMatch(reply.response.instructions,/지난 대화 주제: 놀이터/);
  assert.ok(!reply.response.instructions.includes('민수'));
});

test('memory expires at 48 hours and rejects arbitrary text',async()=>{
  const {memoryHint,memoryTTL}=await import('../shared/topic-memory.mjs');
  const at=100;
  assert.ok(memoryHint({topic:'blocks',at},at+memoryTTL-1));
  for(const data of [{topic:'blocks',at},{topic:'unknown',at:at+1},{topic:{toString:0},at}])
    assert.equal(memoryHint(data,at+memoryTTL),'');
});

test('a reading request returns the SQLite title and opening in the same spoken response', async t => {
  const f = await setup(t);
  const {events} = await f.socket(await f.session(consentBody));
  await until(() => events.some(e => e.type === 'ready'));
  const emit = event => f.providers[0].send(JSON.stringify(event));
  const creates = () => f.messages.filter(e => e.type === 'response.create');
  emit({type:'input_audio_buffer.committed',item_id:'book-request'});
  await until(() => creates().length === 1);
  emit({type:'response.created',response:{id:'book-lookup'}});
  emit({type:'response.done',response:{id:'book-lookup',status:'completed',output:[{
    type:'function_call',call_id:'book',name:'role_reading',arguments:'{"action":"read"}',
  }]}});
  await until(() => creates().length === 2);
  const turn = JSON.parse(f.messages.find(e => e.type === 'conversation.item.create').item.output);
  assert.ok(creates()[1].response.instructions.endsWith([turn.book, ...turn.narration.map(row=>row[1])].join('\n')));
});

test('content expressions reflect the Korean utterance independently of microphone state',async()=>{
  const {expressionFor}=await import('../scripts/realtime-gateway.mjs');
  for (const [text,face] of [['자장가 불러줘','sleepy'],['노래 부르자','singing'],['무서워','listening'],['왜 그럴까','thinking'],['안녕 모모','hello'],['책 읽자','speaking'],['자동차','']])
    assert.equal(expressionFor(text) ?? '', face);
});

test('shared reading sends the child’s line in the normal voice conversation',async t=>{
  const f=await setup(t);
  const {events}=await f.socket(await f.session(consentBody));
  await until(()=>events.some(e=>e.type==='ready'));
  const emit=event=>f.providers[0].send(JSON.stringify(event));
  emit({type:'input_audio_buffer.committed',item_id:'play'});
  await until(()=>f.messages.some(e=>e.type==='response.create'));
  emit({type:'response.created',response:{id:'role'}});
  emit({type:'response.done',response:{id:'role',status:'completed',output:[{
    type:'function_call',name:'role_reading',call_id:'select-rabbit',
    arguments:JSON.stringify({action:'start',book:'토끼와 거북이',role:'토끼'})
  }]}});
  const cue=await until(()=>events.find(e=>e.type==='reading.cue'));
  assert.equal(cue.role,'토끼');
  assert.match(cue.text,/거북아/);
});
