import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';
import { parseLifeGuide } from '../shared/life-guide.mjs';
import { parseChildProfile, PARENT_SETTINGS_POLICY } from '../shared/child-profile.mjs';
export const STORAGE_POLICY = PARENT_SETTINGS_POLICY;
export function parseSchedule(value) {
  if (!value || Object.keys(value).some(key => !['version','timeZone','slots'].includes(key))) throw new Error('INVALID_SCHEDULE');
  const { version, timeZone, slots } = parseLifeGuide({ ...value, enabled:false });
  return { version, timeZone, slots };
}
export function postgresLifeGuideStore(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) return null;
  const pool = new pg.Pool({ connectionString, max:5, connectionTimeoutMillis:5000, query_timeout:5000, idleTimeoutMillis:10000 });
  // Never log provider errors: they can contain connection details or SQL values.
  pool.on('error', () => console.error('LIFE_GUIDE_DB_POOL_ERROR'));
  let initialized;
  function ready() {
    if (!initialized) initialized = pool.query(`CREATE TABLE IF NOT EXISTS momo_life_guides (
      device_hash text PRIMARY KEY CHECK (length(device_hash) = 64),
      schedule jsonb NOT NULL
    ); CREATE TABLE IF NOT EXISTS momo_child_profiles (
      device_hash text PRIMARY KEY CHECK (length(device_hash) = 64),
      profile jsonb NOT NULL
    )`).catch(error => { initialized = undefined; throw error; });
    return initialized;
  }
  return {
    ready,
    async get(device) { await ready(); const result = await pool.query('SELECT schedule FROM momo_life_guides WHERE device_hash = $1',[device]); return result.rows[0]?.schedule ?? null; },
    async save(device, schedule) { await ready(); await pool.query('INSERT INTO momo_life_guides (device_hash, schedule) VALUES ($1, $2::jsonb) ON CONFLICT (device_hash) DO UPDATE SET schedule = EXCLUDED.schedule',[device,JSON.stringify(parseSchedule(schedule))]); },
    async delete(device) { await ready(); await pool.query('DELETE FROM momo_life_guides WHERE device_hash = $1',[device]); },
    async getProfile(device) { await ready(); const result=await pool.query('SELECT profile FROM momo_child_profiles WHERE device_hash = $1',[device]); return result.rows[0]?.profile ?? null; },
    async saveProfile(device,profile) { await ready(); await pool.query('INSERT INTO momo_child_profiles (device_hash, profile) VALUES ($1, $2::jsonb) ON CONFLICT (device_hash) DO UPDATE SET profile = EXCLUDED.profile',[device,JSON.stringify(parseChildProfile(profile))]); },
    async deleteProfile(device) { await ready(); await pool.query('DELETE FROM momo_child_profiles WHERE device_hash = $1',[device]); },
    close: () => pool.end(),
  };
}
export function attachLifeGuideStorage(server, { store = postgresLifeGuideStore(), now = Date.now } = {}) {
  const sessions = new Map();
  let admissions = [];
  const readCookie = (req, name) => new RegExp(`(?:^|;\\s*)${name}=([a-f0-9]{64})(?:;|$)`).exec(req.headers.cookie || '')?.[1];
  const hash = value => createHash('sha256').update(value).digest('hex');
  const prune = () => { for (const [key, session] of sessions) if (session.expires <= now()) sessions.delete(key); };
  const timer = setInterval(prune,60000); timer.unref();
  function json(res, status, value) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
  function originAllowed(req) {
    try { const origin = new URL(req.headers.origin); return ['https:','http:'].includes(origin.protocol) && (process.env.PUBLIC_APP_ORIGIN ? origin.origin === new URL(process.env.PUBLIC_APP_ORIGIN).origin : origin.host === req.headers.host); }
    catch { return false; }
  }
  function body(req) {
    return new Promise((resolve,reject) => {
      let data = '', size = 0, failed = false;
      req.on('data',chunk => {
        size += chunk.length;
        if (size > 2048) { if(!failed) reject(new Error('BODY_TOO_LARGE')); failed = true; return; }
        data += chunk;
      });
      req.on('end',() => {if(!failed) {try {resolve(JSON.parse(data));}catch {reject(new SyntaxError('INVALID_JSON'));}}});
      req.on('error',() => reject(new SyntaxError('INVALID_JSON')));
    });
  }
  function identify(req) {
    const token = readCookie(req,'momo_device_session'), device = readCookie(req,'momo_device');
    const session = sessions.get(token);
    if (!device || !session || session.expires <= now() || session.device !== hash(device)) return null;
    return { ...session, token };
  }
  async function handle(req,res) {
    let path;
    try { path = new URL(req.url || '/', 'http://local').pathname; } catch { return false; }
    if (path !== '/api/life-guide' && !path.startsWith('/api/life-guide/')) return false;
    if (path === '/api/life-guide/config' && req.method === 'GET') { json(res,200,{available:Boolean(store),policy:STORAGE_POLICY}); return true; }
    if (!['/api/life-guide','/api/life-guide/profile','/api/life-guide/login','/api/life-guide/logout'].includes(path)) { json(res,404,{code:'NOT_FOUND'}); return true; }
    if (req.method !== 'GET' && !originAllowed(req)) { json(res,403,{code:'ORIGIN_DENIED'}); return true; }
    if (req.method === 'GET' && req.headers['sec-fetch-site'] === 'cross-site') { json(res,403,{code:'ORIGIN_DENIED'}); return true; }
    try {
      if (path === '/api/life-guide/logout' && req.method === 'POST') {
        const session = identify(req);
        // Target a specific login so a delayed logout cannot revoke a later one.
        if (session && req.headers['x-device-session'] === session.token) {
          sessions.delete(session.token);
        }
        json(res,200,{ended:true}); return true;
      }
      if (!store) { json(res,503,{code:'DATABASE_NOT_CONFIGURED'}); return true; }
      if (path === '/api/life-guide/login' && req.method === 'POST') {
        if (!req.headers['content-type']?.startsWith('application/json')) { json(res,415,{code:'JSON_REQUIRED'}); return true; }
        const value = await body(req);
        if (value?.consent !== true || value?.policy !== STORAGE_POLICY) { json(res,403,{code:'CONSENT_REQUIRED'}); return true; }
        admissions = admissions.filter(time => time > now()-60000);
        prune();
        if(admissions.length >= 100 || sessions.size >= 1000) { json(res,429,{code:'SESSION_LIMIT'}); return true; }
        admissions.push(now());
        await store.ready();
        const device = readCookie(req,'momo_device') || randomBytes(32).toString('hex');
        const token = randomBytes(32).toString('hex');
        const old = identify(req); if (old) sessions.delete(old.token);
        sessions.set(token,{device:hash(device),expires:now()+12*3600000});
        const secure = req.headers.origin?.startsWith('https:') ? '; Secure' : '';
        res.setHeader('Set-Cookie',[
          `momo_device=${device}; HttpOnly; SameSite=Strict; Path=/api/life-guide; Max-Age=31536000${secure}`,
          `momo_device_session=${token}; HttpOnly; SameSite=Strict; Path=/api/life-guide${secure}`,
        ]);
        json(res,200,{sessionId:token}); return true;
      }
      if (!['/api/life-guide','/api/life-guide/profile'].includes(path)) { json(res,405,{code:'METHOD_NOT_ALLOWED'}); return true; }
      const session = identify(req);
      if (!session) { json(res,401,{code:'LOGIN_REQUIRED'}); return true; }
      if (path === '/api/life-guide/profile') {
        if (req.method === 'GET') { const profile=await store.getProfile(session.device); json(res,200,{profile:profile ? parseChildProfile(profile) : null}); return true; }
        if (req.method === 'PUT') {
          if (!req.headers['content-type']?.startsWith('application/json')) {json(res,415,{code:'JSON_REQUIRED'});return true;}
          let profile; try {profile=parseChildProfile(await body(req));}catch {json(res,400,{code:'INVALID_PROFILE'});return true;}
          await store.saveProfile(session.device,profile);json(res,200,{profile});return true;
        }
        if (req.method === 'DELETE') {await store.deleteProfile(session.device);json(res,200,{deleted:true});return true;}
        json(res,405,{code:'METHOD_NOT_ALLOWED'});return true;
      }
      if (req.method === 'GET') {
        const saved = await store.get(session.device);
        json(res,200,{schedule:saved ? parseSchedule(saved) : null}); return true;
      }
      if (req.method === 'PUT') {
        if (!req.headers['content-type']?.startsWith('application/json')) { json(res,415,{code:'JSON_REQUIRED'}); return true; }
        let schedule;
        try { schedule = parseSchedule(await body(req)); } catch { json(res,400,{code:'INVALID_SCHEDULE'}); return true; }
        await store.save(session.device,schedule); json(res,200,{schedule}); return true;
      }
      if (req.method === 'DELETE') { await store.delete(session.device); json(res,200,{deleted:true}); return true; }
      json(res,405,{code:'METHOD_NOT_ALLOWED'});
    } catch(error) {
      if (error instanceof SyntaxError || error.message === 'BODY_TOO_LARGE') json(res,400,{code:'INVALID_REQUEST'});
      else { console.error('LIFE_GUIDE_DB_UNAVAILABLE'); json(res,503,{code:'DATABASE_UNAVAILABLE'}); }
    }
    return true;
  }
  server.once('close',() => {clearInterval(timer);sessions.clear();void Promise.resolve(store?.close()).catch(()=>{});});
  return {handle};
}
