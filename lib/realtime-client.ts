import { TranscriptLedger, type TranscriptEvent } from './auto-session';

type Callbacks = { caption: (text: string) => void; sentence: (text: string) => void; error: (message: string) => void; connected: () => void; closed: () => void };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export class RealtimeClassroom {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private media: MediaStream | null = null;
  private audio: AudioContext | null = null;
  private interval?: ReturnType<typeof setInterval>;
  private ledger = new TranscriptLedger();
  private stopped = false;
  private closing = false;
  private controller = new AbortController();
  private voiced = false;
  private awaitingCommit = 0;
  private callbacks: Callbacks;
  constructor(callbacks: Callbacks) { this.callbacks = callbacks; }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw Error('이 브라우저는 실시간 음성을 지원하지 않습니다. Chrome 또는 Edge에서 localhost로 접속해 주세요.');
    const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (this.stopped) { media.getTracks().forEach(track => track.stop()); return; }
    this.media = media;
    const pc = this.pc = new RTCPeerConnection();
    const dc = this.dc = pc.createDataChannel('oai-events');
    pc.addTrack(media.getAudioTracks()[0]);
    let lastVoice = Date.now(), start = Date.now();
    dc.onmessage = event => {
      if (this.stopped) return;
      let data: TranscriptEvent;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'input_audio_buffer.committed') this.awaitingCommit = Math.max(0, this.awaitingCommit - 1);
      if (data.type === 'error') {
        this.awaitingCommit = Math.max(0, this.awaitingCommit - 1);
        if (data.error?.code !== 'input_audio_buffer_commit_empty') this.callbacks.error('음성을 처리하지 못했습니다. 연결을 다시 시작하거나 직접 입력해 주세요.');
      }
      if (data.type.endsWith('input_audio_transcription.failed')) this.callbacks.error('일부 음성을 인식하지 못했습니다. 해당 설명을 다시 말하거나 직접 입력해 주세요.');
      const sentences = this.ledger.ingest(data);
      this.callbacks.caption(this.ledger.caption);
      sentences.forEach(text => this.callbacks.sentence(text));
    };
    pc.onconnectionstatechange = () => {
      if (!this.stopped && !this.closing && ['failed', 'disconnected'].includes(pc.connectionState)) { this.callbacks.error('마이크 연결이 끊겼습니다. 녹음을 다시 시작해 주세요. 기존 판서는 유지됩니다.'); this.close(); }
    };
    const opened = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('실시간 음성 연결 시간이 초과되었습니다.')), 30000);
      dc.onopen = () => { clearTimeout(timeout); resolve(); };
      this.controller.signal.addEventListener('abort', () => { clearTimeout(timeout); reject(new DOMException('Stopped', 'AbortError')); }, { once: true });
    });
    // Attach a rejection handler immediately while the SDP request is in flight.
    void opened.catch(() => {});
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    const response = await fetch('/api/realtime', { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: offer.sdp, signal: this.controller.signal });
    if (!response.ok) { const data = await response.json() as { error?: string }; throw Error(data.error || '음성을 연결하지 못했습니다.'); }
    await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    await opened;
    if (this.stopped) return;
    this.audio = new AudioContext(); await this.audio.resume();
    const analyser = this.audio.createAnalyser(); analyser.fftSize = 1024;
    this.audio.createMediaStreamSource(media).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    this.interval = setInterval(() => {
      if (this.stopped || this.closing) return;
      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);
      const now = Date.now();
      if (rms > 0.012) { if (!this.voiced) start = now; this.voiced = true; lastVoice = now; }
      if (this.voiced && (now - lastVoice > 900 || now - start > 12000)) this.commit();
    }, 100);
    this.callbacks.connected();
  }
  private commit() {
    if (this.dc?.readyState !== 'open') return;
    this.awaitingCommit++; this.voiced = false;
    this.dc.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
  }
  async finish() {
    if (this.stopped) return;
    this.closing = true;
    clearInterval(this.interval);
    this.media?.getTracks().forEach(track => { track.enabled = false; });
    // Let the final microphone packets arrive before flushing the input buffer.
    await pause(300);
    this.commit();
    this.media?.getTracks().forEach(track => track.stop());
    const deadline = Date.now() + 15000;
    while (!this.stopped && (this.awaitingCommit || this.ledger.pending) && Date.now() < deadline) await pause(100);
    if (this.awaitingCommit || this.ledger.pending) this.callbacks.error('마지막 음성 인식이 완료되지 않았습니다. 확인된 판서만 저장됩니다.');
    this.close();
  }
  close() {
    if (this.stopped) return;
    this.stopped = true; this.controller.abort(); clearInterval(this.interval);
    this.media?.getTracks().forEach(track => track.stop());
    this.dc?.close(); this.pc?.close(); void this.audio?.close().catch(() => {});
    this.callbacks.closed();
  }
}
