import { test, expect, type Page } from '@playwright/test';
import { PARENT_SETTINGS_POLICY } from '../shared/child-profile.mjs';

async function consentToLocalAudio(page: Page) {
  await page.locator('#login-button').click();
  await page.locator('#consent-checkbox').check();
  await page.locator('#consent-accept').click();
  await expect(page.locator('#consent-dialog')).not.toBeVisible();
}


test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as any;
    state.__tracks = []; state.__plays = []; state.__getUserMediaCalls = 0;
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      state.__getUserMediaCalls++;
      const stream = await get(constraints);
      state.__tracks.push(...stream.getTracks());
      return stream;
    };
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function() {
      const node = create.call(this), start = node.start.bind(node);
      node.start = (...args: Parameters<typeof start>) => {
        state.__plays.push({ frames: node.buffer?.length, rate: node.buffer?.sampleRate,
          peak: node.buffer ? Math.max(...node.buffer.getChannelData(0).slice(0, 2000).map(Math.abs)) : 0 });
        return start(...args);
      };
      return node;
    };
  });
});
test('dashboard is responsive and requests no microphone on load', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '반가워요, 모모에요' })).toBeVisible();
  await expect(page.locator('#play')).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__getUserMediaCalls)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-dashboard.png`, fullPage: true });
  expect(errors).toEqual([]);
});
test('demo needs no permission, no auto playback, can play stop and clear', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET' || !new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) requests.push(request.url()); });
  await page.goto('./'); await page.locator('#try-demo').click();
  await expect(page.locator('#recording-info')).toHaveText('5.0초 · 메모리에만');
  await expect(page.locator('#wave-label')).toContainText('합성 음원');
  expect(await page.evaluate(() => (window as any).__getUserMediaCalls)).toBe(0);
  expect(await page.evaluate(() => (window as any).__plays.length)).toBe(0);
  await page.locator('#play').click(); await expect(page.locator('#audio-state')).toHaveText('재생 중');
  await expect.poll(() => page.evaluate(() => (window as any).__plays.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).__plays[0])).toMatchObject({ frames: 120000, rate: 24000 });
  await page.locator('#stop').click(); await expect(page.locator('#recording-info')).toHaveText('비어 있음');
  await expect(page.locator('#play')).toBeDisabled();
  await page.locator('#record').click(); await page.locator('#clear').click();
  await expect(page.locator('#recording-info')).toHaveText('비어 있음');
  expect(await page.evaluate(async () => [localStorage.length, sessionStorage.length, (await indexedDB.databases()).length])).toEqual([0, 0, 0]);
  expect(requests).toEqual([]);
});
test('device inspection stops microphone without recording', async ({ page }) => {
  await page.goto('./'); await consentToLocalAudio(page); await page.locator('#check-microphone').click();
  await expect(page.locator('#input-state')).toContainText('사용 종료');
  expect(await page.evaluate(() => (window as any).__tracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
  expect(await page.locator('#input-device option').count()).toBeGreaterThan(1);
  await expect(page.locator('#play')).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__plays.length)).toBe(0);
});
test('native worklet records 5 seconds and resamples to 24kHz without autoplay', async ({ page }) => {
  const uploads: string[] = [];
  page.on('request', request => {
    const url=new URL(request.url());
    // Login sends consent metadata; audio or other uploads still fail this check.
    if (url.pathname === '/api/life-guide/login' && request.method() === 'POST' && JSON.stringify(request.postDataJSON()) === JSON.stringify({consent:true,policy:PARENT_SETTINGS_POLICY})) return;
    if (request.method() !== 'GET' || url.hostname !== '127.0.0.1') uploads.push(request.url());
  });
  await page.goto('./'); await consentToLocalAudio(page); await page.locator('#record').click();
  await expect(page.locator('#audio-state')).toHaveText('녹음 중');
  await expect(page.locator('#audio-state')).toHaveText('녹음 완료', { timeout: 12000 });
  await expect(page.locator('#recording-info')).toHaveText('5.0초 · 메모리에만');
  expect(await page.evaluate(() => (window as any).__tracks.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).__tracks.every((t: MediaStreamTrack) => t.readyState === 'ended'))).toBe(true);
  expect(await page.evaluate(() => (window as any).__plays.length)).toBe(0);
  await page.locator('#play').click();
  await expect.poll(() => page.evaluate(() => (window as any).__plays.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).__plays[0].frames)).toBe(120000);
  expect(uploads).toEqual([]);
  await page.locator('#stop').click();
});
test('recording can be cancelled and restarted with no active tracks', async ({ page }) => {
  await page.goto('./'); await consentToLocalAudio(page); await page.locator('#record').click();
  await expect(page.locator('#audio-state')).toHaveText('녹음 중'); await page.locator('#stop').click();
  await expect(page.locator('#audio-state')).toHaveText('준비됨');
  expect(await page.evaluate(() => (window as any).__tracks.every((t: MediaStreamTrack) => t.readyState === 'ended'))).toBe(true);
  await page.locator('#record').click(); await expect(page.locator('#audio-state')).toHaveText('녹음 중');
  await page.keyboard.press('Escape'); await expect(page.locator('#play')).toBeDisabled();
});
test('permission denial is explained and demo still works', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Private details', 'NotAllowedError'); }; });
  await page.goto('./'); await consentToLocalAudio(page); await page.locator('#record').click();
  await expect(page.locator('#toast')).toContainText('마이크 접근이 허용되지');
  await expect(page.locator('#toast')).not.toContainText('Private details');
  await page.locator('#try-demo').click(); await expect(page.locator('#play')).toBeEnabled();
});
test('settings reset remains accessible after removing privacy and checklist pages', async ({ page }) => {
  await page.goto('./'); await page.locator('#try-demo').click();
  await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#open-settings').click();
  await page.getByRole('tab',{name:'오디오 설정',exact:true}).click();
  await page.locator('#volume').fill('20'); await expect(page.locator('#volume-value')).toHaveText('20%');
  await page.locator('#reset-session').click();
  await expect(page.locator('#volume-value')).toHaveText('10%');
  await page.getByRole('button', { name: '설정 완료' }).click();
  await expect(page.locator('#recording-info')).toHaveText('비어 있음');
  await expect(page.locator('#play')).toBeDisabled();
  await page.locator('[data-route="audio"]').click();
  await expect(page.locator('#page-name')).toHaveText('오디오 테스트');
  await page.locator('[data-route="overview"]').click();
  await expect(page.locator('#page-name')).toHaveText('대시보드');
});
test('removed menu items and inbound links are absent', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('nav [data-route]')).toHaveCount(3);
  await expect(page.locator('[data-route="privacy"], [data-route="checklist"], a[href="#privacy"], a[href="#checklist"]')).toHaveCount(0);
  await expect(page.locator('#privacy-view, #checklist-view, .bottom-grid')).toHaveCount(0);
});
test('old privacy and checklist URLs safely return to dashboard', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const hash of ['privacy', 'checklist', 'unknown']) {
    await page.goto(`./#${hash}`);
    await expect(page).toHaveURL(/#overview$/);
    await expect(page.getByRole('heading', { name: '반가워요, 모모에요' })).toBeVisible();
    await page.locator('#try-demo').click(); await expect(page.locator('#play')).toBeEnabled();
  }
  expect(errors).toEqual([]);
});
test('speaker test has bounded signal and finishes', async ({ page }) => {
  await page.goto('./'); await page.locator('#test-speaker').click();
  await expect.poll(() => page.evaluate(() => (window as any).__plays.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).__plays[0].peak)).toBeLessThanOrEqual(.1);
  await expect(page.locator('#audio-state')).toHaveText('준비됨');
});
test('page exit discards recording', async ({ page }) => {
  await page.goto('./'); await page.locator('#try-demo').click();
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(page.locator('#recording-info')).toHaveText('비어 있음');
});
test('late permission result after cancellation is closed and ignored', async ({ page }) => {
  await page.addInitScript(() => {
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      await new Promise(resolve => setTimeout(resolve, 450)); return get(constraints);
    };
  });
  await page.goto('./'); await consentToLocalAudio(page); await page.locator('#record').click();
  await expect(page.locator('#audio-state')).toHaveText('권한 확인 중');
  await page.locator('#stop').click();
  await expect.poll(() => page.evaluate(() => (window as any).__tracks.length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window as any).__tracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
  await expect(page.locator('#audio-state')).toHaveText('준비됨');
  await expect(page.locator('#recording-info')).toHaveText('비어 있음');
});
test('cancel during asynchronous playback setup prevents a late sound', async ({ page }) => {
  await page.addInitScript(() => {
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = async function() { await new Promise(resolve => setTimeout(resolve, 400)); return resume.call(this); };
  });
  await page.goto('./'); await page.locator('#try-demo').click();
  await page.locator('#play').click(); await page.locator('#stop').click();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as any).__plays.length)).toBe(0);
  await expect(page.locator('#audio-state')).toHaveText('준비됨');
});

test('login opens consent popup without starting capture and resets on cancel', async ({ page }) => {
  await page.goto('./'); await page.locator('#login-button').click();
  await expect(page.getByRole('dialog', { name: '시작 전, 확인해 주세요' })).toBeVisible();
  await expect(page.locator('#consent-checkbox')).not.toBeChecked();
  await expect(page.locator('#consent-accept')).toBeDisabled();
  await page.locator('#consent-checkbox').check();
  await expect(page.locator('#consent-accept')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#consent-dialog')).not.toBeVisible();
  await page.locator('#login-button').click();
  await expect(page.locator('#consent-checkbox')).not.toBeChecked();
  await expect(page.locator('#consent-accept')).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__getUserMediaCalls)).toBe(0);
});
test('microphone actions require consent, denial keeps the demo available', async ({ page }) => {
  await page.goto('./'); await page.locator('#record').click();
  await expect(page.locator('#consent-dialog')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__getUserMediaCalls)).toBe(0);
  await page.locator('#consent-decline').click();
  await expect(page.locator('#login-button')).toHaveText('체험 로그인');
  await page.locator('#try-demo').click(); await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#mode-microphone').click(); await page.locator('#check-microphone').click();
  await expect(page.locator('#consent-dialog')).toBeVisible();
  await page.locator('#consent-close').click();
  await expect(page.locator('#consent-dialog')).not.toBeVisible();
  expect(await page.evaluate(() => (window as any).__getUserMediaCalls)).toBe(0);
});
test('acceptance is explicit, does not auto-record and is not persisted', async ({ page }) => {
  await page.goto('./'); await consentToLocalAudio(page);
  await expect(page.locator('#login-button')).toHaveText('이용 종료');
  expect(await page.evaluate(() => (window as any).__getUserMediaCalls)).toBe(0);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.reload();
  await expect(page.locator('#login-button')).toHaveText('체험 로그인');
  await page.locator('#check-microphone').click();
  await expect(page.locator('#consent-dialog')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__getUserMediaCalls)).toBe(0);
});
test('ending session revokes consent, clears voice and stops active capture', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('./'); await consentToLocalAudio(page);
  await page.locator('#record').click(); await expect(page.locator('#audio-state')).toHaveText('녹음 중');
  await page.locator('#login-button').click();
  await expect(page.locator('#login-button')).toHaveText('체험 로그인');
  await expect(page.locator('#recording-info')).toHaveText('비어 있음');
  await expect.poll(() => page.evaluate(() => (window as any).__tracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
  await page.locator('#record').click(); await expect(page.locator('#consent-dialog')).toBeVisible();
  expect(errors).toEqual([]);
});
test('ending session during permission request closes the late stream', async ({ page }) => {
  await page.addInitScript(() => {
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      await new Promise(resolve => setTimeout(resolve, 450)); return get(constraints);
    };
  });
  await page.goto('./'); await consentToLocalAudio(page);
  await page.locator('#record').click(); await expect(page.locator('#audio-state')).toHaveText('권한 확인 중');
  await page.locator('#login-button').click();
  await expect.poll(() => page.evaluate(() => (window as any).__tracks.length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window as any).__tracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
  await expect(page.locator('#recording-info')).toHaveText('비어 있음');
  await expect(page.locator('#input-state')).toHaveText('확인 전');
  await expect(page.locator('#login-button')).toHaveText('체험 로그인');
});
test('consent popup supports mobile layout, keyboard and re-entry', async ({ page }, testInfo) => {
  await page.goto('./'); await page.locator('#login-button').click();
  await page.screenshot({ path: `test-results/${testInfo.project.name}-consent.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#consent-checkbox').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#consent-accept')).toBeEnabled();
  await page.locator('#consent-accept').click(); await page.locator('#login-button').click();
  await page.locator('#login-button').click();
  await expect(page.locator('#consent-checkbox')).not.toBeChecked();
  await expect(page.locator('#consent-accept')).toBeDisabled();
});
