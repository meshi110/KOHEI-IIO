import { describe, expect, it } from "vitest";
import { GATE_RATE, VoiceGate, rmsOfInt16, type GateEvent } from "../src/lib/audio/voiceGate";

// 実機の1フレーム ≒ 48kHzで2048サンプル → 16kHzで約683サンプル（約43ms）
const FRAME = 683;

/** 指定RMSの正弦波フレーム（振幅 = RMS×√2） */
function frame(rms: number): Int16Array {
  const out = new Int16Array(FRAME);
  const amp = rms * Math.SQRT2 * 0x7fff;
  for (let i = 0; i < FRAME; i++) out[i] = Math.round(amp * Math.sin((2 * Math.PI * 300 * i) / GATE_RATE));
  return out;
}

/** rms の音を ms ミリ秒ぶん入れ、出てきたイベントを返す */
function feed(g: VoiceGate, rms: number, ms: number): GateEvent[] {
  const n = Math.round(((ms / 1000) * GATE_RATE) / FRAME);
  const ev: GateEvent[] = [];
  for (let i = 0; i < n; i++) ev.push(...g.push(frame(rms)));
  return ev;
}

const QUIET = 0.002; // 静かな車内（ノイズ抑制後）
const SPEECH = 0.1; // 普通の声（AGC後）
const audioSamples = (ev: GateEvent[]) =>
  ev.reduce((a, e) => a + (e.type === "audio" ? e.pcm.length : 0), 0);
const ends = (ev: GateEvent[]) => ev.filter((e) => e.type === "end").length;

describe("VoiceGate（声のある区間だけ送る）", () => {
  it("テスト用フレームのRMSが指定どおり", () => {
    expect(rmsOfInt16(frame(0.1))).toBeCloseTo(0.1, 2);
  });

  it("静かな無音は1サンプルも送らない", () => {
    const g = new VoiceGate();
    const ev = feed(g, QUIET, 5000);
    expect(ev).toEqual([]);
    expect(g.passedSamples).toBe(0);
  });

  it("話し始めると開き、直前0.5秒ぶんを含めて送る（語頭が欠けない）", () => {
    const g = new VoiceGate();
    feed(g, QUIET, 2000);
    const ev = feed(g, SPEECH, 1000);
    expect(g.isOpen).toBe(true);
    const first = ev.find((e) => e.type === "audio");
    expect(first && first.type === "audio" && first.pcm.length).toBeGreaterThanOrEqual(0.5 * GATE_RATE);
  });

  it("単語の切れ目（0.5秒の無音）では閉じない", () => {
    const g = new VoiceGate();
    feed(g, QUIET, 2000);
    const ev = [...feed(g, SPEECH, 1000), ...feed(g, QUIET, 500), ...feed(g, SPEECH, 1000)];
    expect(ends(ev)).toBe(0);
    expect(g.isOpen).toBe(true);
  });

  it("話し終わって1.2秒後に閉じ、区切り(end)は1回だけ出る", () => {
    const g = new VoiceGate();
    feed(g, QUIET, 2000);
    feed(g, SPEECH, 1000);
    const after = feed(g, QUIET, 3000);
    expect(ends(after)).toBe(1);
    expect(g.isOpen).toBe(false);
    // 閉じるまでの無音（約1.2秒）は送っている（Gemini側の区切り検出用）
    const sec = audioSamples(after) / GATE_RATE;
    expect(sec).toBeGreaterThan(1.1);
    expect(sec).toBeLessThan(1.3);
  });

  it("一瞬の大きな音（1フレーム）では開かない", () => {
    const g = new VoiceGate();
    feed(g, QUIET, 2000);
    const ev = [...g.push(frame(0.3)), ...feed(g, QUIET, 1000)];
    expect(ev).toEqual([]);
  });

  it("一定のロードノイズでは、計測窓(3秒)が埋まった後は開かない", () => {
    const g = new VoiceGate();
    feed(g, 0.03, 6000); // 起動直後は仮のフロア値のため一時的に開くことがある
    const later = feed(g, 0.03, 10000);
    expect(later).toEqual([]);
    expect(g.isOpen).toBe(false);
  });

  it("ロードノイズの中でも声は検出する", () => {
    const g = new VoiceGate();
    feed(g, 0.03, 6000);
    feed(g, 0.15, 500);
    expect(g.isOpen).toBe(true);
  });

  it("騒音が上がっても開きっぱなしにならない", () => {
    const g = new VoiceGate();
    feed(g, QUIET, 2000);
    feed(g, SPEECH, 1000);
    // 話し終わった直後に騒音だけが大きくなった（例: 窓を開けた）
    const ev = feed(g, 0.05, 8000);
    expect(ends(ev)).toBeGreaterThanOrEqual(1);
    expect(g.isOpen).toBe(false);
  });

  it("10秒無音→2秒発話→10秒無音 なら、送るのは全体の一部だけ", () => {
    const g = new VoiceGate();
    feed(g, QUIET, 10000);
    feed(g, SPEECH, 2000);
    feed(g, QUIET, 10000);
    const ratio = g.passedSamples / g.totalSamples;
    // 期待値 ≒ (直前0.5 + 発話2 + 余韻1.2) / 22 ≒ 17%
    expect(ratio).toBeGreaterThan(0.12);
    expect(ratio).toBeLessThan(0.22);
  });
});
