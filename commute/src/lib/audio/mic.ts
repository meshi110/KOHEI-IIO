// マイク入力: getUserMedia → AudioWorklet → 16kHz/16bit/モノラル PCM (base64)
// 仕様書6: echoCancellation / noiseSuppression / autoGainControl を有効にする

const WORKLET_CODE = `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; this.len = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) {
      this.buf.push(new Float32Array(ch));
      this.len += ch.length;
      if (this.len >= 2048) {
        const out = new Float32Array(this.len);
        let o = 0;
        for (const b of this.buf) { out.set(b, o); o += b.length; }
        this.port.postMessage(out, [out.buffer]);
        this.buf = []; this.len = 0;
      }
    }
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);
`;

const TARGET_RATE = 16000;
const EMIT_SAMPLES = 4096; // 16kHzで約256msごとに送信

function floatTo16kInt16(input: Float32Array, inputRate: number): Int16Array {
  const ratio = inputRate / TARGET_RATE;
  const outLen = Math.floor(input.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    const s = input[i0] * (1 - frac) + input[i1] * frac;
    const clamped = Math.max(-1, Math.min(1, s));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export class MicCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private pending: Int16Array[] = [];
  private pendingLen = 0;
  private muted = false;

  async start(onChunk: (base64: string) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    this.ctx = new AudioContext(); // 端末既定レート（例: 48kHz）→ 下で16kへ変換
    await this.ctx.resume();
    const blobUrl = URL.createObjectURL(
      new Blob([WORKLET_CODE], { type: "application/javascript" }),
    );
    await this.ctx.audioWorklet.addModule(blobUrl);
    URL.revokeObjectURL(blobUrl);

    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "capture-processor");
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (this.muted || !this.ctx) return;
      const pcm = floatTo16kInt16(e.data, this.ctx.sampleRate);
      this.pending.push(pcm);
      this.pendingLen += pcm.length;
      if (this.pendingLen >= EMIT_SAMPLES) {
        const all = new Int16Array(this.pendingLen);
        let o = 0;
        for (const p of this.pending) {
          all.set(p, o);
          o += p.length;
        }
        this.pending = [];
        this.pendingLen = 0;
        onChunk(int16ToBase64(all));
      }
    };
    src.connect(this.node);
    // 出力には繋がない（自分の声をスピーカーに戻さない）
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  stop(): void {
    try {
      this.node?.disconnect();
    } catch {
      /* noop */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.node = null;
    this.stream = null;
    this.ctx = null;
    this.pending = [];
    this.pendingLen = 0;
  }
}

export const MIC_MIME = `audio/pcm;rate=${TARGET_RATE}`;
