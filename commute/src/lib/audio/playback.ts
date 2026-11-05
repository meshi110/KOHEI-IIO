// 再生: 24kHz/16bit PCM をキューに入れて途切れなく再生（仕様書6）
// interrupted を受けたら clear() でキューを即座に破棄する

const OUTPUT_RATE = 24000;

function base64ToFloat32(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 0x8000;
  return out;
}

export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();

  async init(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new AudioContext({ sampleRate: OUTPUT_RATE });
    await this.ctx.resume();
  }

  /** ユーザー操作直後に呼んで再生を解禁する（iOS対策） */
  async unlock(): Promise<void> {
    await this.init();
    if (this.ctx!.state === "suspended") await this.ctx!.resume();
  }

  enqueue(base64Pcm: string): void {
    if (!this.ctx) return;
    const data = base64ToFloat32(base64Pcm);
    if (data.length === 0) return;
    const buf = this.ctx.createBuffer(1, data.length, OUTPUT_RATE);
    buf.copyToChannel(data, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const startAt = Math.max(this.nextTime, this.ctx.currentTime + 0.04);
    src.start(startAt);
    this.nextTime = startAt + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** 割り込み時にキューを即クリア */
  clear(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextTime = 0;
  }

  /** 再生中かどうか（おおまか） */
  get speaking(): boolean {
    return !!this.ctx && this.nextTime > this.ctx.currentTime + 0.05;
  }

  /** 再接続中の短い効果音（仕様書6: 画面操作は求めない） */
  chime(): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.25);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  close(): void {
    this.clear();
    void this.ctx?.close();
    this.ctx = null;
  }
}
