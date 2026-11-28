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