import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';
import { classifyTopic } from '../shared/topic-memory.mjs';

export const POLICY = 'account-voice-log-48h-v2';
const derive = promisify(scrypt);
const secret = () => randomBytes(32).toString('hex');
const digest = s => createHash('sha256').update(s).digest('hex');
const cookie = (req,key) => (req.headers.cookie || '').split('; ').find(v=>v.startsWith(key+'='))?.slice(key.length+1);
const sid = req => { const s=cookie(req,'momo_account'); return /^[a-f0-9]{64}$/.test(s||'') ? digest(s) : null; };
function json(res,status,value) {
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(value));
}
async function input(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw Error('INVALID_REQUEST');
  let size=0;const chunks=[];
  for await (const c of req) { if ((size+=c.length)>4096) throw Error('INVALID_REQUEST'); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw Error('INVALID_REQUEST'); }
}
export function attachAccounts(server, connectionString=process.env.DATABASE_URL) {
  const pool=connectionString ? new pg.Pool({connectionString,max:4,connectionTimeoutMillis:5000,query_timeout:8000}):null;
  pool?.on('error',()=>console.error('ACCOUNT_DB_CONNECTION'));
  let initialized;
  async function query(sql,args) {
    if (!pool) throw Error('DATABASE_NOT_CONFIGURED');
    initialized ??= pool.query(`CREATE TABLE IF NOT EXISTS momo_accounts (
      id text PRIMARY KEY, identity text UNIQUE NOT NULL, verifier text, consent boolean NOT NULL DEFAULT false,
      policy text, decided_at timestamptz, log_epoch integer NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS momo_account_sessions (token text PRIMARY KEY, account_id text NOT NULL REFERENCES momo_accounts(id), expires timestamptz NOT NULL);
      CREATE TABLE IF NOT EXISTS momo_conversation_logs (account_id text NOT NULL REFERENCES momo_accounts(id), event_key text NOT NULL,
      speaker text NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(account_id,event_key));
      CREATE INDEX IF NOT EXISTS momo_log_time ON momo_conversation_logs(created_at);`).catch(e=>{initialized=undefined;throw e});
    await initialized;return pool.query(sql,args);
  }
  const valid=`FROM momo_account_sessions s JOIN momo_accounts a ON a.id=s.account_id WHERE s.token=$1 AND s.expires>now()`;
  async function session(req) {
    const token=sid(req);if (!token) return null;
    return (await query('SELECT a.id, a.consent AND a.policy=$2 AS consent, a.log_epoch '+valid,[token,POLICY])).rows[0];
  }
  async function recording(req) {
    const account=await session(req);
    if (!account?.consent) return null;
    const args=[sid(req),POLICY,account.log_epoch];
    const allowed=valid+' AND a.consent AND a.policy=$2 AND a.log_epoch=$3';
    const recent=await query('SELECT l.body,l.created_at FROM momo_conversation_logs l WHERE l.account_id IN (SELECT a.id '+allowed+") AND l.speaker='child' AND l.created_at>now()-interval '48 hours' ORDER BY l.created_at DESC LIMIT 12",args);
    let previous=null;
    for(const row of recent.rows){const topic=classifyTopic(row.body);if(topic){previous={topic,at:row.created_at.getTime()};break;}}
    return {previous, async append(key,speaker,body) {
      if(typeof key!=='string'||!key||typeof body!=='string'||!body.trim())return;
      await query('INSERT INTO momo_conversation_logs(account_id,event_key,speaker,body) SELECT a.id,$4,$5,$6 '+allowed+' ON CONFLICT DO NOTHING',[...args,key,speaker,body]);
    }};
  }
  async function purge() {
    await query("DELETE FROM momo_conversation_logs WHERE created_at<=now()-interval '48 hours'");
    await query('DELETE FROM momo_account_sessions WHERE expires<=now()');
  }
  const sweep=()=>{if(pool) void purge().catch(()=>console.error('ACCOUNT_CLEANUP_FAILED'));};
  sweep();const timer=setInterval(sweep,60000);timer.unref();
  server.once('close',()=>{clearInterval(timer);void pool?.end()});
  const attempts=new Map(), states=new Map();
  function permit(key,limit) {
    const now=Date.now();
    for(const [k,v] of attempts)if(v.until<=now) attempts.delete(k);
    const row=attempts.get(key)||{count:0,until:now+60000};
    attempts.set(key,row);return ++row.count<=limit;
  }
  const googleReady=()=>Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.PUBLIC_APP_ORIGIN);
  async function handle(req,res) {
    const url=new URL(req.url,'http://local');
    if (!url.pathname.startsWith('/api/auth/'))return false;
    const action=url.pathname.slice(10);
    const origin=process.env.PUBLIC_APP_ORIGIN || req.headers.origin;
    const secure=process.env.NODE_ENV==='production'||origin?.startsWith('https:')?'; Secure':'';
    const tokenCookie=(value,age)=>'momo_account='+value+'; HttpOnly; SameSite=Lax; Path=/; Max-Age='+age+secure;
    async function issue(id) {
      const token=secret();
      await query("INSERT INTO momo_account_sessions VALUES($1,$2,now()+interval '12 hours')",[digest(token),id]);
      res.setHeader('Set-Cookie',tokenCookie(token,43200));
    }
    const redirect=location=>{res.writeHead(303,{Location:location,'Cache-Control':'no-store'});res.end();};
    try {
      if(req.method!=='GET' && (!req.headers.origin || (process.env.PUBLIC_APP_ORIGIN ? req.headers.origin!==process.env.PUBLIC_APP_ORIGIN : new URL(req.headers.origin).host!==req.headers.host))) {json(res,403,{code:'ORIGIN_DENIED'});return true;}
      if(req.method==='GET' && action==='session'){
        const who=await session(req);json(res,200,{authenticated:!!who,consent:!!who?.consent,google:googleReady()});return true;
      }
      if(action==='google' && req.method==='GET'){
        if(!googleReady()){json(res,503,{code:'GOOGLE_NOT_CONFIGURED'});return true;}
        for(const [k,v] of states)if(v.until<Date.now())states.delete(k);
        if(states.size>=2048){json(res,429,{});return true;}
        const state=secret(), verifier=secret();
        states.set(state,{verifier,until:Date.now()+300000});
        res.setHeader('Set-Cookie','momo_oauth='+state+'; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=300'+secure);
        const params=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:origin+'/api/auth/google/callback',response_type:'code',scope:'openid',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
        redirect('https://accounts.google.com/o/oauth2/v2/auth?'+params);return true;
      }
      if(action==='google/callback' && req.method==='GET'){
        const state=url.searchParams.get('state'),pending=states.get(state);
        if(!pending||pending.until<Date.now()||cookie(req,'momo_oauth')!==state||!googleReady()){redirect('/?login=failed');return true;}
        states.delete(state);
        const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(8000),body:new URLSearchParams({code:url.searchParams.get('code')||'',client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,grant_type:'authorization_code',code_verifier:pending.verifier,redirect_uri:origin+'/api/auth/google/callback'})});
        if(!response.ok){redirect('/?login=failed');return true;}
        const {access_token}=await response.json();
        const info=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+access_token}});
        const sub=info.ok?(await info.json()).sub:null;
        if(typeof sub!=='string'||!sub){redirect('/?login=failed');return true;}
        const {rows}=await query('INSERT INTO momo_accounts(id,identity) VALUES($1,$2) ON CONFLICT(identity) DO UPDATE SET identity=excluded.identity RETURNING id',[secret(),'google:'+sub]);
        await issue(rows[0].id);redirect('/?login=ok');return true;
      }
      if(req.method==='POST' && ['register','login'].includes(action)){
        if(!permit('global',60)){json(res,429,{});return true;}
        const data=await input(req),name=String(data?.username||'').trim().toLowerCase(),pw=data?.password;
        if(!/^[a-z0-9_.-]{3,40}$/.test(name)||typeof pw!=='string'||pw.length<12||pw.length>128){json(res,400,{code:'INVALID_CREDENTIALS'});return true;}
        if(!permit(name,10)){json(res,429,{});return true;}
        const identity='local:'+name;
        const existing=(await query('SELECT id,verifier FROM momo_accounts WHERE identity=$1',[identity])).rows[0];
        const salt=existing?.verifier?.split('.')[0]||secret();
        const key=await derive(pw,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
        if(action==='register'){
          const id=secret();
          const saved=await query('INSERT INTO momo_accounts(id,identity,verifier) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[id,identity,salt+'.'+key.toString('hex')]);
          if(!saved.rowCount){json(res,409,{code:'NAME_UNAVAILABLE'});return true;}await issue(id);
        }else{
          if(!existing||!timingSafeEqual(key,Buffer.from(existing.verifier.split('.')[1],'hex'))){json(res,401,{code:'INVALID_CREDENTIALS'});return true;}
          await issue(existing.id);
        }
        json(res,200,{ok:true});return true;
      }
      if(req.method==='POST'&&action==='logout'){
        if(sid(req))await query('DELETE FROM momo_account_sessions WHERE token=$1',[sid(req)]);
        res.setHeader('Set-Cookie',tokenCookie('',0));json(res,200,{ok:true});return true;
      }
      const who=await session(req);if(!who){json(res,401,{code:'LOGIN_REQUIRED'});return true;}
      if(req.method==='POST'&&action==='consent'){
        const data=await input(req);
        if(data?.policy!==POLICY||typeof data.accepted!=='boolean'){json(res,400,{});return true;}
        await query('UPDATE momo_accounts SET consent=$2,policy=$3,decided_at=now(), log_epoch=log_epoch+1 WHERE id=$1',[who.id,data.accepted,POLICY]);
        json(res,200,{ok:true});return true;
      }
      if(req.method==='DELETE'&&action==='history'){
        await query('WITH cleared AS (UPDATE momo_accounts SET log_epoch=log_epoch+1 WHERE id=$1 RETURNING id) DELETE FROM momo_conversation_logs WHERE account_id IN (SELECT id FROM cleared)',[who.id]);json(res,200,{ok:true});return true;
      }
      json(res,404,{code:'NOT_FOUND'});
    }catch(err){json(res,err.message==='INVALID_REQUEST'?400:503,{code:err.message==='INVALID_REQUEST'?'INVALID_REQUEST':'ACCOUNT_UNAVAILABLE'});}
    return true;
  }
  return {handle,session,recording};
}
