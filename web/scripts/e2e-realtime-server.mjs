// Test runner only. Not copied into the production Docker image.
import { WebSocketServer } from 'ws';
import { once } from 'node:events';
import { createAppServer } from './serve.mjs';
import { postgresLifeGuideStore } from './life-guide-store.mjs';
const rows = new Map();
const store = process.env.LIFE_GUIDE_TEST_DATABASE_URL ? postgresLifeGuideStore(process.env.LIFE_GUIDE_TEST_DATABASE_URL) : {
  ready: async()=>{},get:async key=>rows.get(key)??null,save:async(key,value)=>{rows.set(key,structuredClone(value));},delete:async key=>{rows.delete(key);},close:async()=>{},
};
const provider=new WebSocketServer({port:0,host:'127.0.0.1'});await once(provider,'listening');
provider.on('connection',socket=>{
  let frames=0,sequence=0;
  const timers=new Set();
  socket.on('message',raw=>{
    const event=JSON.parse(raw.toString());
    if(event.type==='session.update') socket.send(JSON.stringify({type:'session.updated'}));
    if(event.type==='input_audio_buffer.append') {
      const pcm=Buffer.from(event.audio,'base64');
      if(pcm.some(byte=>byte!==0)) frames+=pcm.length/2;
      pcm.fill(0);
      if(frames>=24000) {
        frames=0;
        for(const value of [{type:'input_audio_buffer.speech_started'},{type:'input_audio_buffer.speech_stopped'},{type:'input_audio_buffer.committed',item_id:'input-'+(++sequence)}]) socket.send(JSON.stringify(value));
      }
    }
    if(event.type==='response.create') {
        const id='mock-'+sequence;
        socket.send(JSON.stringify({type:'response.created',response:{id}}));
        const audio=Buffer.alloc(9600);
        for(let i=0;i<4800;i++) audio.writeInt16LE(Math.round(Math.sin(2*Math.PI*440*i/24000)*15000),i*2);
        socket.send(JSON.stringify({type:'response.output_audio.delta',response_id:id,delta:audio.toString('base64')}));audio.fill(0);
        const timer=setTimeout(()=>{timers.delete(timer);if(socket.readyState===1)socket.send(JSON.stringify({type:'response.done',response:{id,status:'completed'}}));},250);timers.add(timer);
    }
    if(event.type==='response.cancel') socket.send(JSON.stringify({type:'response.done',response:{id:event.response_id,status:'cancelled'}}));
  });
  socket.on('close',()=>timers.forEach(clearTimeout));
});
const server=createAppServer(undefined,{apiKey:'mock-provider-key-never-published',model:'mock-realtime',upstreamURL:`ws://127.0.0.1:${provider.address().port}`,hourlyLimit:200,maxConcurrent:4},{store});
server.listen(Number(process.env.PORT||4173),'0.0.0.0');
const close=()=>{for(const client of provider.clients)client.terminate();server.close(()=>provider.close(()=>process.exit(0)));setTimeout(()=>process.exit(0),2000).unref();};
process.once('SIGTERM',close);process.once('SIGINT',close);
