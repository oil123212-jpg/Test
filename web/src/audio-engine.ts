import { TARGET_RATE, floatToPcm16, measure, type RecordingData } from './audio-utils';
type SinkContext = AudioContext & { setSinkId?: (id: string) => Promise<void> };
const aborted = () => new DOMException('Operation cancelled', 'AbortError');
export class AudioEngine {
  private operation: AbortController | null = null;
  private finishPlayback: (() => void) | null = null;
  private playbackOperation: AbortController | null = null;
  get canSelectOutput() { return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype; }
  cancel() { this.operation?.abort(); this.playbackOperation?.abort(); this.finishPlayback?.(); }
  private requireMicrophone() {
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('SecureContextRequired');
  }
  async inspectInput(deviceId: string): Promise<MediaDeviceInfo[]> {
    this.requireMicrophone();
    const controller = new AbortController();
    this.operation = controller;
    let stream: MediaStream | undefined;
    const close = () => stream?.getTracks().forEach(track => track.stop());
    controller.signal.addEventListener('abort', close, { once: true });
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
      if (controller.signal.aborted) throw aborted();
      return await navigator.mediaDevices.enumerateDevices();
    } finally {
      close();
      controller.signal.removeEventListener('abort', close);
      if (this.operation === controller) this.operation = null;
    }
  }
  async record(deviceId: string, onStart: () => void, onSamples: (elapsed: number, peak: number) => void): Promise<RecordingData> {
    this.requireMicrophone();
    if (typeof AudioContext === 'undefined') throw new Error('WebAudioRequired');
    const controller = new AbortController();
    this.operation = controller;
    const context = new AudioContext();
    let stream: MediaStream | undefined;
    let node: AudioWorkletNode | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const chunks: Float32Array[] = [];
    let raw: Float32Array | undefined;
    let offlineBuffer: AudioBuffer | undefined;
    let rendered: AudioBuffer | undefined;
    const closeCapture = () => {
      stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
      source?.disconnect();
      if (node) { node.port.onmessage = null; node.disconnect(); node.port.close(); }
      void context.close().catch(() => {});
    };
    controller.signal.addEventListener('abort', closeCapture, { once: true });
    try {
      await context.resume();
      stream = await navigator.mediaDevices.getUserMedia({ audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        channelCount: { ideal: 1 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      }});
      if (controller.signal.aborted) throw aborted();
      if (!context.audioWorklet) throw new Error('WebAudioRequired');
      await context.audioWorklet.addModule('/capture-worklet.js');
      if (controller.signal.aborted) throw aborted();
      source = context.createMediaStreamSource(stream);
      node = new AudioWorkletNode(context, 'momo-capture', { processorOptions: { frames: Math.round(context.sampleRate * 5) } });
      const activeNode = node;
      await new Promise<void>((resolve, reject) => {
        let frames = 0, displayedFrames = 0, intervalPeak = 0;
        const stop = () => reject(aborted());
        controller.signal.addEventListener('abort', stop, { once: true });
        const finish = (error?: Error) => {
          clearTimeout(timeout);
          controller.signal.removeEventListener('abort', stop);
          error ? reject(error) : resolve();
        };
        activeNode.onprocessorerror = () => finish(new Error('CaptureFailed'));
        stream!.getAudioTracks().forEach(track => { track.onended = () => finish(new Error('DeviceDisconnected')); });
        activeNode.port.onmessage = event => {
          const samples = event.data.samples as Float32Array;
          if (controller.signal.aborted) { samples.fill(0); finish(aborted()); return; }
          chunks.push(samples);
          frames += samples.length;
          intervalPeak = Math.max(intervalPeak, measure(samples).peak);
          if (frames - displayedFrames >= context.sampleRate / 25 || event.data.done) {
            onSamples(frames / context.sampleRate, intervalPeak); displayedFrames = frames; intervalPeak = 0;
          }
          if (event.data.done) finish();
        };
        timeout = setTimeout(() => finish(new Error('CaptureTimeout')), 10000);
        // This processor outputs silence: microphone input is never looped back.
        source!.connect(activeNode);
        activeNode.connect(context.destination);
        onStart();
      });
      closeCapture();
      if (controller.signal.aborted) throw aborted();
      const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
      raw = new Float32Array(size);
      let offset = 0;
      for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; chunk.fill(0); }
      const stats = measure(raw);
      const offline = new OfflineAudioContext(1, Math.round(size * TARGET_RATE / context.sampleRate), TARGET_RATE);
      offlineBuffer = offline.createBuffer(1, size, context.sampleRate);
      offlineBuffer.copyToChannel(raw as Float32Array<ArrayBuffer>, 0);
      const audio = offline.createBufferSource();
      audio.buffer = offlineBuffer;
      audio.connect(offline.destination);
      audio.start();
      rendered = await offline.startRendering();
      if (controller.signal.aborted) throw aborted();
      return { pcm: floatToPcm16(rendered.getChannelData(0)), sampleRate: TARGET_RATE, ...stats, source: 'microphone' };
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener('abort', closeCapture);
      closeCapture();
      chunks.forEach(chunk => chunk.fill(0));
      raw?.fill(0);
      offlineBuffer?.getChannelData(0).fill(0);
      rendered?.getChannelData(0).fill(0);
      if (this.operation === controller) this.operation = null;
    }
  }
  async play(recording: RecordingData, volume: number, outputId: string): Promise<void> {
    if (!Number.isFinite(volume) || volume <= 0 || volume > .2) throw new Error('InvalidVolume');
    if (typeof AudioContext === 'undefined') throw new Error('WebAudioRequired');
    const controller = new AbortController();
    this.playbackOperation = controller;
    const context: SinkContext = new AudioContext();
    const abortPlayback = () => { this.finishPlayback?.(); void context.close().catch(() => {}); };
    controller.signal.addEventListener('abort', abortPlayback, { once: true });
    const source = context.createBufferSource();
    const buffer = context.createBuffer(1, recording.pcm.length, recording.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = recording.pcm[i] / 32768 * volume;
    let finish: (() => void) | undefined;
    try {
      await context.resume();
      if (controller.signal.aborted) throw aborted();
      if (outputId && context.setSinkId) await context.setSinkId(outputId);
      if (controller.signal.aborted) throw aborted();
      source.buffer = buffer;
      source.connect(context.destination);
      await new Promise<void>(resolve => {
        finish = () => { source.onended = null; try { source.stop(); } catch {} resolve(); };
        this.finishPlayback = finish;
        source.onended = finish;
        source.start();
      });
    } finally {
      controller.signal.removeEventListener('abort', abortPlayback);
      if (this.playbackOperation === controller) this.playbackOperation = null;
      if (this.finishPlayback === finish) this.finishPlayback = null;
      source.disconnect(); channel.fill(0);
      await context.close().catch(() => {});
    }
  }
  async tone(volume: number, outputId: string) {
    const pcm = new Int16Array(TARGET_RATE);
    for (let i = 0; i < pcm.length; i++) {
      const edge = Math.min(1, i / 480, (pcm.length - i - 1) / 480);
      pcm[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / TARGET_RATE) * 32767 * edge);
    }
    try { await this.play({ pcm, sampleRate: TARGET_RATE, rms: 0, peak: 1, clipped: false, source: 'demo' }, volume, outputId); }
    finally { pcm.fill(0); }
  }
}
