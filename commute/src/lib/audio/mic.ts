// マイク入力: getUserMedia → AudioWorklet → 16kHz/16bit/モノラル PCM (base64)
// 仕様書6: echoCancellation / noiseSuppression / autoGainControl を有効にする
// 費用対策: 既定では voiceGate で声を検出した区間だけ送る

import { VoiceGate } from "./voiceGate";

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

export interface MicOptions {
  /**
   * true: 声を検出した区間だけ送る（voiceGate.ts）。false: 従来どおり常時送る。
   * 既定は true。Vercel の環境変数 VITE_MIC_GATE=off で従来動作に戻せる。
   */
  gate?: boolean;
  /** ゲートが閉じた（話し終わった）とき。呼び出し側で audioStreamEnd を送る */
  onStreamEnd?: () => void;
}

export function micGateEnabled(): boolean {
  return import.meta.env.VITE_MIC_GATE !== "off";
}

export class MicCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private pending: Int16Array[] = [];
  private pendingLen = 0;
  private muted = false;
  private gate: VoiceGate | null = null;

  /** 計測用: マイクから入った音声のうち送信した割合（ゲート無効時は null） */
  get sentRatio(): number | null {
    if (!this.gate || this.gate.totalSamples === 0) return null;
    return this.gate.passedSamples / this.gate.totalSamples;
  }

  async start(onChunk: (base64: string) => void, opts: MicOptions = {}): Promise<void> {
    this.gate = opts.gate === false ? null : new VoiceGate();
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
    const flush = () => {
      if (this.pendingLen === 0) return;
      const all = new Int16Array(this.pendingLen);
      let o = 0;
      for (const p of this.pending) {
        all.set(p, o);
        o += p.length;
      }
      this.pending = [];
      this.pendingLen = 0;
      onChunk(int16ToBase64(all));
    };
    const enqueue = (pcm: Int16Array) => {
      this.pending.push(pcm);
      this.pendingLen += pcm.length;
      if (this.pendingLen >= EMIT_SAMPLES) flush();
    };
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (this.muted || !this.ctx) return;
      const pcm = floatTo16kInt16(e.data, this.ctx.sampleRate);
      if (!this.gate) {
        enqueue(pcm);
        return;
      }
      for (const ev of this.gate.push(pcm)) {
        if (ev.type === "audio") {
          enqueue(ev.pcm);
        } else {
          // 話し終わり: 溜まっている分を送り切ってから区切りを伝える
          flush();
          opts.onStreamEnd?.();
        }
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
    // gate は計測値（sentRatio）を終了後に読めるよう残す。次の start() で作り直す
  }
}

export const MIC_MIME = `audio/pcm;rate=${TARGET_RATE}`;
