import {test,expect,type Page} from '@playwright/test';
async function consent(page:Page){await page.locator('#login-button').click();await page.locator('#consent-checkbox').check();await page.locator('#consent-accept').click();}
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{(window as any).__micCalls=0;const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{(window as any).__micCalls++;return get(c);};});
});
test('home shows generated Momo and only the live conversation without starting the microphone',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./');
  await expect(page.getByRole('heading',{name:'반가워요, 모모에요'})).toBeVisible();
  const image=page.locator('#conversation-orb img');await expect(image).toBeVisible();
  expect(await image.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
  await expect(page.locator('#audio-lab,#try-demo,#record,[data-route="audio"],a[href="#audio"],.hero')).toHaveCount(0);
  await expect(page.locator('nav [data-route]')).toHaveCount(2);
  expect(await page.evaluate(()=>(window as any).__micCalls)).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/${info.project.name}-dashboard.png`,fullPage:true});expect(errors).toEqual([]);
});
test('removed audio and legacy routes return home without errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const hash of ['audio','privacy','checklist','unknown']){await page.goto(`./#${hash}`);await expect(page).toHaveURL(/#overview$/);await expect(page.locator('#realtime-conversation')).toBeVisible();}
  expect(errors).toEqual([]);
});
test('login consent remains explicit and cancellation resets it',async({page})=>{
  await page.goto('./');await page.locator('#login-button').click();await expect(page.locator('#consent-accept')).toBeDisabled();
  await page.locator('#consent-checkbox').check();await page.keyboard.press('Escape');await expect(page.locator('#consent-dialog')).toBeHidden();
  await page.locator('#login-button').click();await expect(page.locator('#consent-checkbox')).not.toBeChecked();await expect(page.locator('#consent-accept')).toBeDisabled();
  await page.locator('#consent-decline').click();await expect(page.locator('#login-button')).toHaveText('체험 로그인');
  expect(await page.evaluate(()=>(window as any).__micCalls)).toBe(0);
});
test('acceptance does not start capture and reload requires fresh consent',async({page})=>{
  await page.goto('./');await consent(page);await expect(page.locator('#login-button')).toHaveText('이용 종료');
  expect(await page.evaluate(()=>(window as any).__micCalls)).toBe(0);await page.reload();await expect(page.locator('#login-button')).toHaveText('체험 로그인');
});
test('audio settings and help contain current voice controls',async({page})=>{
  await page.goto('./');await page.locator('#open-settings').click();await page.locator('#audio-settings-tab').click();
  await expect(page.locator('#input-device')).toBeVisible();await page.locator('#volume').fill('20');await expect(page.locator('#volume-value')).toHaveText('20%');
  await page.locator('#reset-session').click();await expect(page.locator('#volume-value')).toHaveText('10%');await page.locator('#settings-done').click();
  if(await page.locator('#open-help').isVisible()) {
    await page.locator('#open-help').click();await expect(page.locator('#help-dialog')).toBeVisible();await expect(page.locator('#help-dialog')).not.toContainText('데모');
  }
});
test('consent popup fits mobile and supports keyboard re-entry',async({page})=>{
  await page.goto('./');await page.locator('#login-button').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#consent-checkbox').focus();await page.keyboard.press('Space');await expect(page.locator('#consent-accept')).toBeEnabled();
  await page.locator('#consent-accept').click();await page.locator('#login-button').click();await page.locator('#login-button').click();await expect(page.locator('#consent-checkbox')).not.toBeChecked();
});
