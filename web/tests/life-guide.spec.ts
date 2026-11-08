import { test, expect, type Page } from '@playwright/test';
test.skip(process.env.WEB_SERVER_TARGET !== 'realtime','Requires the production API test fixture; use npm run test:realtime.');
async function login(page: Page) {
  await page.locator('#login-button').click(); await page.locator('#consent-checkbox').check(); await page.locator('#consent-accept').click();
  await expect(page.locator('#life-guide-save')).toBeEnabled();
}
test('DB times survive logout, reload and relogin; consent stays off and deletion persists',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./#life-guide');await expect(page.locator('#life-guide-save')).toBeDisabled();await login(page);
  await expect(page.locator('.life-guide-slot input')).toHaveCount(144);
  for(const id of ['life-meal-16','life-meal-17','life-sleep-42','life-tidy-32'])await page.locator('#'+id).check();
  await page.locator('#life-guide-enabled').check();await page.locator('#life-guide-save').click();
  await expect(page.locator('#life-guide-save-status')).toContainText('DB에 저장했어요');
  const saved=await(await page.request.get('/api/life-guide')).json();
  expect(saved.schedule).toEqual({version:1,timeZone:'Asia/Seoul',slots:{meal:[16,17],sleep:[42],tidy:[32]}});
  expect(await page.evaluate(()=>localStorage.length)).toBe(0);
  await page.locator('#login-button').click();await expect(page.locator('#life-guide-save')).toBeDisabled();
  await expect.poll(async()=>(await page.request.get('/api/life-guide')).status()).toBe(401);
  await page.reload();await login(page);
  await expect(page.locator('#life-meal-16')).toBeChecked();await expect(page.locator('#life-sleep-42')).toBeChecked();
  await expect(page.locator('#life-guide-enabled')).not.toBeChecked();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/${testInfo.project.name}-life-guide-db.png`,fullPage:true});
  await page.locator('#life-guide-delete').click();await expect(page.locator('#life-guide-save-status')).toContainText('DB의 생활 시간을 삭제');
  expect((await(await page.request.get('/api/life-guide')).json()).schedule).toBeNull();
  await page.reload();await login(page);await expect(page.locator('#life-meal-16')).not.toBeChecked();expect(errors).toEqual([]);
});
test('save failure retains applied guide; delete failure disables prompts without claiming DB deletion',async({page})=>{
  await page.goto('./#life-guide');await login(page);
  await page.locator('#life-guide-enabled').check();await page.locator('#life-guide-save').click();await expect(page.locator('#life-guide-save-status')).toContainText('하나 이상');
  await page.locator('#life-meal-16').check();await page.locator('#life-guide-save').click();await expect(page.locator('#life-guide-save-status')).toContainText('DB에 저장했어요');
  await page.route('**/api/life-guide',route=>route.request().method()==='GET'?route.continue():route.fulfill({status:503,json:{code:'DATABASE_UNAVAILABLE'}}));
  await page.locator('#life-guide-enabled').uncheck();await page.locator('#life-guide-save').click();await expect(page.locator('#life-guide-save-status')).toContainText('변경 전 설정');
  await page.locator('[data-route="overview"]').click();await expect(page.locator('#life-guide-conversation-status')).toContainText('켜짐');
  await page.locator('[data-route="life-guide"]').click();await page.locator('#life-guide-delete').click();await expect(page.locator('#life-guide-save-status')).toContainText('DB 삭제는 완료하지 못했어요');
  await page.locator('[data-route="overview"]').click();await expect(page.locator('#life-guide-conversation-status')).toContainText('꺼짐');
});
test('DB unavailable does not claim successful login or block local audio consent',async({page})=>{
  await page.route('**/api/life-guide/login',route=>route.fulfill({status:503,json:{code:'DATABASE_NOT_CONFIGURED'}}));
  await page.goto('./#life-guide');await page.locator('#life-guide-login').click();await page.locator('#consent-checkbox').check();await page.locator('#consent-accept').click();
  await expect(page.locator('#life-guide-save-status')).toContainText('DATABASE_URL');await expect(page.locator('#life-guide-save')).toBeDisabled();await expect(page.locator('#login-button')).toHaveText('이용 종료');
  await page.locator('[data-route="overview"]').click();await page.locator('#try-demo').click();await expect(page.locator('#play')).toBeEnabled();
});
test('different browser contexts keep schedules separate',async({page,browser})=>{
  await page.goto('./#life-guide');await login(page);await page.locator('#life-meal-16').check();await page.locator('#life-guide-save').click();await expect(page.locator('#life-guide-save-status')).toContainText('DB에 저장했어요');
  const other=await browser.newContext();const second=await other.newPage();
  try {await second.goto(page.url());await login(second);await expect(second.locator('#life-meal-16')).not.toBeChecked();}finally {await other.close();}
});
test('old local schedule becomes an unsaved draft without silent DB writes',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('momo.life-guide.v1',JSON.stringify({version:1,enabled:true,timeZone:'Asia/Seoul',slots:{meal:[16],sleep:[],tidy:[]}})));
  await page.goto('./#life-guide');await login(page);
  await expect(page.locator('#life-meal-16')).toBeChecked();await expect(page.locator('#life-guide-enabled')).not.toBeChecked();
  await expect(page.locator('#life-guide-save-status')).toContainText('아직 DB에 저장되지 않았어요');
  expect((await(await page.request.get('/api/life-guide')).json()).schedule).toBeNull();
  await page.locator('#life-guide-save').click();await expect(page.locator('#life-guide-save-status')).toContainText('DB에 저장했어요');
  expect(await page.evaluate(()=>localStorage.getItem('momo.life-guide.v1'))).toBeNull();
});
