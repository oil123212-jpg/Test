import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { attachAccounts, POLICY } from '../scripts/accounts.mjs';

test('logged-in consent binds text logs to their owner, expiry, reset and logout', {skip:!process.env.DATABASE_URL}, async t=>{
  const server=createServer((req,res)=>void accounts.handle(req,res));
  const accounts=attachAccounts(server);
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const origin='http://127.0.0.1:'+server.address().port;
  let cookie='';
  const request=(path,method,body)=>fetch(origin+'/api/auth/'+path,{method,headers:{origin,cookie,'content-type':'application/json'},body:body&&JSON.stringify(body)});
  const req=()=>({headers:{cookie}});
  assert.equal(await accounts.recording(req()),null);
  const name='t'+randomUUID(),password='test-account-passphrase';
  t.after(async()=>{
    try {
    await pool.query('DELETE FROM momo_conversation_logs WHERE account_id IN (SELECT id FROM momo_accounts WHERE identity=$1)',['local:'+name]);
    await pool.query('DELETE FROM momo_account_sessions WHERE account_id IN (SELECT id FROM momo_accounts WHERE identity=$1)',['local:'+name]);
    await pool.query('DELETE FROM momo_accounts WHERE identity=$1',['local:'+name]);
    } finally { await pool.end();server.closeAllConnections();await new Promise(ok=>server.close(ok)); }
  });
  const login=await request('register','POST',{username:name,password});
  assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal(await accounts.recording(req()),null);
  assert.equal((await request('consent','POST',{accepted:true,policy:POLICY})).status,200);
  const writer=await accounts.recording(req()),id=(await accounts.session(req())).id;
  const count=async()=>Number((await pool.query('SELECT count(*) FROM momo_conversation_logs WHERE account_id=$1',[id])).rows[0].count);
  await writer.append('abc','child','공룡 이야기');await writer.append('abc','child','공룡 이야기');
  await writer.append('xyz','momo','공룡이 살았어.');assert.equal(await count(),2);
  assert.equal((await accounts.recording(req())).previous.topic,'dinosaur');
  await pool.query("UPDATE momo_conversation_logs SET created_at=now()-interval '49 hours' WHERE account_id=$1",[id]);
  assert.equal((await accounts.recording(req())).previous,null);
  assert.equal((await request('history','DELETE')).status,200);
  await writer.append('late','child','late');assert.equal(await count(),0);
  const fresh=await accounts.recording(req());
  assert.equal((await request('logout','POST',{})).status,200);
  await fresh.append('later','momo','later');assert.equal(await count(),0);
  assert.equal(await accounts.session(req()),undefined);
});
test('Google callback requires the initiating browser and uses the provider subject', {skip:!process.env.DATABASE_URL}, async t=>{
  const server=createServer((req,res)=>void accounts.handle(req,res));
  const accounts=attachAccounts(server);
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const origin='http://127.0.0.1:'+server.address().port;
  const old={};for(const [k,v] of Object.entries({PUBLIC_APP_ORIGIN:origin,GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'})){old[k]=process.env[k];process.env[k]=v;}
  const sub=randomUUID();const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  t.after(async()=>{
    try{
      await pool.query('DELETE FROM momo_account_sessions WHERE account_id IN (SELECT id FROM momo_accounts WHERE identity=$1)',['google:'+sub]);
      await pool.query('DELETE FROM momo_accounts WHERE identity=$1',['google:'+sub]);
    }finally{
      for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
      await pool.end();server.closeAllConnections();await new Promise(ok=>server.close(ok));
    }
  });
  const realFetch=globalThis.fetch;
  t.mock.method(globalThis,'fetch',(url,opts)=>{
    if(url==='https://oauth2.googleapis.com/token'){
      assert.ok(opts.body.get('code_verifier'));return Promise.resolve(Response.json({access_token:'test-token'}));
    }
    if(url==='https://openidconnect.googleapis.com/v1/userinfo'){
      assert.equal(opts.headers.Authorization,'Bearer test-token');return Promise.resolve(Response.json({sub}));
    }
    return realFetch(url,opts);
  });
  const start=await realFetch(origin+'/api/auth/google',{redirect:'manual'});
  const dest=new URL(start.headers.get('location'));
  assert.equal(dest.hostname,'accounts.google.com');
  assert.equal(dest.searchParams.get('code_challenge_method'),'S256');
  const callback=origin+'/api/auth/google/callback?code=test&state='+dest.searchParams.get('state');
  const stranger=await realFetch(callback,{redirect:'manual'});
  assert.equal(stranger.headers.get('location'),'/?login=failed');
  const result=await realFetch(callback,{redirect:'manual',headers:{cookie:start.headers.get('set-cookie').split(';')[0]}});
  assert.equal(result.headers.get('location'),'/?login=ok');
  const cookie=result.headers.get('set-cookie').split(';')[0];
  const session=await accounts.session({headers:{cookie}});
  assert.ok(session.id);assert.equal(session.consent,false);
});
