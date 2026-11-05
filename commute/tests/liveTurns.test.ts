import { describe, expect, it, vi } from "vitest";
import { LiveConversation } from "../src/lib/liveClient";
import type { PcmPlayer } from "../src/lib/audio/playback";

/** PcmPlayer のスタブ（nodeにはAudioContextが無いため） */
function stubPlayer() {
  return {
    cleared: 0,
    enqueued: [] as string[],
    clear() { this.cleared++; },
    enqueue(d: string) { this.enqueued.push(d); },
    chime() {},
    get speaking() { return false; },
  } as unknown as PcmPlayer & { cleared: number; enqueued: string[] };
}

function makeConv() {
  const turns: { seq: number; speaker: string; text: string }[] = [];
  const autoFinish = vi.fn();
  const player = stubPlayer();
  const conv = new LiveConversation("tok", "model", "sys", player, {
    onState: () => {},
    onCaption: () => {},
    onTurn: (t) => turns.push(t),
    onAutoFinish: autoFinish,
    onError: () => {},
  });
  // private onMessage を直接叩いてサーバーメッセージを注入する
  const feed = (m: unknown) => (conv as any).onMessage(m);
  return { conv, turns, autoFinish, player, feed };
}

describe("LiveConversation のターン確定", () => {
  it("turnComplete で user → ai の順に確定し、seqが連番になる", () => {
    const { turns, feed } = makeConv();
    feed({ serverContent: { inputTranscription: { text: "Good " } } });
    feed({ serverContent: { inputTranscription: { text: "morning." } } });
    feed({ serverContent: { outputTranscription: { text: "Morning Kohei! " } } });
    feed({ serverContent: { outputTranscription: { text: "Ready?" } } });
    feed({ serverContent: { turnComplete: true } });
    expect(turns).toEqual([
      { seq: 1, speaker: "user", text: "Good morning." },
      { seq: 2, speaker: "ai", text: "Morning Kohei! Ready?" },
    ]);
  });

  it("interrupted で再生キューをクリアし、途中までのAI発話を確定する", () => {
    const { turns, feed, player } = makeConv();
    feed({ serverContent: { outputTranscription: { text: "Let me tell you about" } } });
    feed({ serverContent: { interrupted: true } });
    expect((player as any).cleared).toBe(1);
    expect(turns).toEqual([{ seq: 1, speaker: "ai", text: "Let me tell you about" }]);
  });

  it("音声データは再生キューに入る", () => {
    const { feed, player } = makeConv();
    feed({ serverContent: { modelTurn: { parts: [{ inlineData: { data: "QUJD" } }] } } });
    expect((player as any).enqueued).toEqual(["QUJD"]);
  });

  it("短い Finish 発話で、次のAIまとめ完了後に onAutoFinish が呼ばれる", () => {
    const { feed, autoFinish } = makeConv();
    feed({ serverContent: { inputTranscription: { text: "OK, finish." } } });
    feed({ serverContent: { outputTranscription: { text: "Great job today. See you!" } } });
    feed({ serverContent: { turnComplete: true } });
    expect(autoFinish).toHaveBeenCalledTimes(1);
  });

  it("長い文中の finish では誤発火しない", () => {
    const { feed, autoFinish } = makeConv();
    feed({
      serverContent: {
        inputTranscription: {
          text: "I usually finish the operation in about ninety minutes with my assistant.",
        },
      },
    });
    feed({ serverContent: { outputTranscription: { text: "That is quite fast." } } });
    feed({ serverContent: { turnComplete: true } });
    expect(autoFinish).not.toHaveBeenCalled();
  });

  it("resumableなハンドルを保持する", () => {
    const { conv, feed } = makeConv();
    feed({ sessionResumptionUpdate: { resumable: true, newHandle: "h-123" } });
    expect((conv as any).handle).toBe("h-123");
    feed({ sessionResumptionUpdate: { resumable: false, newHandle: "" } });
    expect((conv as any).handle).toBe("h-123"); // resumable=false では上書きしない
  });
});
