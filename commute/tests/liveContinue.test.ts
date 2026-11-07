import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_CUES, LiveConversation } from "../src/lib/liveClient";
import type { PcmPlayer } from "../src/lib/audio/playback";

// 聞き流しモードの自動継続。Live API はターン制で、AIは入力が無いと黙って待つため、
// アプリが無音を見張って次のコーナーを促す。tick() を手動で進めて検証する。

const BASE = 1_000_000;
const at = (ms: number) => vi.setSystemTime(BASE + ms);

function makeConv(autoContinue: boolean) {
  const player = {
    playing: false,
    clear() {},
    enqueue() {},
    chime() {},
    get speaking() {
      return this.playing;
    },
  };
  const session = { sendClientContent: vi.fn(), sendRealtimeInput: vi.fn(), close: vi.fn() };
  const conv = new LiveConversation(
    "tok",
    "model",
    "sys",
    player as unknown as PcmPlayer,
    { onState: () => {}, onCaption: () => {}, onTurn: () => {}, onAutoFinish: () => {}, onError: () => {} },
    null,
    { autoContinue },
  );
  // connect() を経由せず、接続済みの状態を作る
  (conv as any).session = session;
  (conv as any).state = "live";
  const feed = (m: unknown) => (conv as any).onMessage(m);
  const tick = () => (conv as any).tick();
  const sentTexts = () =>
    session.sendClientContent.mock.calls.map((c) => c[0].turns[0].parts[0].text as string);
  /** AIが1コーナー話し終えた状態にする */
  const aiSegmentDone = () => {
    feed({ serverContent: { outputTranscription: { text: "That was today's first story." } } });
    feed({ serverContent: { turnComplete: true } });
  };
  return { conv, player, session, feed, tick, sentTexts, aiSegmentDone };
}

beforeEach(() => {
  vi.useFakeTimers();
  at(0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("聞き流しモードの自動継続", () => {
  it("AIが話し終え、無音が続くと次のコーナーを促す", () => {
    const { session, tick, sentTexts, aiSegmentDone } = makeConv(true);
    aiSegmentDone();
    at(0);
    tick();
    expect(session.sendClientContent).not.toHaveBeenCalled(); // 無音になった直後はまだ
    at(1300);
    tick();
    expect(session.sendClientContent).toHaveBeenCalledTimes(1);
    expect(sentTexts()[0]).toBe(`[app note: ${APP_CUES.listenContinue}]`);
    // テキストの1ターンとして送り、AIの生成を開始させる
    const arg = session.sendClientContent.mock.calls[0][0];
    expect(arg.turnComplete).toBe(true);
    expect(arg.turns[0].role).toBe("user");
  });

  it("まだAIが一度も話していなければ、番組開始の合図を送る", () => {
    const { tick, sentTexts } = makeConv(true);
    tick();
    at(1300);
    tick();
    expect(sentTexts()).toEqual([`[app note: ${APP_CUES.listenStart}]`]);
  });

  it("AIの音声を再生している間は促さない", () => {
    const { player, session, tick, aiSegmentDone } = makeConv(true);
    player.playing = true; // 生成は終わったが、まだ音声が流れている
    aiSegmentDone();
    for (const t of [0, 2000, 5000]) {
      at(t);
      tick();
    }
    expect(session.sendClientContent).not.toHaveBeenCalled();
    player.playing = false; // 再生が終わった
    at(5000);
    tick();
    at(6300);
    tick();
    expect(session.sendClientContent).toHaveBeenCalledTimes(1);
  });

  it("ユーザーが話しかけたら、AIの返答を待って促さない（返答が無ければ後で再開）", () => {
    const { session, feed, tick, aiSegmentDone } = makeConv(true);
    aiSegmentDone();
    at(0);
    feed({ serverContent: { inputTranscription: { text: "Hmm, what about the yen?" } } });
    at(1300);
    tick();
    expect(session.sendClientContent).not.toHaveBeenCalled();
    // 雑音などでAIが返答しなかった場合は、少し待ってから番組を再開する
    at(5100);
    tick();
    at(6400);
    tick();
    expect(session.sendClientContent).toHaveBeenCalledTimes(1);
  });

  it("Wait で一時停止し、Go で再開する", () => {
    const { session, feed, tick, aiSegmentDone } = makeConv(true);
    aiSegmentDone();
    feed({ serverContent: { inputTranscription: { text: "Wait." } } });
    for (const t of [6000, 8000, 20000]) {
      at(t);
      tick();
    }
    expect(session.sendClientContent).not.toHaveBeenCalled();
    at(20000);
    feed({ serverContent: { inputTranscription: { text: " Go." } } });
    at(25100);
    tick();
    at(26400);
    tick();
    expect(session.sendClientContent).toHaveBeenCalledTimes(1);
  });

  it("「Wait, what?」のような質問は一時停止にしない", () => {
    const { session, feed, tick } = makeConv(true);
    feed({ serverContent: { inputTranscription: { text: "Wait, what?" } } });
    feed({ serverContent: { outputTranscription: { text: "I said the yen weakened." } } });
    feed({ serverContent: { turnComplete: true } });
    at(5100);
    tick();
    at(6400);
    tick();
    expect(session.sendClientContent).toHaveBeenCalledTimes(1);
  });

  it("促した後は、返答が来るまで重ねて促さない（15秒で再試行）", () => {
    const { session, tick, aiSegmentDone } = makeConv(true);
    aiSegmentDone();
    at(0);
    tick();
    at(1300);
    tick();
    for (const t of [3000, 8000, 14000]) {
      at(t);
      tick();
    }
    expect(session.sendClientContent).toHaveBeenCalledTimes(1);
    at(16500);
    tick();
    at(17800);
    tick();
    expect(session.sendClientContent).toHaveBeenCalledTimes(2);
  });

  it("通常レッスン（autoContinue なし）では促さない", () => {
    const { session, tick, aiSegmentDone } = makeConv(false);
    aiSegmentDone();
    for (const t of [0, 1300, 10000, 30000]) {
      at(t);
      tick();
    }
    expect(session.sendClientContent).not.toHaveBeenCalled();
  });

  it("終了(close)後は促さない", () => {
    const { conv, session, tick, aiSegmentDone } = makeConv(true);
    aiSegmentDone();
    conv.close();
    for (const t of [0, 1300, 10000]) {
      at(t);
      tick();
    }
    expect(session.sendClientContent).not.toHaveBeenCalled();
  });
});
