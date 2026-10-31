/* AudioContext runs at 24kHz; browser performs device-rate resampling. */
class RealtimeCapture extends AudioWorkletProcessor {
  constructor() { super(); this.frame = new ArrayBuffer(960); this.view = new DataView(this.frame); this.offset = 0; this.peak = 0; }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let value = 0;
      for (const channel of channels) value += channel[i] / channels.length;
      this.peak = Math.max(this.peak, Math.abs(value));
      this.view.setInt16(this.offset * 2, Math.max(-32768, Math.min(32767, Math.round(value * 32768))), true);
      if (++this.offset === 480) {
        this.port.postMessage({ pcm: this.frame, peak: this.peak }, [this.frame]);
        this.frame = new ArrayBuffer(960); this.view = new DataView(this.frame); this.offset = 0; this.peak = 0;
      }
    }
    return true;
  }
}
registerProcessor('momo-realtime', RealtimeCapture);
