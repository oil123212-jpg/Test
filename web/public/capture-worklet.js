/* Local capture only. Outputs stay silent. Each block's ownership is transferred
   to this tab; the processor retains no voice sample buffer between calls. */
class MomoCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.remaining = options.processorOptions.frames;
  }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length || this.remaining <= 0) return this.remaining > 0;
    const count = Math.min(channels[0].length, this.remaining);
    const samples = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      for (const channel of channels) samples[i] += channel[i] / channels.length;
    }
    this.remaining -= count;
    this.port.postMessage({ samples, done: this.remaining === 0 }, [samples.buffer]);
    return this.remaining > 0;
  }
}
registerProcessor('momo-capture', MomoCapture);
