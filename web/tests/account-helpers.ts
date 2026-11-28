import {randomUUID} from 'node:crypto';
import {expect,type Page} from '@playwright/test';
const users=new WeakMap<Page,string>();
export async function credentials(page:Page) {
  const before=users.get(page);
  const name=before??'t'+randomUUID();
  users.set(page,name);
  await page.locator('#account-name').fill(name);
  await page.locator('#account-password').fill('a test password with spaces');
  await page.locator(before?'#login-continue':'#account-register').click();
}
export async function enter(page:Page) {
  if((await (await page.request.get('/api/auth/session')).json()).consent){
    await expect(page.locator('#login-button')).toHaveText('로그아웃');return;
  }
  await page.locator('#login-button').click();await credentials(page);
  await expect(page.locator('#login-button')).toHaveText('로그아웃');
  const state=await (await page.request.get('/api/auth/session')).json();
  if(!state.consent){
    await page.locator('#consent-checkbox').check();await page.locator('#consent-accept').click();
    await page.locator('#profile-skip').click();
  }
}