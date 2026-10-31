export const TARGET_RATE = 24000;
export interface RecordingData {
  pcm: Int16Array;
  sampleRate: number;
  rms: number;
  peak: number;
  clipped: boolean;
  source: 'demo' | 'microphone';
}
export function floatToPcm16(input: Float32Array): Int16Array {
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    if (!Number.isFinite(input[i])) throw new Error('InvalidAudio');
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32768)));
  }
  return pcm;
}
export function measure(input: Float32Array) {
  let peak = 0, energy = 0;
  for (const value of input) { peak = Math.max(peak, Math.abs(value)); energy += value * value; }
  return { rms: input.length ? Math.sqrt(energy / input.length) : 0, peak, clipped: peak >= .999 };
}
export function demoRecording(): RecordingData {
  const data = new Float32Array(TARGET_RATE * 5);
  for (let i = 0; i < data.length; i++) {
    const t = i / TARGET_RATE;
    const envelope = Math.sin(Math.PI * Math.min(1, (t % .7) / .6)) ** 4 * .42;
    data[i] = (Math.sin(2 * Math.PI * (260 + 40 * Math.floor(t / .7)) * t) * .7 + Math.sin(2 * Math.PI * 520 * t) * .3) * envelope;
  }
  try { return { pcm: floatToPcm16(data), sampleRate: TARGET_RATE, ...measure(data), source: 'demo' }; }
  finally { data.fill(0); }
}
export function wipe(recording: RecordingData | null) { recording?.pcm.fill(0); }
export function waveform(pcm: Int16Array, bins = 84): number[] {
  return Array.from({ length: bins }, (_, bin) => {
    const start = Math.floor(bin * pcm.length / bins);
    const end = Math.floor((bin + 1) * pcm.length / bins);
    let peak = 0;
    for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(pcm[i]) / 32768);
    return peak;
  });
}
