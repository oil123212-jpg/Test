import { INTERESTS, parseChildProfile, type ChildProfile } from '../shared/child-profile.mjs';
import { mountIcons } from './icons';

export function mountChildProfile(onChange:(profile:ChildProfile|null)=>void, requestLogin:()=>void) {
  const el = <T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const name=el<HTMLInputElement>('profile-name'),age=el<HTMLSelectElement>('profile-age'),status=el('profile-status');
  let profile:ChildProfile|null=null,loggedIn=false,busy=false,dirty=false,generation=0;
  let selected=new Set<string>(),controller:AbortController|null=null;
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('momo.child-profile'):null;
  const buttons=new Map<string,HTMLButtonElement>();
  function grid(items:typeof INTERESTS) {
    const root=document.createElement('div');root.className='interest-grid';
    for(const item of items) {
      const button=document.createElement('button');button.type='button';button.className='interest-button';button.dataset.interest=item.id;button.setAttribute('aria-pressed','false');
      const icon=document.createElement('span');icon.dataset.icon=item.icon;
      const label=document.createElement('span');label.textContent=item.label;
      const check=document.createElement('span');check.dataset.icon='check';check.className='interest-check';
      button.append(icon,label,check);buttons.set(item.id,button);root.append(button);
      button.addEventListener('click',()=>{selected.has(item.id)?selected.delete(item.id):selected.add(item.id);markDirty();button.focus({preventScroll:true});button.scrollIntoView({block:'nearest'});});
    }
    return root;
  }
  const options=el('profile-interest-options');
  const allOptions=grid(INTERESTS);options.append(allOptions);
  mountIcons(options);
  function selection() {
    for(const [id,button] of buttons) {button.classList.toggle('selected',selected.has(id));button.setAttribute('aria-pressed',String(selected.has(id)));}
    el('profile-interest-count').textContent=`${selected.size}개 선택`;
    const ordered=[...INTERESTS.filter(item=>selected.has(item.id)),...INTERESTS.filter(item=>!selected.has(item.id))];
    ordered.forEach((item,index)=>{const button=buttons.get(item.id)!;const before=allOptions.children[index];if(before!==button)allOptions.insertBefore(button,before??null);});
  }
  function controls() {
    el('child-profile-form').querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button').forEach(input=>{input.disabled=busy;});
    el<HTMLButtonElement>('profile-delete').disabled=busy||!loggedIn||!profile;
  }
  function render() {
    name.value=profile?.name??'';age.value=profile?String(profile.age):'';selected=new Set(profile?.interests??[]);dirty=false;selection();controls();
  }
  function markDirty() {dirty=true;selection();status.textContent='변경한 내용이 있어요. 프로필 저장을 눌러 주세요.';}
  name.addEventListener('input',markDirty);age.addEventListener('change',markDirty);
  function message(error:unknown) {
    const code=error instanceof Error?error.message:'';
    if(code==='LOGIN_REQUIRED')return '체험 로그인 후 다시 저장해 주세요.';
    if(code==='DATABASE_NOT_CONFIGURED')return 'DB 연결 설정이 필요해요. Railway의 DATABASE_URL을 확인해 주세요.';
    if(code==='INVALID_PROFILE')return '이름은 1~30자의 글자로, 나이는 3~6세로 입력해 주세요.';
    return '프로필을 처리하지 못했어요. 네트워크와 DB 연결을 확인하고 다시 시도해 주세요.';
  }
  async function api(method:string,value?:ChildProfile,signal?:AbortSignal) {
    const response=await fetch('/api/life-guide/profile',{method,credentials:'same-origin',cache:'no-store',signal,headers:value?{'Content-Type':'application/json'}:{},body:value?JSON.stringify(value):undefined});
    const result=await response.json();if(!response.ok) {if(response.status===401)loggedIn=false;throw new Error(result.code);}return result;
  }
  async function load() {
    if(!loggedIn)return;
    const id=++generation;controller?.abort();controller=new AbortController();busy=true;controls();status.textContent='프로필을 불러오고 있어요…';
    try {
      const result=await api('GET',undefined,controller.signal);if(id!==generation)return;
      profile=result.profile?parseChildProfile(result.profile):null;onChange(profile);
      if(!dirty)render();
      status.textContent=dirty?'입력한 내용을 유지했어요. 프로필 저장을 눌러 주세요.':profile?'저장된 프로필을 불러왔어요.':'아이의 프로필을 입력해 주세요.';
      el('profile-reload').hidden=true;
    }catch(error) {if(id===generation){status.textContent=message(error);el('profile-reload').hidden=false;}}
    finally {if(id===generation){busy=false;controls();}}
  }
  function session(value:boolean,error?:unknown) {
    loggedIn=value;
    if(value) {void load();return;}
    if(error) {
      generation++;controller?.abort();busy=false;profile=null;onChange(null);if(!dirty)render();controls();status.textContent=message(error);el('profile-reload').hidden=false;return;
    }
    generation++;controller?.abort();controller=null;busy=false;profile=null;onChange(null);render();
    status.textContent='체험 로그인 후 프로필을 저장할 수 있어요.';el('profile-reload').hidden=true;
  }
  el('child-profile-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    let next:ChildProfile;
    try {next=parseChildProfile({version:1,name:name.value,age:Number(age.value),interests:[...selected]});}
    catch(error){status.textContent=message(error);return;}
    if(!loggedIn){requestLogin();return;}
    const id=generation;busy=true;controls();status.textContent='프로필을 저장하고 있어요…';
    try {const result=await api('PUT',next);if(id!==generation)return;profile=parseChildProfile(result.profile);onChange(profile);render();channel?.postMessage('changed');status.textContent='프로필을 저장했어요. 다음 답변부터 적용해요.';}
    catch(error){if(id===generation)status.textContent=message(error)+' 기존 프로필은 유지해요.';}
    finally {if(id===generation){busy=false;controls();}}
  });
  el('profile-delete').addEventListener('click',async()=>{
    if(busy||!loggedIn)return;
    const id=generation;busy=true;controls();
    try {await api('DELETE');if(id!==generation)return;profile=null;onChange(null);render();channel?.postMessage('changed');status.textContent='프로필을 삭제했어요.';}
    catch(error){if(id===generation)status.textContent=message(error)+' 프로필 삭제는 완료하지 못했어요.';}
    finally {if(id===generation){busy=false;controls();}}
  });
  el('profile-reload').addEventListener('click',()=>{if(loggedIn)void load();else requestLogin();});
  if(channel)channel.onmessage=()=>{if(loggedIn&&!busy)void load();};
  render();
  return {current:()=>profile,session};
}
