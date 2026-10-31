import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
test('worklet mixes mono, limits frames, transfers ownership and outputs no loopback', () => {
  let Processor: any;
  const messages: any[] = [];
  runInNewContext(readFileSync('public/capture-worklet.js', 'utf8'), {
    Float32Array,
    AudioWorkletProcessor: class { port = { postMessage: (message: any, transfer: ArrayBuffer[]) => {
      expect(transfer[0]).toBe(message.samples.buffer); messages.push(message);
    } }; },
    registerProcessor: (_name: string, processor: any) => { Processor = processor; },
  });
  const processor = new Processor({ processorOptions: { frames: 3 } });
  const input = [[new Float32Array([1, .5, -1, 0]), new Float32Array([-1, .5, -1, 0])]];
  const output = [[new Float32Array(4)]];
  expect(processor.process(input, output)).toBe(false);
  expect(Array.from(messages[0].samples)).toEqual([0, .5, -1]);
  expect(messages[0].done).toBe(true);
  expect(output[0][0].every(value => value === 0)).toBe(true);
  expect(processor.remaining).toBe(0);
  expect(processor.process(input, output)).toBe(false);
  expect(messages).toHaveLength(1);
});
