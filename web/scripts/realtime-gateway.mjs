import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { emptyLifeGuide, parseLifeGuide, LifeGuidePlanner } from '../shared/life-guide.mjs';
import { REALTIME_POLICY } from '../shared/realtime-policy.mjs';
import { MOMO_BASE_PROMPT, buildResponseInstructions } from './momo-prompt.mjs';
export { REALTIME_POLICY };
const MAX_FRAME = 16384;
function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}
function cookie(req) { return /(?:^|;\s*)momo_rt=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]; }
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '', size = 0, failed = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 2048) { if (!failed) reject(new Error('BODY_TOO_LARGE')); failed = true; return; }
      data += chunk;
    });
    req.on('end', () => { if (!failed) { try { resolve(JSON.parse(data)); } catch { reject(new Error('INVALID_JSON')); } } });
    req.on('error', () => reject(new Error('INVALID_JSON')));
  });
}
export function attachRealtime(server, options = {}) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
  const model = options.model ?? process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime-2';
  const voice = options.voice ?? process.env.OPENAI_REALTIME_VOICE ?? 'marin';
  const accessCode = options.accessCode ?? process.env.REALTIME_ACCESS_CODE ?? '';
  const maxSeconds = Math.max(10, Math.min(300, Number(options.maxSeconds ?? process.env.REALTIME_MAX_SECONDS) || 120));
  const maxSessions = options.maxConcurrent ?? 2;
  const hourlyLimit = options.hourlyLimit ?? 20;
  const upstreamURL = options.upstreamURL ?? `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
  const tickets = new Map(), active = new Map();
  let starts = [], admissions = [];
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME, perMessageDeflate: false });
  function originAllowed(req) {
    try {
      const origin = new URL(req.headers.origin);
      const configured = process.env.PUBLIC_APP_ORIGIN;
      return ['https:', 'http:'].includes(origin.protocol) &&
        (configured ? origin.origin === new URL(configured).origin : origin.host === req.headers.host);
    } catch { return false; }
  }
  function json(res, status, value) {
    res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
    res.end(JSON.stringify(value));
  }
  const prune = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of tickets) if (value.expires < now) tickets.delete(key);
    starts = starts.filter(time => time > now - 3600000);
  }, 10000);
  prune.unref();
  async function handle(req, res) {
    let path; try { path = new URL(req.url || '/', 'http://local').pathname; } catch { json(res,400,{code:'INVALID_REQUEST'}); return true; }
    if (!path.startsWith('/api/realtime')) return false;
    if (path === '/api/realtime/config' && req.method === 'GET') {
      json(res, 200, { available: Boolean(apiKey), requiresAccessCode: Boolean(accessCode), model, maxSeconds, policy: REALTIME_POLICY }); return true;
    }
    if (path !== '/api/realtime/session') { json(res, 404, { code:'NOT_FOUND' }); return true; }
    if (!originAllowed(req)) { json(res, 403, { code:'ORIGIN_DENIED' }); return true; }
    if (req.method === 'DELETE') {
      const owner = cookie(req), target = req.headers['x-realtime-session'];
      for (const [token, value] of tickets) if (value.owner === owner && (!target || token === target)) tickets.delete(token);
      for (const entry of [...active.values()]) if (entry.owner === owner && (!target || entry.token === target)) entry.finish();
      const other = [...tickets.values(),...active.values()].some(value => value.owner === owner);
      if (!other) res.setHeader('Set-Cookie', 'momo_rt=; HttpOnly; SameSite=Strict; Path=/api/realtime; Max-Age=0');
      json(res, 200, { ended:true }); return true;
    }
    if (req.method !== 'POST') { json(res, 405, { code:'METHOD_NOT_ALLOWED' }); return true; }
    admissions = admissions.filter(time => time > Date.now()-60000);
    if (admissions.length >= (options.admissionLimit ?? 40)) { json(res,429,{code:'SESSION_LIMIT'}); return true; }
    admissions.push(Date.now());
    if (!apiKey) { json(res, 503, { code:'API_KEY_MISSING' }); return true; }
    if (!req.headers['content-type']?.startsWith('application/json')) { json(res, 415, { code:'JSON_REQUIRED' }); return true; }
    try {
      const body = await readJson(req);
      if (body?.consent !== true || body?.policy !== REALTIME_POLICY) {
        json(res, 403, { code:'CONSENT_REQUIRED' }); return true;
      }
      if (accessCode && !safeEqual(body.accessCode, accessCode)) { json(res, 403, { code:'ACCESS_DENIED' }); return true; }
      let lifeGuide;
      try { lifeGuide = body.lifeGuide === undefined ? emptyLifeGuide() : parseLifeGuide(body.lifeGuide); }
      catch { json(res,400,{code:'INVALID_LIFE_GUIDE'}); return true; }
      starts = starts.filter(time => time > Date.now() - 3600000);
      if (tickets.size >= 128 || active.size >= maxSessions || starts.length >= hourlyLimit) {
        json(res, 429, { code:'SESSION_LIMIT' }); return true;
      }
      const owner = cookie(req) || randomBytes(32).toString('hex');
      // One pending ticket per browser; tickets are one-use and expire quickly.
      for (const [key, value] of tickets) if (value.owner === owner) tickets.delete(key);
      const token = randomBytes(32).toString('hex');
      tickets.set(token, { owner, lifeGuide, expires: Date.now() + 20000 });
      const secure = req.headers.origin?.startsWith('https:') ? '; Secure' : '';
      res.setHeader('Set-Cookie', `momo_rt=${owner}; HttpOnly; SameSite=Strict; Path=/api/realtime; Max-Age=${maxSeconds + 60}${secure}`);
      json(res, 200, { token, maxSeconds });
    } catch (error) { json(res, error.message === 'BODY_TOO_LARGE' ? 413 : 400, { code:'INVALID_REQUEST' }); }
    return true;
  }
  const onUpgrade = (req, socket, head) => {
    let path; try { path = new URL(req.url || '/', 'http://local').pathname; } catch { socket.destroy(); return; }
    if (path !== '/api/realtime' || !originAllowed(req) || !apiKey || active.size >= maxSessions) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, client => connect(client, req));
  };
  server.on('upgrade', onUpgrade);
  function connect(client, req) {
    let upstream, ready = false, finished = false, responseId = null, inputBytes = 0, outputBytes = 0;
    let planner, responseInFlight = false, cancelRequested = false, pendingTurn = false;
    let guideUpdates = [];
    const committed = new Set();
    const cancelled = new Set();
    let handshakeTimer, lifetimeTimer;
    const send = value => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(value)); };
    function finish(code) {
      if (finished) return;
      finished = true; clearTimeout(handshakeTimer); clearTimeout(lifetimeTimer);
      active.delete(client);
      if (code) send({ type:'error', code });
      if (upstream) { if (upstream.readyState === WebSocket.OPEN) upstream.close(); else upstream.terminate(); }
      if (client.readyState === WebSocket.OPEN) client.close(1000, code || 'ended');
    }
    handshakeTimer = setTimeout(() => finish('CONNECT_TIMEOUT'), options.handshakeTimeoutMs ?? 12000);
    active.set(client, { owner:cookie(req), finish });
    function upstreamSend(value) { if (upstream?.readyState === WebSocket.OPEN) upstream.send(JSON.stringify(value)); }
    function cancelResponse() {
      if (responseInFlight) cancelRequested = true;
      if (responseId && !cancelled.has(responseId)) {
        cancelled.add(responseId);
        upstreamSend({ type:'response.cancel', response_id:responseId });
        if (cancelled.size > 32) cancelled.delete(cancelled.values().next().value);
      }
      send({ type:'response.cancelled' });
    }
    function respond() {
      if (!pendingTurn || responseInFlight || !ready || finished) return;
      pendingTurn = false; responseInFlight = true; cancelRequested = false;
      const cue = planner.nextCue(options.now?.() ?? new Date());
      upstreamSend({type:'response.create',response:{instructions:buildResponseInstructions(cue)}});
    }
    client.on('message', (data, binary) => {
      if (finished) return;
      if (!upstream) {
        if (binary) { finish('AUTH_REQUIRED'); return; }
        let auth;
        try { auth = JSON.parse(data.toString()); } catch { finish('AUTH_REQUIRED'); return; }
        if (!auth || typeof auth !== 'object' || Array.isArray(auth)) { finish('AUTH_REQUIRED'); return; }
        const grant = tickets.get(auth.token);
        if (auth.type !== 'start' || !grant || grant.owner !== cookie(req) || grant.expires < Date.now()) { finish('AUTH_REQUIRED'); return; }
        tickets.delete(auth.token);
        planner = new LifeGuidePlanner(grant.lifeGuide, options.random ?? Math.random);
        active.get(client).token = auth.token;
        if (active.size > maxSessions || starts.length >= hourlyLimit) { finish('SESSION_LIMIT'); return; }
        starts.push(Date.now());
        lifetimeTimer = setTimeout(() => finish('SESSION_EXPIRED'), options.lifetimeMs ?? maxSeconds * 1000);
        upstream = new WebSocket(upstreamURL, {
          headers: { Authorization:`Bearer ${apiKey}` }, maxPayload:1024 * 1024, handshakeTimeout:10000, perMessageDeflate:false,
        });
        upstream.on('open', () => upstreamSend({ type:'session.update', session: {
          type:'realtime', output_modalities:['audio'], max_output_tokens:512,
          instructions:MOMO_BASE_PROMPT,
          audio: {
            input: { format:{type:'audio/pcm',rate:24000}, turn_detection:{type:'server_vad',threshold:0.5,prefix_padding_ms:300,silence_duration_ms:650,create_response:false,interrupt_response:true} },
            output: { format:{type:'audio/pcm',rate:24000}, voice },
          },
        }}));
        upstream.on('message', raw => {
          if (finished) return;
          let event; try { event = JSON.parse(raw.toString()); } catch { finish('UPSTREAM_PROTOCOL'); return; }
          if (!event || typeof event !== 'object') { finish('UPSTREAM_PROTOCOL'); return; }
          if (event.type === 'session.updated' && !ready) {
            ready = true; clearTimeout(handshakeTimer); send({type:'ready',maxSeconds});
          } else if (event.type === 'input_audio_buffer.speech_started') {
            if (responseInFlight) cancelResponse();
            send({type:'speech.started'});
          } else if (event.type === 'input_audio_buffer.speech_stopped') send({type:'speech.stopped'});
          else if (event.type === 'input_audio_buffer.committed' && ready && typeof event.item_id === 'string' && !committed.has(event.item_id)) {
            committed.add(event.item_id); if (committed.size > 128) committed.delete(committed.values().next().value);
            pendingTurn = true;
            if (responseInFlight) cancelResponse();
            respond();
          }
          else if (event.type === 'response.created') {
            responseId = event.response?.id; responseInFlight = true;
            if (cancelRequested) cancelResponse(); else send({type:'response.started'});
          }
          else if (event.type === 'response.output_audio.delta' && !cancelled.has(event.response_id)) {
            if (typeof event.delta !== 'string') { finish('UPSTREAM_PROTOCOL'); return; }
            const pcm = Buffer.from(event.delta, 'base64'); outputBytes += pcm.length;
            if (!pcm.length || pcm.length % 2 || outputBytes > maxSeconds * 48000 || client.bufferedAmount > 512000) { finish('AUDIO_LIMIT'); return; }
            if (client.readyState === WebSocket.OPEN) client.send(pcm, {binary:true}, () => pcm.fill(0));
            else pcm.fill(0);
          } else if (event.type === 'response.done') {
            if (event.response?.id !== responseId) return;
            responseId = null; responseInFlight = false; cancelRequested = false;
            if (cancelled.has(event.response?.id)) { respond(); return; }
            if (!['completed','cancelled'].includes(event.response?.status)) { finish('RESPONSE_FAILED'); return; }
            send({type:'response.done'}); respond();
          } else if (event.type === 'error') {
            const code = event.error?.code;
            // Never forward provider messages, prompts, tokens or transcripts.
            if (code === 'response_cancel_not_active') return;
            finish(({invalid_api_key:'API_AUTH_FAILED',insufficient_quota:'API_QUOTA',rate_limit_exceeded:'API_RATE_LIMIT',model_not_found:'MODEL_UNAVAILABLE'})[code] || 'API_REQUEST_FAILED');
          }
        });
        upstream.on('unexpected-response', (_request, response) => {
          const status = response.statusCode; response.resume();
          finish(status === 401 || status === 403 ? 'API_AUTH_FAILED' : status === 429 ? 'API_QUOTA' : status === 404 ? 'MODEL_UNAVAILABLE' : 'UPSTREAM_UNAVAILABLE');
        });
        upstream.on('error', () => finish('UPSTREAM_UNAVAILABLE'));
        upstream.on('close', () => finish(ready ? undefined : 'UPSTREAM_UNAVAILABLE'));
        return;
      }
      if (binary) {
        if (!ready || !data.length || data.length % 2 || data.length > MAX_FRAME) { finish('INVALID_AUDIO'); return; }
        inputBytes += data.length;
        if (inputBytes > (maxSeconds + 5) * 48000 || upstream.bufferedAmount > 512000) { finish('AUDIO_LIMIT'); return; }
        upstreamSend({type:'input_audio_buffer.append',audio:data.toString('base64')});
        data.fill(0);
      } else {
        let event; try { event = JSON.parse(data.toString()); } catch { finish('INVALID_REQUEST'); return; }
        if (!event || typeof event !== 'object') { finish('INVALID_REQUEST'); return; }
        if (event.type === 'cancel') { pendingTurn = false; cancelResponse(); }
        else if (event.type === 'end') finish();
        else if (event.type === 'clear') upstreamSend({type:'input_audio_buffer.clear'});
        else if (event.type === 'life_guide.update') {
          guideUpdates = guideUpdates.filter(time => time > Date.now() - 60000);
          if (guideUpdates.length >= 30) { finish('INVALID_REQUEST'); return; }
          guideUpdates.push(Date.now());
          try { planner.update(event.lifeGuide); } catch { finish('INVALID_LIFE_GUIDE'); }
        }
        else finish('INVALID_REQUEST');
      }
    });
    client.on('close', () => finish()); client.on('error', () => finish());
  }
  function dispose() {
    clearInterval(prune); tickets.clear();
    for (const entry of [...active.values()]) entry.finish();
    wss.close(); server.off('upgrade', onUpgrade);
  }
  const originalClose = server.close.bind(server);
  server.close = (...args) => { dispose(); return originalClose(...args); };
  return { handle, dispose };
}
