import {test,expect,type Page} from '@playwright/test';
test.skip(process.env.WEB_SERVER_TARGET!=='realtime','Requires production API fixture; use npm run test:realtime.');
async function login(page:Page) {
  await page.locator('#login-button').click();await page.locator('#consent-checkbox').check();await page.locator('#consent-accept').click();
  await expect(page.locator('#life-guide-login')).toBeHidden();await expect(page.locator('#profile-status')).not.toContainText('불러오고 있어요');
  await expect(page.locator('#profile-save')).toBeEnabled();
}
async function fill(page:Page,name='수아',age='4') {
  await page.locator('#profile-name').fill(name);await page.locator('#profile-age').selectOption(age);
  await page.getByRole('button',{name:'동물',exact:true}).click();await page.getByRole('button',{name:'우주',exact:true}).click();
}
test('profile is first in shared settings and supports 64 keyboard-accessible multi-select choices',async({page},info)=>{
  await page.goto('./');await page.locator('#open-settings').click();
  await expect(page.getByRole('tab').first()).toHaveText('프로필 설정');await expect(page.locator('#profile-panel')).toBeVisible();await expect(page.locator('#audio-settings-panel')).toBeHidden();
  await expect(page.locator('.interest-button')).toHaveCount(64);await expect(page.locator('#profile-age option')).toHaveCount(5);
  await fill(page);await expect(page.getByRole('button',{name:'동물',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('#profile-interest-count')).toHaveText('2개 선택');
  await page.getByRole('button',{name:'동물',exact:true}).click();await expect(page.locator('#profile-interest-count')).toHaveText('1개 선택');
  await page.getByRole('button',{name:'동화',exact:true}).focus();await page.keyboard.press('Space');await expect(page.locator('#profile-interest-count')).toHaveText('2개 선택');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/${info.project.name}-child-profile.png`});
  await page.locator('#profile-tab').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#audio-settings-panel')).toBeVisible();
  await page.locator('#volume').fill('20');await page.locator('#reset-session').click();await expect(page.locator('#volume-value')).toHaveText('10%');
  await page.locator('#profile-tab').click();await expect(page.locator('#profile-name')).toHaveValue('수아');
});
test('SQL profile round trip survives relogin and deletion leaves the life schedule intact',async({page})=>{
  await page.goto('./');await login(page);await page.locator('#open-settings').click();await fill(page);await page.locator('#profile-save').click();
  await expect(page.locator('#profile-status')).toContainText('프로필을 저장했어요');
  expect((await(await page.request.get('/api/life-guide/profile')).json()).profile).toEqual({version:1,name:'수아',age:4,interests:['animals','space']});
  await page.request.put('/api/life-guide',{headers:{Origin:new URL(page.url()).origin},data:{version:1,timeZone:'Asia/Seoul',slots:{meal:[16],sleep:[],tidy:[]}}});
  await page.reload();await login(page);await page.locator('#open-settings').click();await expect(page.locator('#profile-name')).toHaveValue('수아');await expect(page.locator('#profile-age')).toHaveValue('4');
  await expect(page.getByRole('button',{name:'우주',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.locator('#profile-delete').click();await expect(page.locator('#profile-status')).toHaveText('프로필을 삭제했어요.');
  expect((await(await page.request.get('/api/life-guide/profile')).json()).profile).toBeNull();
  expect((await(await page.request.get('/api/life-guide')).json()).schedule.slots.meal).toEqual([16]);
  await expect(page.locator('#profile-name')).toHaveValue('');
});
test('draft survives login from settings and failed SQL saves do not claim success',async({page})=>{
  await page.goto('./');await page.locator('#open-settings').click();await fill(page);await page.locator('#profile-save').click();await expect(page.locator('#consent-dialog')).toBeVisible();
  await page.locator('#consent-checkbox').check();await page.locator('#consent-accept').click();await expect(page.locator('#profile-status')).toContainText('입력한 내용을 유지');
  await expect(page.locator('#profile-name')).toHaveValue('수아');
  await page.route('**/api/life-guide/profile',route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{code:'DATABASE_UNAVAILABLE'}}):route.continue());
  await page.locator('#profile-save').click();await expect(page.locator('#profile-status')).toContainText('기존 프로필은 유지');
  expect((await(await page.request.get('/api/life-guide/profile')).json()).profile).toBeNull();
});
test('stored profile reaches voice admission and live save/delete sends profile updates',async({page})=>{
  const commands:any[]=[],admissions:any[]=[];
  await page.routeWebSocket('**/api/realtime',socket=>socket.onMessage(raw=>{if(typeof raw!=='string')return;const value=JSON.parse(raw);commands.push(value);if(value.type==='start')socket.send(JSON.stringify({type:'ready'}));}));
  page.on('request',request=>{if(request.url().endsWith('/api/realtime/session')&&request.method()==='POST')admissions.push(request.postDataJSON());});
  await page.goto('./');await login(page);await page.locator('#open-settings').click();await fill(page);await page.locator('#profile-save').click();await expect(page.locator('#profile-status')).toContainText('프로필을 저장했어요');await page.locator('#settings-close').click();
  await page.locator('#realtime-consent').check();await page.locator('#realtime-connect').click();await expect(page.locator('#realtime-status')).toHaveText('듣고 있어요');expect(admissions[0].profile).toMatchObject({name:'수아',age:4,interests:['animals','space']});
  await page.locator('#open-settings').click();await page.locator('#profile-age').selectOption('6');await page.locator('#profile-save').click();await expect.poll(()=>commands.filter(c=>c.type==='profile.update').at(-1)?.profile?.age).toBe(6);
  await page.locator('#profile-delete').click();await expect.poll(()=>commands.filter(c=>c.type==='profile.update').at(-1)?.profile).toBeNull();
  await page.locator('#settings-close').click();await page.locator('#realtime-end').click();
});
