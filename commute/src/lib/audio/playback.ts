// 再生: 24kHz/16bit PCM をキューに入れて途切れなく再生（仕様書6）
// interrupted を受けたら clear() でキューを即座に破棄する

const OUTPUT_RATE = 24000;

export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  /** 16bit境界をまたいで届いたチャンクの端数バイト（持ち越さないと以降が全てノイズになる） */
  private carry: Uint8Array | null = null;

  async init(): Promise<void> {
    if (this.ctx) return;
    // iOS Safari は sampleRate を強制指定するとノイズ/クラックルが出ることがある
    // （端末は48kHz動作）。端末既定レートで作り、AudioBuffer(24kHz)の自動リサンプルに任せる。
    this.ctx = new AudioContext();
    await this.ctx.resume();
  }

  private decodeChunk(b64: string) {
    const bin = atob(b64);
    const prev = this.carry ? this.carry.length : 0;
    const bytes = new Uint8Array(prev + bin.length);
    if (this.carry) bytes.set(this.carry, 0);
    for (let i = 0; i < bin.length; i++) bytes[prev + i] = bin.charCodeAt(i);
    const usable = bytes.length - (bytes.length % 2);
    this.carry = usable < bytes.length ? bytes.slice(usable) : null;
    // 16bit リトルエンディアン PCM → Float32（-1〜1）
    const out = new Float32Array(usable / 2);
    for (let i = 0; i < out.length; i++) {
      let v = bytes[2 * i] | (bytes[2 * i + 1] << 8);
      if (v >= 0x8000) v -= 0x10000;
      out[i] = v / 0x8000;
    }
    return out;
  }

  /** ユーザー操作直後に呼んで再生を解禁する（iOS対策） */
  async unlock(): Promise<void> {
    await this.init();
    if (this.ctx!.state === "suspended") await this.ctx!.resume();
  }

  enqueue(base64Pcm: string): void {
    if (!this.ctx) return;
    const data = this.decodeChunk(base64Pcm);
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
    this.carry = null;
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
