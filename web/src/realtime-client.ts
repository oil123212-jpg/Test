import { emptyLifeGuide, type LifeGuide } from '../shared/life-guide.mjs';
export type ConversationState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';
interface Callbacks { state: (value: ConversationState) => void; error: (code: string) => void; level: (peak: number) => void; }
export const REALTIME_POLICY = 'realtime-adult-test-v1';
export const realtimeErrors: Record<string, string> = {
  API_KEY_MISSING:'Railway의 OPENAI_API_KEY 설정이 필요해요.',
  API_AUTH_FAILED:'API 키 또는 프로젝트의 모델 접근 권한을 확인해 주세요.',
  API_QUOTA:'OpenAI API 잔액과 사용 한도를 확인해 주세요.',
  API_RATE_LIMIT:'API 요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요.',
  MODEL_UNAVAILABLE:'Railway의 OPENAI_REALTIME_MODEL에 사용 가능한 모델을 설정해 주세요.',
  SESSION_LIMIT:'동시 대화 또는 시간당 이용 한도에 도달했어요. 잠시 후 다시 시도해 주세요.',
  SESSION_EXPIRED:'대화 시간이 끝났어요. 다시 시작할 수 있어요.',
  ACCESS_DENIED:'이용 코드가 맞지 않아요.',
  CONSENT_REQUIRED:'실시간 음성 전송 안내에 먼저 동의해 주세요.',
  INVALID_LIFE_GUIDE:'생활 시간 설정을 확인한 뒤 다시 대화해 주세요.',
  CONNECT_TIMEOUT:'AI 연결 시간이 초과됐어요. 네트워크와 모델 설정을 확인해 주세요.',
  API_REQUEST_FAILED:'Realtime 세션 설정이 거부됐어요. 서버의 모델과 음성 설정을 확인해 주세요.',
  AUDIO_LIMIT:'오디오 대기열 한도에 도달해 대화를 종료했어요.',
  MICROPHONE_DENIED:'마이크 접근을 허용해 주세요.',
  MICROPHONE_UNAVAILABLE:'마이크를 사용할 수 없어요. 장치와 브라우저를 확인해 주세요.',
  UNSUPPORTED_AUDIO:'이 브라우저에서 24kHz 실시간 오디오를 시작할 수 없어요.',
  NETWORK_ERROR:'연결이 끊겼어요. 네트워크를 확인하고 다시 시작해 주세요.',
  UPSTREAM_UNAVAILABLE:'OpenAI에 연결하지 못했어요. 키·모델·네트워크 설정을 확인해 주세요.',
};
export class RealtimeConversation {
  private generation = 0;
  private socket: WebSocket | null = null;
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private input: MediaStreamAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private sources = new Map<AudioBufferSourceNode, AudioBuffer>();
  private nextTime = 0;
  private muted = false;
  private relayToken: string | null = null;
  private controller: AbortController | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  constructor(private callbacks: Callbacks) {}
  get active() { return this.context !== null || this.socket !== null || this.controller !== null; }
  async config() {
    const response = await fetch('/api/realtime/config', { cache:'no-store' });
    if (!response.ok) throw new Error('NETWORK_ERROR');
    return response.json() as Promise<{available:boolean; requiresAccessCode:boolean; model:string; maxSeconds:number; policy:string}>;
  }
  private stopPlayback() {
    for (const [source, buffer] of this.sources) {
      source.onended = null; try { source.stop(); } catch {}
      source.disconnect(); buffer.getChannelData(0).fill(0);
    }
    this.sources.clear(); this.nextTime = 0;
  }
  private lifeGuide: LifeGuide = emptyLifeGuide();
  updateLifeGuide(guide: LifeGuide) {
    this.lifeGuide = guide.enabled ? guide : emptyLifeGuide();
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({type:'life_guide.update',lifeGuide:this.lifeGuide}));
  }
  async start(inputDevice: string, outputDevice: string, volume: number, accessCode: string, lifeGuide = emptyLifeGuide()) {
    this.stop();
    this.lifeGuide = lifeGuide.enabled ? lifeGuide : emptyLifeGuide();
    const generation = ++this.generation;
    const controller = this.controller = new AbortController();
    this.callbacks.state('connecting');
    try {
      if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('MICROPHONE_UNAVAILABLE');
      const context = this.context = new AudioContext({sampleRate:24000});
      await context.resume();
      if (controller.signal.aborted) return;
      if (context.sampleRate !== 24000 || !context.audioWorklet) throw new Error('UNSUPPORTED_AUDIO');
      const sink = context as AudioContext & {setSinkId?: (id:string)=>Promise<void>};
      if (outputDevice && sink.setSinkId) await sink.setSinkId(outputDevice);
      const stream = await navigator.mediaDevices.getUserMedia({audio:{
        ...(inputDevice ? {deviceId:{exact:inputDevice}} : {}), channelCount:{ideal:1}, echoCancellation:true, noiseSuppression:true, autoGainControl:true,
      }});
      if (controller.signal.aborted || generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      stream.getTracks().forEach(track => { track.onended = () => this.fail('MICROPHONE_UNAVAILABLE'); });
      await context.audioWorklet.addModule(new URL('realtime-worklet.js', document.baseURI).href);
      if (controller.signal.aborted) return;
      const response = await fetch('/api/realtime/session', {
        method:'POST', credentials:'same-origin', signal:controller.signal,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({consent:true,adultTest:true,policy:REALTIME_POLICY,accessCode,lifeGuide:this.lifeGuide}),
      });
      const grant = await response.json();
      if (!response.ok) throw new Error(grant.code || 'NETWORK_ERROR');
      if (controller.signal.aborted || generation !== this.generation) return;
      this.relayToken = grant.token;
      this.gain = context.createGain(); this.gain.gain.value = Math.min(.2,Math.max(.01,volume)); this.gain.connect(context.destination);
      const url = new URL('/api/realtime',location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = this.socket = new WebSocket(url);
      socket.binaryType = 'arraybuffer';
      await new Promise<void>((resolve,reject) => {
        this.pendingReject = reject;
        this.timeout = setTimeout(() => reject(new Error('CONNECT_TIMEOUT')),15000);
        socket.onopen = () => socket.send(JSON.stringify({type:'start',token:grant.token}));
        socket.onerror = () => { if(generation === this.generation) this.fail('NETWORK_ERROR'); };
        socket.onclose = () => { if(generation === this.generation) this.fail('NETWORK_ERROR'); };
        socket.onmessage = event => {
          if (generation !== this.generation) return;
          if (event.data instanceof ArrayBuffer) { this.playChunk(event.data); return; }
          let message; try { message=JSON.parse(event.data); } catch { this.fail('NETWORK_ERROR'); return; }
          if (message.type === 'ready') {
            // Capture edits made while HTTP admission or the provider handshake was pending.
            socket.send(JSON.stringify({type:'life_guide.update',lifeGuide:this.lifeGuide}));
            clearTimeout(this.timeout); this.pendingReject=null; this.callbacks.state('listening'); resolve();
          } else if (message.type === 'error') this.fail(message.code);
          else if (message.type === 'speech.started' || message.type === 'response.cancelled') { this.stopPlayback(); this.callbacks.state('listening'); }
          else if (message.type === 'speech.stopped') this.callbacks.state('thinking');
          else if (message.type === 'response.started') this.callbacks.state('thinking');
          else if (message.type === 'response.done' && !this.sources.size) this.callbacks.state('listening');
        };
      });
      if (controller.signal.aborted || generation !== this.generation) return;
      this.input = context.createMediaStreamSource(stream);
      const node = this.node = new AudioWorkletNode(context,'momo-realtime');
      node.port.onmessage = event => {
        const pcm = event.data.pcm as ArrayBuffer;
        if (!this.muted && generation === this.generation && socket.readyState === WebSocket.OPEN) {
          if (socket.bufferedAmount > 96000) { new Uint8Array(pcm).fill(0); this.fail('AUDIO_LIMIT'); return; }
          socket.send(pcm); this.callbacks.level(event.data.peak);
        }
        new Uint8Array(pcm).fill(0);
      };
      this.input.connect(node); node.connect(context.destination); // processor outputs silence
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return;
      const name = error instanceof Error ? error.name : '';
      const code = name === 'NotAllowedError' ? 'MICROPHONE_DENIED' : name === 'NotFoundError' || name === 'NotReadableError' ? 'MICROPHONE_UNAVAILABLE' : error instanceof Error ? error.message : 'NETWORK_ERROR';
      this.fail(code);
    }
  }
  private playChunk(bytes: ArrayBuffer) {
    const context = this.context;
    if (!bytes.byteLength) return;
    if (!context || !this.gain || bytes.byteLength % 2 || bytes.byteLength > 1024*1024) { new Uint8Array(bytes).fill(0); return; }
    if (Math.max(context.currentTime, this.nextTime)-context.currentTime+bytes.byteLength/48000 > 8) { new Uint8Array(bytes).fill(0); this.fail('AUDIO_LIMIT'); return; }
    const view = new DataView(bytes), buffer = context.createBuffer(1,bytes.byteLength/2,24000);
    const channel = buffer.getChannelData(0);
    for(let i=0;i<channel.length;i++) channel[i]=view.getInt16(i*2,true)/32768;
    new Uint8Array(bytes).fill(0);
    const source = context.createBufferSource(); source.buffer=buffer; source.connect(this.gain);
    this.sources.set(source,buffer);
    source.onended=()=>{ source.disconnect(); channel.fill(0); this.sources.delete(source); if(!this.sources.size && this.active) this.callbacks.state('listening'); };
    const start=Math.max(context.currentTime+.025,this.nextTime); source.start(start); this.nextTime=start+buffer.duration;
    this.callbacks.state('speaking');
  }
  interrupt() {
    this.stopPlayback();
    if(this.socket?.readyState===WebSocket.OPEN) this.socket.send(JSON.stringify({type:'cancel'}));
    this.callbacks.state('listening');
  }
  toggleMute() {
    this.muted=!this.muted; this.stream?.getAudioTracks().forEach(track=>{track.enabled=!this.muted;});
    if(this.muted && this.socket?.readyState===WebSocket.OPEN) this.socket.send(JSON.stringify({type:'clear'}));
    return this.muted;
  }
  setVolume(value:number) { if(this.gain) this.gain.gain.value=Math.min(.2,Math.max(.01,value)); }
  private fail(code:string) { this.stop(); this.callbacks.error(realtimeErrors[code] ? code : 'UPSTREAM_UNAVAILABLE'); }
  stop() {
    this.generation++; this.controller?.abort(); this.controller=null;
    clearTimeout(this.timeout); this.pendingReject?.(new Error('CANCELLED')); this.pendingReject=null;
    this.stopPlayback();
    if(this.socket) { this.socket.onopen=null; this.socket.onmessage=null; this.socket.onclose=null; this.socket.onerror=null; this.socket.close(); this.socket=null; }
    if(this.node){this.node.port.onmessage=null;this.node.port.close();this.node.disconnect();this.node=null;}
    this.input?.disconnect(); this.input=null;
    this.stream?.getTracks().forEach(track=>{track.onended=null;track.stop();}); this.stream=null;
    this.gain?.disconnect();this.gain=null;
    if(this.context){void this.context.close().catch(()=>{});this.context=null;}
    if(this.relayToken){const token=this.relayToken;this.relayToken=null;void fetch('/api/realtime/session',{method:'DELETE',headers:{'X-Realtime-Session':token},credentials:'same-origin',keepalive:true}).catch(()=>{});}
    this.muted=false; this.callbacks.level(0); this.callbacks.state('idle');
    // Only same-origin, short-lived relay sessions; no provider key is sent here.
  }
}
