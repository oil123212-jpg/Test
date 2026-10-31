import { test, expect } from '@playwright/test';
import { floatToPcm16, measure, demoRecording, waveform, wipe } from '../src/audio-utils';
test('PCM16 signed boundaries and invalid data', () => {
  expect(Array.from(floatToPcm16(new Float32Array([-2, -1, -.5, 0, .5, 1, 2])))).toEqual([-32768, -32768, -16384, 0, 16384, 32767, 32767]);
  expect(() => floatToPcm16(new Float32Array([NaN]))).toThrow('InvalidAudio');
});
test('RMS peak clipping and empty input', () => {
  expect(measure(new Float32Array([1, -1]))).toEqual({ rms: 1, peak: 1, clipped: true });
  expect(measure(new Float32Array([]))).toEqual({ rms: 0, peak: 0, clipped: false });
});
test('demo is five seconds, mono PCM16 and can be wiped', () => {
  const data = demoRecording();
  expect(data.source).toBe('demo'); expect(data.sampleRate).toBe(24000); expect(data.pcm.length).toBe(120000);
  expect(data.rms).toBeGreaterThan(.01); expect(data.clipped).toBe(false);
  expect(waveform(data.pcm)).toHaveLength(84);
  wipe(data); expect(data.pcm.every(value => value === 0)).toBe(true);
});
