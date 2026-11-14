import { describe, expect, it, vi } from "vitest";
import { closeEventMessage, describeLiveError } from "../src/lib/liveErrors";
import { LiveConversation } from "../src/lib/liveClient";
import type { PcmPlayer } from "../src/lib/audio/playback";

describe("describeLiveError（原因を画面に出す）", () => {
  it("前払いクレジット枯渇（2026-11-12の実際のエラー文）は入金を案内し、原文も残す", () => {
    const raw =
      "Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.";
    const s = describeLiveError(raw)!;
    expect(s).toContain("クレジット残高がありません");
    expect(s).toContain(raw);
  });

  it("クォータ超過は上限到達と表示", () => {
    expect(describeLiveError("429 RESOURCE_EXHAUSTED: quota exceeded")).toContain("利用上限");
  });

  it("未知のエラーは原文のまま（推測で言い換えない）", () => {
    expect(describeLiveError("socket hang up")).toBe("socket hang up");
  });

  it("空なら null", () => {
    expect(describeLiveError("")).toBeNull();
    expect(describeLiveError(null)).toBeNull();
  });

  it("CloseEvent の理由とコードを文字列にする（理由が空なら null）", () => {
    expect(closeEventMessage({ code: 1011, reason: "Quota exceeded" })).toBe("Quota exceeded (code 1011)");
    expect(closeEventMessage({ code: 1006, reason: "" })).toBeNull();
  });
});

function makeConv() {
  const onError = vi.fn();
  const states: string[] = [];
  const player = { clear() {}, enqueue() {}, chime() {}, get speaking() { return false; } };
  const conv = new LiveConversation("tok", "model", "sys", player as unknown as PcmPlayer, {
    onState: (s) => states.push(s),
    onCaption: () => {},
    onTurn: () => {},
    onAutoFinish: () => {},
    onError,
  });
  const session = { sendClientContent: vi.fn(), sendRealtimeInput: vi.fn(), close: vi.fn() };
  return { conv, onError, states, session };
}

describe("LiveConversation のエラー保持と audioStreamEnd", () => {
  it("切断理由を lastError に残し、onError にも渡す", () => {
    const { conv, onError } = makeConv();
    (conv as any).tryReconnect = vi.fn(); // 再接続は走らせない
    (conv as any).onClose({ code: 1011, reason: "Your prepayment credits are depleted." });
    expect(conv.lastError).toBe("Your prepayment credits are depleted. (code 1011)");
    expect(onError).toHaveBeenCalledWith("Your prepayment credits are depleted. (code 1011)");
  });

  it("再接続の上限に達しても、本当の原因を上書きしない", async () => {
    const { conv, onError, states } = makeConv();
    (conv as any).lastErrorMsg = "Your prepayment credits are depleted.";
    (conv as any).reconnects = 4; // MAX_RECONNECTS
    await (conv as any).tryReconnect();
    expect(states.at(-1)).toBe("closed");
    expect(onError.mock.calls.at(-1)![0]).toContain("Your prepayment credits are depleted.");
    expect(conv.lastError).toBe("Your prepayment credits are depleted.");
  });

  it("接続中は audioStreamEnd を送る", () => {
    const { conv, session } = makeConv();
    (conv as any).session = session;
    (conv as any).state = "live";
    conv.sendAudioStreamEnd();
    expect(session.sendRealtimeInput).toHaveBeenCalledWith({ audioStreamEnd: true });
  });

  it("未接続のときは何も送らない", () => {
    const { conv, session } = makeConv();
    (conv as any).session = session;
    (conv as any).state = "reconnecting";
    conv.sendAudioStreamEnd();
    expect(session.sendRealtimeInput).not.toHaveBeenCalled();
  });
});
