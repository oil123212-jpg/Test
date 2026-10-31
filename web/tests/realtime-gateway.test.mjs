import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { createAppServer } from '../scripts/serve.mjs';
import { REALTIME_POLICY } from '../scripts/realtime-gateway.mjs';

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
  async function session(body={consent:true,adultTest:true,policy:REALTIME_POLICY}, headers={}) {
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
test('origin, explicit adult consent and policy version are enforced',async t=>{
  const f=await setup(t);
  assert.equal((await f.session({}, {Origin:'https://evil.example'})).response.status,403);
  for(const body of [{consent:true,adultTest:false,policy:REALTIME_POLICY},{consent:false,adultTest:true,policy:REALTIME_POLICY},{consent:true,adultTest:true,policy:'old'}]) assert.equal((await f.session(body)).response.status,403);
  assert.equal(f.providers.length,0);
});
test('optional access code is checked before a connection grant is issued',async t=>{
  const f=await setup(t,{accessCode:'owner-only'});
  assert.equal((await f.session()).body.code,'ACCESS_DENIED');
  assert.equal((await f.session({consent:true,adultTest:true,policy:REALTIME_POLICY,accessCode:'owner-only'})).response.status,200);
});
test('one-use cookie-bound ticket sets fixed session and relays exact nonzero PCM',async t=>{
  const f=await setup(t);const grant=await f.session();
  assert.match(grant.response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const {ws,events}=await f.socket(grant);await until(()=>events.find(e=>e.type==='ready'));
  const config=f.messages.find(e=>e.type==='session.update');
  assert.equal(config.session.audio.input.format.rate,24000);assert.equal(config.session.audio.input.turn_detection.type,'server_vad');
  const pcm=Buffer.from([0x12,0x34,0x56,0x78]);ws.send(pcm);
  await until(()=>f.messages.find(e=>e.type==='input_audio_buffer.append'));
  assert.deepEqual(Buffer.from(f.messages.find(e=>e.type==='input_audio_buffer.append').audio,'base64'),pcm);
  f.providers[0].send(JSON.stringify({type:'response.created',response:{id:'r1'}}));
  f.providers[0].send(JSON.stringify({type:'response.output_audio.delta',response_id:'r1',delta:pcm.toString('base64')}));
  await until(()=>events.find(e=>e.binary));assert.deepEqual(events.find(e=>e.binary).binary,pcm);
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
test('concurrency and hourly connection limits are server-side',async t=>{
  const f=await setup(t,{maxConcurrent:1,hourlyLimit:1});const pair=await f.socket(await f.session());await until(()=>pair.events.find(e=>e.type==='ready'));
  assert.equal((await f.session()).body.code,'SESSION_LIMIT');pair.ws.close();await once(pair.ws,'close');
  assert.equal((await f.session()).body.code,'SESSION_LIMIT');
});
test('session ready timeout and hard lifetime terminate sessions',async t=>{
  const f=await setup(t,{noAck:true,handshakeTimeoutMs:120});const p=await f.socket(await f.session());
  await until(()=>p.events.find(e=>e.code==='CONNECT_TIMEOUT'));
});
test('hard lifetime stops an otherwise healthy connection',async t=>{
  const f=await setup(t,{lifetimeMs:150});const p=await f.socket(await f.session());await until(()=>p.events.find(e=>e.type==='ready'));
  await until(()=>p.events.find(e=>e.code==='SESSION_EXPIRED'));
});
test('a delayed old-session DELETE cannot kill a newly started session',async t=>{
  const f=await setup(t);const first=await f.session();const a=await f.socket(first);await until(()=>a.events.find(e=>e.type==='ready'));
  const second=await f.session({consent:true,adultTest:true,policy:REALTIME_POLICY},{Cookie:first.cookie});
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
