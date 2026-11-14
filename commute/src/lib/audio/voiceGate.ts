// マイク音声の送信ゲート（費用対策）
//
// 課金レポート（2026-11-07〜14）では費用の約72%が Live の「音声入力」だった。
// 従来はマイク音声を無音の間も・先生が話している間も約0.25秒ごとに送り続けていた。
// このゲートは「人の声らしい音量」を検出した区間だけを送信対象にする。
//
// - 判定は音量(RMS)と、車内騒音レベル（ノイズフロア）の比較による簡易VAD
// - ノイズフロア = 直近 floorWindowMs の最小RMS。話している最中も単語の切れ目で
//   音量が下がるため、常に更新できる（一定のロードノイズでは開かず、開きっぱなしにもならない）
// - 話し始めの欠けを防ぐため、直前 preRollMs 分を常に保持し、開いた瞬間にまとめて送る
// - 話し終わり後も hangoverMs は送り続け、Gemini側の発話区切り検出に無音を渡してから
//   "end" を出す（呼び出し側が audioStreamEnd を送る）
//
// 時間はサンプル数で数える（壁時計を使わない）ので、テストで決定的に検証できる。
// しきい値は初期値。実車での聞き取り漏れ・誤検出を見て調整すること。

export const GATE_RATE = 16000;

export interface VoiceGateOptions {
  /** 開く直前に遡って送る長さ */
  preRollMs: number;
  /** 声が途切れてから閉じるまでの猶予 */
  hangoverMs: number;
  /** これを連続で超えたら開く（クリック音などの誤検出防止） */
  onsetMs: number;
  /** 声とみなす最小RMS（-1〜1スケール）。静かな車内での小声を拾える程度に低く */
  minSpeechRms: number;
  /** ノイズフロアの何倍で「声の始まり」とみなすか */
  onsetRatio: number;
  /** 開いている間、ノイズフロアの何倍以上を「まだ話している」とみなすか */
  sustainRatio: number;
  /** ノイズフロアを測る窓（この間の最小RMS） */
  floorWindowMs: number;
  /** 起動直後（窓が埋まるまで）のノイズフロア */
  initialFloor: number;
}

export const DEFAULT_GATE_OPTIONS: VoiceGateOptions = {
  preRollMs: 500,
  hangoverMs: 1200,
  onsetMs: 80,
  minSpeechRms: 0.01,
  onsetRatio: 3,
  sustainRatio: 2,
  floorWindowMs: 3000,
  initialFloor: 0.004,
};

export type GateEvent = { type: "audio"; pcm: Int16Array } | { type: "end" };

export function rmsOfInt16(pcm: Int16Array): number {
  if (pcm.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] / 0x8000;
    sum += v * v;
  }
  return Math.sqrt(sum / pcm.length);
}

export class VoiceGate {
  private readonly o: VoiceGateOptions;
  private open = false;
  private onsetSamples = 0;
  private silentSamples = 0;
  private preRoll: Int16Array[] = [];
  private preRollLen = 0;
  /** ノイズフロア計測窓: 各フレームの RMS と長さ。先頭は起動時の仮の値 */
  private floorWin: { rms: number; samples: number }[];
  private floorWinLen: number;
  private readonly floorWinMax: number;
  /** 計測用: 入力された総サンプル数と、送信対象にしたサンプル数 */
  totalSamples = 0;
  passedSamples = 0;

  constructor(opts: Partial<VoiceGateOptions> = {}) {
    this.o = { ...DEFAULT_GATE_OPTIONS, ...opts };
    this.floorWinMax = Math.ceil((this.o.floorWindowMs / 1000) * GATE_RATE);
    // 窓が実データで埋まるまでは initialFloor を使う
    this.floorWin = [{ rms: this.o.initialFloor, samples: this.floorWinMax }];
    this.floorWinLen = this.floorWinMax;
  }

  get isOpen(): boolean {
    return this.open;
  }

  get noiseFloor(): number {
    let m = Infinity;
    for (const f of this.floorWin) if (f.rms < m) m = f.rms;
    return Math.max(m, 1e-4);
  }

  private ms(samples: number): number {
    return (samples / GATE_RATE) * 1000;
  }

  private trackFloor(rms: number, samples: number): void {
    this.floorWin.push({ rms, samples });
    this.floorWinLen += samples;
    while (this.floorWin.length > 1 && this.floorWinLen - this.floorWin[0].samples >= this.floorWinMax) {
      this.floorWinLen -= this.floorWin[0].samples;
      this.floorWin.shift();
    }
  }

  /** 16kHz/16bit モノラルのフレームを1つ入れ、送るべき音声と区切りを返す */
  push(frame: Int16Array): GateEvent[] {
    const out: GateEvent[] = [];
    this.totalSamples += frame.length;
    const rms = rmsOfInt16(frame);
    this.trackFloor(rms, frame.length);
    const floor = this.noiseFloor;

    if (!this.open) {
      const onsetThreshold = Math.max(this.o.minSpeechRms, floor * this.o.onsetRatio);
      if (rms >= onsetThreshold) this.onsetSamples += frame.length;
      else this.onsetSamples = 0;
      this.pushPreRoll(frame);
      if (this.ms(this.onsetSamples) >= this.o.onsetMs) {
        // 開く: 保持していた直前の音声（今のフレームを含む）をまとめて送る
        this.open = true;
        this.silentSamples = 0;
        this.onsetSamples = 0;
        const buffered = this.drainPreRoll();
        if (buffered.length > 0) {
          this.passedSamples += buffered.length;
          out.push({ type: "audio", pcm: buffered });
        }
      }
      return out;
    }

    // 開いている間: 全フレームを送る
    this.passedSamples += frame.length;
    out.push({ type: "audio", pcm: frame });
    const sustainThreshold = Math.max(this.o.minSpeechRms, floor * this.o.sustainRatio);
    if (rms >= sustainThreshold) {
      this.silentSamples = 0;
    } else {
      this.silentSamples += frame.length;
      if (this.ms(this.silentSamples) >= this.o.hangoverMs) {
        this.open = false;
        this.silentSamples = 0;
        out.push({ type: "end" });
      }
    }
    return out;
  }

  private pushPreRoll(frame: Int16Array): void {
    this.preRoll.push(frame);
    this.preRollLen += frame.length;
    const max = Math.ceil((this.o.preRollMs / 1000) * GATE_RATE);
    while (this.preRoll.length > 1 && this.preRollLen - this.preRoll[0].length >= max) {
      this.preRollLen -= this.preRoll[0].length;
      this.preRoll.shift();
    }
  }

  private drainPreRoll(): Int16Array {
    const all = new Int16Array(this.preRollLen);
    let o = 0;
    for (const p of this.preRoll) {
      all.set(p, o);
      o += p.length;
    }
    this.preRoll = [];
    this.preRollLen = 0;
    return all;
  }
}
