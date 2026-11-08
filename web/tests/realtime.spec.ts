import { test, expect, type Page } from '@playwright/test';
async function localConsent(page:Page) {await page.locator('#login-button').click();await page.locator('#consent-checkbox').check();await page.locator('#consent-accept').click();}
async function connect(page:Page) {await localConsent(page);await page.locator('#realtime-consent').check();await expect(page.locator('#realtime-connect')).toBeEnabled();await page.locator('#realtime-connect').click();}
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const state=window as any;state.__tracks=[];state.__plays=[];state.__micCalls=0;
    const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{state.__micCalls++;const stream=await get(constraints);state.__tracks.push(...stream.getTracks());return stream;};
    const create=AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource=function(){const node=create.call(this),start=node.start.bind(node);node.start=(...args:Parameters<typeof start>)=>{
      state.__plays.push({frames:node.buffer?.length,rate:node.buffer?.sampleRate});return start(...args);
    };return node;};
  });
});
test('removed connection-summary card is absent and real conversation is present',async({page})=>{
  await page.goto('./');await expect(page.locator('.session-card')).toHaveCount(0);
  await expect(page.getByText('지금의 연결 상태',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'모모와 지금 이야기해요'})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__micCalls)).toBe(0);
});
test('local and separate external-transmission consent are both required',async({page})=>{
  await page.goto('./');await expect(page.locator('#realtime-connect')).toBeEnabled();await page.locator('#realtime-connect').click();
  await expect(page.locator('#consent-dialog')).toBeVisible();await page.locator('#consent-checkbox').check();await page.locator('#consent-accept').click();
  await page.locator('#realtime-connect').click();await expect(page.locator('#toast')).toContainText('실시간 음성 전송');
  expect(await page.evaluate(()=>(window as any).__micCalls)).toBe(0);
});
test('microphone streams through the real relay and response chunks are played',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');await connect(page);
  await expect(page.locator('#realtime-status')).toHaveText('듣고 있어요',{timeout:10000});
  await expect.poll(()=>page.evaluate(()=>(window as any).__plays.length),{timeout:10000}).toBeGreaterThan(0);
  const play=await page.evaluate(()=>(window as any).__plays[0]);expect(play).toMatchObject({rate:24000,frames:4800});
  await expect(page.locator('#record')).toBeDisabled();
  await page.locator('#realtime-mute').click();await expect(page.locator('#realtime-mute')).toHaveText('마이크 켜기');
  expect(await page.evaluate(()=>(window as any).__tracks.every((t:MediaStreamTrack)=>!t.enabled))).toBe(true);
  await page.locator('#realtime-interrupt').click();
  await page.locator('#realtime-mute').click();
  await page.locator('#realtime-end').click();
  await expect(page.locator('#realtime-status')).toHaveText('대화 준비');
  await expect.poll(()=>page.evaluate(()=>(window as any).__tracks.every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
  await expect(page.locator('#record')).toBeEnabled();expect(errors).toEqual([]);
});
test('withdrawing external consent or ending trial login closes microphone and relay',async({page})=>{
  await page.goto('./');await connect(page);await expect(page.locator('#realtime-status')).toHaveText('듣고 있어요');
  await page.locator('#realtime-consent').uncheck();await expect(page.locator('#realtime-end')).toBeDisabled();
  expect(await page.evaluate(()=>(window as any).__tracks.every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
  await page.locator('#realtime-consent').check();await page.locator('#realtime-connect').click();
  await expect(page.locator('#realtime-status')).toHaveText('듣고 있어요');
  await page.locator('#login-button').click();await expect(page.locator('#realtime-consent')).not.toBeChecked();
  await expect(page.locator('#login-button')).toHaveText('체험 로그인');
  expect(await page.evaluate(()=>(window as any).__tracks.every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
});
test('cancel while permission is pending cannot activate a late microphone',async({page})=>{
  await page.addInitScript(()=>{const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async constraints=>{await new Promise(r=>setTimeout(r,450));return get(constraints);};});
  await page.goto('./');await connect(page);await expect(page.locator('#realtime-status')).toHaveText('연결 중');
  await page.locator('#realtime-end').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__tracks.length)).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>(window as any).__tracks.every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
  await expect(page.locator('#realtime-status')).toHaveText('대화 준비');
});
test('missing key is explained without enabling microphone or leaking credentials',async({page})=>{
  await page.route('**/api/realtime/config',route=>route.fulfill({json:{available:false,requiresAccessCode:false,model:'mock',maxSeconds:120,policy:'realtime-adult-test-v1'}}));
  await page.goto('./');await expect(page.locator('#realtime-connect')).toBeDisabled();
  await expect(page.locator('#realtime-message')).toContainText('OPENAI_API_KEY');
  expect(await page.evaluate(()=>(window as any).__micCalls)).toBe(0);
  const config=await(await page.request.get('/api/realtime/config')).text();expect(config).not.toContain('mock-provider-key-never-published');
});
test('provider quota errors are visible and release microphone resources',async({page})=>{
  await page.routeWebSocket('**/api/realtime',socket=>{socket.onMessage(()=>socket.send(JSON.stringify({type:'error',code:'API_QUOTA'})));});
  await page.goto('./');await connect(page);await expect(page.locator('#realtime-message')).toContainText('잔액');
  await expect.poll(()=>page.evaluate(()=>(window as any).__tracks.every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
  await expect(page.locator('#realtime-end')).toBeDisabled();
});
test('saved guide is relayed with consent and live deletion disables future life cues',async({page})=>{
  const commands:any[]=[];
  await page.routeWebSocket('**/api/realtime',socket=>{
    socket.onMessage(raw=>{
      if(typeof raw!=='string')return;
      const message=JSON.parse(raw);commands.push(message);
      if(message.type==='start')socket.send(JSON.stringify({type:'ready'}));
    });
  });
  const admissions:any[]=[];
  page.on('request',request=>{if(request.url().endsWith('/api/realtime/session')&&request.method()==='POST')admissions.push(request.postDataJSON());});
  await page.goto('./#life-guide');
  await localConsent(page); await expect(page.locator('#life-guide-login')).toBeHidden(); await expect(page.locator('#life-guide-save')).toBeEnabled();
  await page.locator('#life-meal-time').selectOption('16');await page.locator('#life-guide-enabled').check();await page.locator('#life-guide-save').click();
  await expect(page.locator('#life-guide-save-status')).toContainText('DB에 저장했어요');
  await page.locator('[data-route="overview"]').click();await page.locator('#realtime-consent').check();await page.locator('#realtime-connect').click();
  await expect(page.locator('#realtime-status')).toHaveText('듣고 있어요');
  expect(admissions[0].lifeGuide).toMatchObject({enabled:true,slots:{meal:[16]}});
  await page.locator('[data-route="life-guide"]').click();await page.locator('#life-guide-delete').click();
  await expect.poll(()=>commands.filter(c=>c.type==='life_guide.update').at(-1)?.lifeGuide.enabled).toBe(false);
  expect(commands.filter(c=>c.type==='life_guide.update').at(-1).lifeGuide.slots).toEqual({meal:[],sleep:[],tidy:[]});
  await page.locator('[data-route="overview"]').click();await page.locator('#realtime-end').click();
});
test('disabled schedule stays in DB but its times are not sent to Realtime',async({page})=>{
  await page.routeWebSocket('**/api/realtime',socket=>socket.onMessage(raw=>{if(typeof raw==='string'&&JSON.parse(raw).type==='start')socket.send(JSON.stringify({type:'ready'}));}));
  const admissions:any[]=[];
  page.on('request',request=>{if(request.url().endsWith('/api/realtime/session')&&request.method()==='POST')admissions.push(request.postDataJSON());});
  await page.goto('./#life-guide');await localConsent(page);await expect(page.locator('#life-guide-login')).toBeHidden();await expect(page.locator('#life-guide-save')).toBeEnabled();await page.locator('#life-meal-time').selectOption('16');await page.locator('#life-guide-save').click();
  await expect(page.locator('#life-guide-save-status')).toContainText('DB에 저장했어요');
  await page.locator('[data-route="overview"]').click();await page.locator('#realtime-consent').check();await page.locator('#realtime-connect').click();
  await expect(page.locator('#realtime-status')).toHaveText('듣고 있어요');
  expect(admissions[0].lifeGuide).toMatchObject({enabled:false,slots:{meal:[],sleep:[],tidy:[]}});
  expect((await(await page.request.get('/api/life-guide')).json()).schedule.slots.meal).toEqual([16]);
  await page.locator('#realtime-end').click();
});
