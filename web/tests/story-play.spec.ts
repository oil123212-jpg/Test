import { test, expect } from '@playwright/test';

test('the rabbit turn stays silent and waits until the child taps, without microphone use', async ({page}) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    Object.assign(window, { storySpoken: spoken });
    Object.defineProperty(window, 'speechSynthesis', {value: {
      getVoices: () => [{localService: true, lang: 'ko-KR'}],
      speak: (speech: SpeechSynthesisUtterance) => {
        spoken.push(speech.text);
        setTimeout(() => speech.onend?.(new Event('end') as SpeechSynthesisEvent), 0);
      }, cancel() {},
    }});
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => {
      spoken.push('MIC'); throw new Error('Role play must not use the microphone');
    };
  });
  await page.goto('./#story-play');
  await page.getByLabel('내가 맡을 역할').selectOption('토끼');
  await page.getByRole('button', {name:'역할극 시작'}).click();
  await expect(page.locator('#story-speaker')).toHaveText('내 차례 · 토끼');
  const firstLine = await page.locator('#story-line').textContent();
  await page.getByRole('button', {name:'직접 넘기기'}).click();
  await expect(page.locator('#story-line')).toContainText('나무 그늘');
  const spoken = await page.evaluate(() => (window as Window & {storySpoken?: string[]}).storySpoken);
  expect(spoken).toHaveLength(3);
  expect(spoken).not.toContain(firstLine);
  expect(spoken).not.toContain('MIC');
  await page.getByRole('button', {name:'직접 넘기기'}).click();
  await expect(page.locator('#story-speaker')).toHaveText('이야기 끝!');
});

test('local recognition advances after enough final words and aborts before the next turn', async ({page}) => {
  await page.addInitScript(() => {
    class LocalMock {
      static async available(opts: {processLocally: boolean}) { return opts.processLocally ? 'available' : 'unavailable'; }
      get processLocally() { return this.local; }
      set processLocally(value) { this.local = value; }
      local = false;
      onresult?: (ev: unknown) => void;
      start() { if (!this.local) throw new Error('Not local'); active = this; }
      abort() { if (active === this) active = undefined; }
    }
    let active: LocalMock | undefined;
    Object.defineProperty(window, 'SpeechRecognition', {value: LocalMock});
    Object.defineProperty(window, 'speechSynthesis', {value: {getVoices: () => [], cancel() {}}});
    Object.assign(window, {emitStory: (transcript: string, isFinal: boolean, index: number) => {
      if (!active) throw new Error('Not listening');
      const results = Array(index + 1).fill({isFinal, 0: {transcript}});
      active.onresult?.({resultIndex:index, results});
      return Boolean(active);
    }});
  });
  await page.goto('./#story-play');
  await page.getByRole('button', {name:'자동 넘김 켜기'}).click();
  await expect(page.getByRole('button', {name:'자동 넘김 끄기'})).toBeVisible();
  await page.getByLabel('내가 맡을 역할').selectOption('토끼');
  await page.getByRole('button', {name:'역할극 시작'}).click();
  await page.getByRole('button', {name:'다음 대사', exact:true}).click();
  await expect(page.locator('#story-speaker')).toHaveText('내 차례 · 토끼');
  const emit = (transcript: string, isFinal: boolean, index: number) => page.evaluate(
    ([t,f,i]) => (window as unknown as {emitStory(t:string,f:boolean,i:number):boolean}).emitStory(t,f,i),
    [transcript,isFinal,index] as const);
  expect(await emit('나는 저 고개까지 깡충깡충 달려갈 수 있어', false, 0)).toBe(true);
  expect(await emit('나는 저 엉뚱한 고개까지', true, 0)).toBe(true);
  expect(await emit('달려갈 있어', true, 1)).toBe(false); // 5/7 ordered words
  await expect(page.locator('#story-speaker')).toHaveText('모모 차례 · 거북이');
});
