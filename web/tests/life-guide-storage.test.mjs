import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {createAppServer} from '../scripts/serve.mjs';
import {postgresLifeGuideStore,STORAGE_POLICY} from '../scripts/life-guide-store.mjs';
const schedule={version:1,timeZone:'Asia/Seoul',slots:{meal:[16,24,36],sleep:[42],tidy:[32]}};
async function setup(t,options={}) {
  const rows=new Map();
  const store=options.store===undefined?{ready:async()=>{},get:async key=>rows.get(key)??null,save:async(key,value)=>rows.set(key,value),delete:async key=>rows.delete(key),close:async()=>{}}:options.store;
  const app=createAppServer(undefined,{apiKey:''},{store,...options});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${app.address().port}`;
  t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));});
  async function request(path='',method='GET',value, cookies='',headers={}) {
    const response=await fetch(origin+'/api/life-guide'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookies?{Cookie:cookies}:{}),...headers},body:value===undefined?undefined:JSON.stringify(value)});
    const body=await response.json();
    return {response,body,cookies:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
  }
  const login=async cookies=>request('/login','POST',{consent:true,policy:STORAGE_POLICY},cookies);
  return {app,store,rows,request,login};
}
test('DB storage fails clearly when DATABASE_URL is missing and no secrets are returned',async t=>{
  const f=await setup(t,{store:null});assert.deepEqual((await f.request('/config')).body,{available:false,policy:STORAGE_POLICY});
  assert.equal((await f.login()).body.code,'DATABASE_NOT_CONFIGURED');
});
test('login and Origin checks protect all mutations; another browser cannot read a saved schedule',async t=>{
  const f=await setup(t);
  for(const method of ['GET','PUT','DELETE'])assert.equal((await f.request('',method,method==='PUT'?schedule:undefined)).response.status,401);
  assert.equal((await f.request('/login','POST',{consent:false,policy:STORAGE_POLICY})).response.status,403);
  assert.equal((await f.request('/login','POST',{consent:true,policy:STORAGE_POLICY},'',{Origin:'https://elsewhere.example'})).response.status,403);
  const a=await f.login(),b=await f.login();
  assert.match(a.response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  await f.request('','PUT',schedule,a.cookies);
  assert.deepEqual((await f.request('','GET',undefined,a.cookies)).body.schedule,schedule);
  assert.equal((await f.request('','GET',undefined,b.cookies)).body.schedule,null);
  for(const method of ['PUT','DELETE'])assert.equal((await f.request('',method,method==='PUT'?schedule:undefined,a.cookies,{Origin:'https://elsewhere.example'})).response.status,403);
  assert.equal((await f.request('','GET',undefined,a.cookies,{'Sec-Fetch-Site':'cross-site'})).response.status,403);
  assert.equal(f.rows.size,1);assert.match([...f.rows.keys()][0],/^[a-f0-9]{64}$/);
});
test('only the time schedule is persisted; enabled, transcript and invalid slots are rejected',async t=>{
  const f=await setup(t);const a=await f.login();
  for(const value of [{...schedule,enabled:true},{...schedule,transcript:'hello'},{...schedule,slots:{...schedule.slots,meal:[48]}},{...schedule,timeZone:'SELECT secret'},null])assert.equal((await f.request('','PUT',value,a.cookies)).response.status,400);
  assert.equal(f.rows.size,0);
  assert.equal((await f.request('','PUT',schedule,a.cookies)).response.status,200);
  assert.deepEqual([...f.rows.values()][0],schedule);
});
test('logout revokes access, re-login recalls the same browser, delete removes its row only',async t=>{
  const f=await setup(t);const a=await f.login();await f.request('','PUT',schedule,a.cookies);
  const b=await f.login();await f.request('','PUT',schedule,b.cookies);
  await f.request('/logout','POST',undefined,a.cookies,{'X-Device-Session':a.body.sessionId});
  assert.equal((await f.request('','GET',undefined,a.cookies)).response.status,401);
  const again=await f.login(a.cookies);assert.deepEqual((await f.request('','GET',undefined,again.cookies)).body.schedule,schedule);
  await f.request('','DELETE',undefined,again.cookies);assert.equal((await f.request('','GET',undefined,again.cookies)).body.schedule,null);
  assert.deepEqual((await f.request('','GET',undefined,b.cookies)).body.schedule,schedule);
});
test('old logout cannot clear a new login cookie or session and sessions expire',async t=>{
  let now=Date.now();const f=await setup(t,{now:()=>now});const first=await f.login();const next=await f.login(first.cookies);
  const result=await f.request('/logout','POST',undefined,next.cookies,{'X-Device-Session':first.body.sessionId});
  assert.equal(result.response.headers.get('set-cookie'),null);assert.equal((await f.request('','GET',undefined,next.cookies)).response.status,200);
  now+=12*3600000+1;assert.equal((await f.request('','GET',undefined,next.cookies)).response.status,401);
});
test('oversized requests fail without disconnecting the server and login creates no data row',async t=>{
  const f=await setup(t);
  const large=await f.request('/login','POST',{consent:true,policy:STORAGE_POLICY,extra:'x'.repeat(3000)});
  assert.equal(large.response.status,400);
  const login=await f.login();assert.equal(login.response.status,200);assert.equal(f.rows.size,0);
});
test('database errors are sanitized and health and local web still work',async t=>{
  const f=await setup(t,{store:{ready:async()=>{throw new Error('postgres://private-password-and-host');},close:async()=>{}}});
  const result=await f.login();assert.equal(result.response.status,503);assert.deepEqual(result.body,{code:'DATABASE_UNAVAILABLE'});
  assert.equal(result.response.headers.get('set-cookie'),null);
  const origin=f.app.address();assert.equal((await fetch(`http://127.0.0.1:${origin.port}/health`)).status,200);
});
test('actual PostgreSQL persists only schedules across server restarts and deletes correctly',{skip:!process.env.LIFE_GUIDE_TEST_DATABASE_URL},async t=>{
  const url=process.env.LIFE_GUIDE_TEST_DATABASE_URL;
  const first=await setup(t,{store:postgresLifeGuideStore(url)});const login=await first.login();
  assert.equal(login.response.status,200);await first.request('','PUT',schedule,login.cookies);
  first.app.closeAllConnections();await new Promise(resolve=>first.app.close(resolve));
  const second=await setup(t,{store:postgresLifeGuideStore(url)});const again=await second.login(login.cookies);
  assert.deepEqual((await second.request('','GET',undefined,again.cookies)).body.schedule,schedule);
  const pool=new pg.Pool({connectionString:url});
  try {
    const columns=await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='momo_life_guides' ORDER BY ordinal_position");
    assert.deepEqual(columns.rows.map(row=>row.column_name),['device_hash','schedule']);
    const device=/momo_device=([a-f0-9]+)/.exec(again.cookies)[1];const key=createHash('sha256').update(device).digest('hex');
    assert.deepEqual((await pool.query('SELECT schedule FROM momo_life_guides WHERE device_hash=$1',[key])).rows[0].schedule,schedule);
    await second.request('','DELETE',undefined,again.cookies);
    assert.equal((await pool.query('SELECT device_hash FROM momo_life_guides WHERE device_hash=$1',[key])).rowCount,0);
  }finally {await pool.end();}
});
