import { test, expect } from '@playwright/test';
import { RealtimeConversation } from '../src/realtime-client';

test('a burst of over eight seconds plays in order and can be interrupted', () => {
  const starts: number[] = [];
  let stopped = 0;
  const errors: string[] = [];
  const session = new RealtimeConversation({state() {}, level() {}, error: code => errors.push(code)});
  const context = {
    currentTime: 1,
    createBuffer: () => ({duration: 1, getChannelData: () => new Float32Array(24000)}),
    createBufferSource: () => ({
      connect() {}, disconnect() {}, stop() { stopped++; }, start(time: number) { starts.push(time); },
    }),
  };
  Object.assign(session, {context, gain: {}});
  for (let i = 0; i < 12; i++) session['playChunk'](new ArrayBuffer(48000));
  expect(errors).toEqual([]);
  expect(starts).toHaveLength(12);
  starts.forEach((time, index) => expect(time).toBeCloseTo(1.025 + index));
  session.interrupt();
  expect(stopped).toBe(12);
});
