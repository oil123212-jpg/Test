import { test, expect } from '@playwright/test';
const key = 'momo.life-guide.v1';
test('parents select multiple half hours, save, reload and delete on desktop and mobile', async ({page}, testInfo) => {
  const errors: string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./#life-guide');
  await expect(page.getByRole('heading',{name:'라이프 가이드',exact:true})).toBeVisible();
  await expect(page.locator('#overview-view')).toBeHidden();
  await expect(page.locator('.life-guide-slot input')).toHaveCount(144);
  await page.locator('#life-meal-16').check();
  await page.locator('#life-meal-17').check();
  await page.locator('#life-sleep-42').check();
  await page.locator('#life-tidy-32').check();
  await page.locator('#life-guide-enabled').check();
  await page.locator('#life-guide-save').click();
  await expect(page.locator('#life-guide-save-status')).toContainText('저장했어요');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key)).toMatchObject({enabled:true,timeZone:'Asia/Seoul',slots:{meal:[16,17],sleep:[42],tidy:[32]}});
  await page.reload();
  await expect(page.locator('#life-meal-16')).toBeChecked();
  await expect(page.locator('#life-sleep-42')).toBeChecked();
  await expect(page.locator('#life-guide-enabled')).toBeChecked();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/${testInfo.project.name}-life-guide.png`,fullPage:true});
  await page.getByRole('link',{name:'모모와 대화하기'}).click();
  await expect(page.locator('#life-guide-conversation-status')).toContainText('켜짐');
  await page.locator('[data-route="life-guide"]').click();
  await page.locator('#life-guide-delete').click();
  await expect(page.locator('#life-guide-enabled')).not.toBeChecked();
  expect(await page.locator('.life-guide-slot input:checked').count()).toBe(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  await page.reload(); await expect(page.locator('#life-meal-16')).not.toBeChecked();
  expect(errors).toEqual([]);
});
test('no default persistence, empty enabled guide is rejected, storage failure is explained',async({page})=>{
  await page.goto('./#life-guide');
  expect(await page.evaluate(()=>localStorage.length)).toBe(0);
  await page.locator('#life-guide-enabled').check();await page.locator('#life-guide-save').click();
  await expect(page.locator('#life-guide-save-status')).toContainText('하나 이상');
  expect(await page.evaluate(()=>localStorage.length)).toBe(0);
  await page.locator('#life-meal-16').check();
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('denied','QuotaExceededError');};});
  await page.locator('#life-guide-save').click();
  await expect(page.locator('#life-guide-save-status')).toContainText('저장하지 못했어요');
  await page.locator('[data-route="overview"]').click();
  await expect(page.locator('#life-guide-conversation-status')).toContainText('꺼짐');
});
test('corrupt saved data fails closed and other tabs can withdraw schedule use',async({page,context})=>{
  await page.addInitScript(key=>{
    if(!sessionStorage.getItem('seeded')) {localStorage.setItem(key,'{"enabled":true}');sessionStorage.setItem('seeded','yes');}
  },key);
  await page.goto('./#life-guide');
  await expect(page.locator('#life-guide-save-status')).toContainText('읽지 못해');
  await expect(page.locator('#life-guide-enabled')).not.toBeChecked();
  await page.locator('#life-meal-16').check();await page.locator('#life-guide-enabled').check();await page.locator('#life-guide-save').click();
  const second=await context.newPage();await second.goto('./#life-guide');await second.locator('#life-guide-delete').click();
  await expect(page.locator('#life-guide-enabled')).not.toBeChecked();
  await expect(page.locator('#life-guide-save-status')).toContainText('다른 탭');
});
