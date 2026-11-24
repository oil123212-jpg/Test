import {memoryHint,memoryTTL,type TopicMemory} from '../shared/topic-memory.mjs';

// Browser expiry also applies while the application is closed.
const name='momo_topic';
function read(): {epoch:string; memory:TopicMemory|null}|null {
  try {
    const raw=document.cookie.split('; ').find(c=>c.startsWith(name+'='))?.slice(name.length+1);
    if(!raw) return null;
    const value=JSON.parse(decodeURIComponent(raw));
    if(typeof value.epoch!=='string')return null;
    return {epoch:value.epoch,memory:memoryHint(value.memory)?value.memory:null};
  } catch { return null; }
}
function write(value:string,age:number) {
  document.cookie=name+'='+value+'; Path=/; SameSite=Strict; Max-Age='+age+(location.protocol==='https:'?'; Secure':'');
}
export function openMemory() {
  let entry=read();
  if(!entry){
    entry={epoch:crypto.randomUUID(),memory:null};
    write(encodeURIComponent(JSON.stringify(entry)),memoryTTL/1000);
  }
  return entry;
}
export function saveMemory(epoch:string, memory:TopicMemory) {
  const entry=read();
  if(entry?.epoch!==epoch || !memoryHint(memory) || (entry.memory && entry.memory.at>memory.at))return;
  write(encodeURIComponent(JSON.stringify({epoch,memory})),Math.ceil((memory.at+memoryTTL-Date.now())/1000));
}
export function clearMemory(){write('',0);}
