import { WebSocket } from 'ws';
import { loadBooks } from './book-store.mjs';

export function momoVoice(options = {}) {
  return {
    model: options.model ?? process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime-2',
    voice: options.voice ?? process.env.OPENAI_REALTIME_VOICE ?? 'marin',
  };
}

function wav(chunks, size) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + size, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36);
  header.writeUInt32LE(size, 40);
  return Buffer.concat([header, ...chunks]);
}

function narrate(text, options) {
  const {model, voice} = momoVoice(options);
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(options.upstreamURL ?? 'wss://api.openai.com/v1/realtime?model='+encodeURIComponent(model), {
      headers:{Authorization:'Bearer '+(options.apiKey ?? process.env.OPENAI_API_KEY)}, handshakeTimeout:10000,
    });
    const chunks = [];
    let size = 0, finished = false;
    function finish(audio) {
      if (finished) return;
      finished = true; clearTimeout(timer); socket.close();
      if (audio) resolve(audio); else reject(new Error('NARRATION_UNAVAILABLE'));
    }
    const timer = setTimeout(()=>finish(),90000);
    socket.on('error',()=>finish()); socket.on('close',()=>finish());
    socket.on('open',()=>socket.send(JSON.stringify({type:'session.update',session:{
      type:'realtime',output_modalities:['audio'],audio:{output:{voice,format:{type:'audio/pcm',rate:24000}}},
    }})));
    socket.on('message',raw=>{
      if(finished)return;
      try {
        const event = JSON.parse(raw);
        if(event.type==='session.updated') socket.send(JSON.stringify({type:'response.create',response:{
          instructions:'너는 한국어 AI 친구 모모야. 다음 동화 본문만 따뜻하고 또렷하게 그대로 소리 내어 읽어. 인사나 설명은 덧붙이지 마.\n'+text,
        }}));
        if(event.type==='response.output_audio.delta'){
          const chunk=Buffer.from(event.delta,'base64');size+=chunk.length;
          if(size>8*1024*1024 || chunk.length%2) {finish();return;}
          chunks.push(chunk);
        }
        if(event.type==='response.done')finish(event.response?.status==='completed' && size ? wav(chunks,size) : null);
        if(event.type==='error')finish();
      } catch {finish();}
    });
  });
}

export function bookVoiceHandler(options = {}) {
  const cache = new Map(), pending = new Map();
  let books, bytes=0;
  return async (req,res) => {
    const url = new URL(req.url,'http://local');
    if(url.pathname!=='/api/books/audio')return false;
    if(req.method!=='GET'){res.writeHead(405,{Allow:'GET'});res.end();return true;}
    try {
      books ??= loadBooks();
      const title=url.searchParams.get('book'), index=url.searchParams.get('line');
      const entry=Object.hasOwn(books,title) && /^(0|[1-9]\d*)$/.test(index) && books[title][Number(index)];
      if(!entry){res.writeHead(404);res.end();return true;}
      const text=entry[1];
      let audio=cache.get(text);
      if(!audio){
        if(!(options.apiKey ?? process.env.OPENAI_API_KEY))throw Error();
        if(!pending.has(text)){
          if(pending.size>=4){res.writeHead(429,{'Retry-After':'2'});res.end();return true;}
          pending.set(text,narrate(text,options).then(data=>{
            while(bytes+data.length>96*1024*1024 && cache.size){
              const first=cache.keys().next().value;bytes-=cache.get(first).length;cache.delete(first);
            }
            cache.set(text,data);bytes+=data.length;return data;
          }).finally(()=>pending.delete(text)));
        }
        audio=await pending.get(text);
      }
      res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':audio.length,'Cache-Control':'private, max-age=300'});
      res.end(audio);
    }catch{res.writeHead(503,{'Cache-Control':'no-store'});res.end();}
    return true;
  };
}
