// Gemini Live API クライアント（仕様書6）
// - エフェメラルトークンで直接WebSocket接続（v1alpha）
// - inputAudioTranscription / outputAudioTranscription 有効
// - contextWindowCompression: slidingWindow
// - sessionResumption: ハンドルを保持し、goAway/切断時に自動再接続

import { GoogleGenAI, Modality } from "@google/genai";
import type { LiveServerMessage, Session } from "@google/genai";
import { PcmPlayer } from "./audio/playback";
import { MIC_MIME } from "./audio/mic";
import { closeEventMessage } from "./liveErrors";

export type LiveState = "connecting" | "live" | "reconnecting" | "closed";

export interface LiveCallbacksApp {
  onState: (s: LiveState) => void;
  /** 進行中の聞き取り字幕（interim） */
  onCaption: (text: string) => void;
  /** 確定したターン（保存用） */
  onTurn: (turn: { seq: number; speaker: "user" | "ai"; text: string }) => void;
  /** ユーザーが "Finish" と言い、AIのまとめが終わったとき */
  onAutoFinish: () => void;
  onError: (message: string) => void;
}

const MAX_RECONNECTS = 4;

/** 聞き流しモード: AIの発話が終わり無音がこの時間続いたら、次のコーナーを促す */
const CONTINUE_GAP_MS = 1200;
/** ユーザーが話した直後はこの時間は促さない（AIの返答を待つ） */
const USER_GRACE_MS = 5000;
/** 促した後、返答が来ないまま待つ上限（過ぎたら再度促せる） */
const NUDGE_TIMEOUT_MS = 15000;

/** 「Wait」だけの発話（一時停止）。"Wait, what?" のような質問は含めない */
const WAIT_ONLY_RE =
  /^\W*(?:ok(?:ay)?\W+)?(?:wait|hold on)(?:\W+(?:a\W+)?(?:sec(?:ond)?|minute|moment))?\W*$/i;
const RESUME_RE = /\b(?:go|continue|carry on|resume)\b/i;

/**
 * アプリからAIへの合図。Live API はターン制で、AIは入力が無いと黙って待つため、
 * 最初の一声と聞き流しの継続はアプリが促す。[app note] は読み上げないようシステム指示済み。
 */
export const APP_CUES = {
  morningStart: "The session has started and Kohei is ready. Greet him now and begin.",
  listenStart:
    "The listening program starts now. Give a one-line greeting, then go straight into your first segment.",
  listenContinue:
    "Continue the program: go straight into the next segment. Do not greet again and do not wait for an answer.",
};

export interface LiveOptions {
  /** 聞き流しモード: AIが話し終えて無音が続いたら自動で次を促す */
  autoContinue?: boolean;
}

export class LiveConversation {
  private session: Session | null = null;
  private state: LiveState = "connecting";
  private handle: string | null = null;
  private intentionalClose = false;
  private reconnects = 0;
  private seq = 0;
  private inputBuf = "";
  private outputBuf = "";
  private finishPending = false;
  private triedVoiceFallback = false;
  // 聞き流しモードの自動継続用の状態
  private paused = false;
  private modelTurnOpen = false;
  private modelSpokeOnce = false;
  private awaitingModel = false;
  private nudgedAt = 0;
  private quietSince = 0;
  private lastUserSpeechAt = 0;
  private tickIv: ReturnType<typeof setInterval> | null = null;
  /** 直近のエラー（接続失敗・切断理由）。終了画面で原因を出すために保持する */
  private lastErrorMsg: string | null = null;

  constructor(
    private tokenName: string,
    private model: string,
    private systemInstruction: string,
    private player: PcmPlayer,
    private cb: LiveCallbacksApp,
    /** 教師ごとのプリセットボイス名（無効だった場合は自動で標準音声に落とす） */
    private voiceName: string | null = null,
    private opts: LiveOptions = {},
  ) {}

  get currentState(): LiveState {
    return this.state;
  }

  get lastError(): string | null {
    return this.lastErrorMsg;
  }

  private reportError(message: string): void {
    this.lastErrorMsg = message;
    this.cb.onError(message);
  }

  private setState(s: LiveState) {
    this.state = s;
    this.cb.onState(s);
  }

  async connect(): Promise<void> {
    this.setState(this.reconnects > 0 ? "reconnecting" : "connecting");
    const ai = new GoogleGenAI({
      apiKey: this.tokenName, // エフェメラルトークン（token.name）をAPIキーとして使う
      httpOptions: { apiVersion: "v1alpha" }, // ephemeral token は v1alpha のみ
    });
    try {
      this.session = await ai.live.connect({
        model: this.model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: this.systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: { slidingWindow: {} },
          sessionResumption: this.handle ? { handle: this.handle } : {},
          ...(this.voiceName
            ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voiceName } } } }
            : {}),
        },
        callbacks: {
          onmessage: (m: LiveServerMessage) => this.onMessage(m),
          onerror: (e: ErrorEvent) => {
            this.reportError(e.message || "connection error");
          },
          onclose: (e: CloseEvent) => this.onClose(e),
        },
      });
      this.reconnects = 0;
      // 再接続で途中のターンが途切れていても、自動継続が止まったままにならないようにする
      this.modelTurnOpen = false;
      this.awaitingModel = false;
      this.setState("live");
      if (this.opts.autoContinue && !this.tickIv) {
        this.tickIv = setInterval(() => this.tick(), 500);
      }
    } catch (e) {
      // プリセットボイス名が原因で接続できない場合は、標準音声で一度だけ再試行
      if (this.voiceName && !this.triedVoiceFallback) {
        this.triedVoiceFallback = true;
        this.voiceName = null;
        await this.connect();
        return;
      }
      this.reportError(String(e instanceof Error ? e.message : e));
      await this.tryReconnect();
    }
  }

  private onClose(e?: { code?: number; reason?: string }): void {
    this.session = null;
    if (this.intentionalClose) {
      this.setState("closed");
      return;
    }
    // 切断理由（例: クレジット枯渇・クォータ）を捨てずに記録する
    const why = closeEventMessage(e);
    if (why) this.reportError(why);
    void this.tryReconnect();
  }

  private async tryReconnect(): Promise<void> {
    if (this.intentionalClose) return;
    if (this.reconnects >= MAX_RECONNECTS) {
      // 上限到達の文言で本当の原因を上書きしない（lastError は直前の原因のまま）
      const cause = this.lastErrorMsg;
      this.cb.onError(
        cause ? `再接続に失敗しました（上限到達）。原因: ${cause}` : "再接続に失敗しました（上限到達）",
      );
      this.setState("closed");
      return;
    }
    this.reconnects += 1;
    this.setState("reconnecting");
    this.player.chime(); // 画面操作を求めず、効果音のみ（仕様書6）
    const delay = 500 * Math.pow(2, this.reconnects - 1); // 0.5/1/2/4秒
    await new Promise((r) => setTimeout(r, delay));
    await this.connect();
  }

  private onMessage(m: LiveServerMessage): void {
    // 再開ハンドルの更新
    if (m.sessionResumptionUpdate?.resumable && m.sessionResumptionUpdate.newHandle) {
      this.handle = m.sessionResumptionUpdate.newHandle;
    }
    // サーバー側から切断予告 → 先回りして再接続
    if (m.goAway) {
      try {
        this.session?.close();
      } catch {
        /* noop */
      }
      return; // onclose → tryReconnect
    }

    const sc = m.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      // 割り込み: 再生キューを即クリア、途中までのAI発話は確定して保存
      this.player.clear();
      this.flushAi();
      this.modelTurnOpen = false;
      return;
    }

    if (sc.interimInputTranscription?.text) {
      this.cb.onCaption(sc.interimInputTranscription.text);
      this.lastUserSpeechAt = Date.now();
    }
    if (sc.inputTranscription?.text) {
      this.inputBuf += sc.inputTranscription.text;
      this.cb.onCaption(this.inputBuf);
      this.lastUserSpeechAt = Date.now();
      this.updatePause(this.inputBuf);
    }
    if (sc.outputTranscription?.text) {
      this.outputBuf += sc.outputTranscription.text;
      this.noteModelActivity();
    }

    const parts = sc.modelTurn?.parts ?? [];
    for (const p of parts) {
      const data = p.inlineData?.data;
      if (typeof data === "string" && data.length > 0) {
        this.player.enqueue(data);
        this.noteModelActivity();
      }
    }

    if (sc.turnComplete) {
      this.modelTurnOpen = false;
      this.flushUser();
      const aiFlushed = this.flushAi();
      if (this.finishPending && aiFlushed) {
        // "Finish" の後、AIのまとめターンが完了した → 自動終了
        this.finishPending = false;
        this.cb.onAutoFinish();
      }
    }
  }

  private flushUser(): void {
    const text = this.inputBuf.trim();
    this.inputBuf = "";
    if (!text) return;
    this.seq += 1;
    this.cb.onTurn({ seq: this.seq, speaker: "user", text });
    // 音声コマンド "Finish"（短い発話に限定して誤発火を防ぐ）
    if (text.length <= 40 && /\bfinish\b/i.test(text)) {
      this.finishPending = true;
    }
    // 「Wait」だけの発話でない限り、話しかけた時点で一時停止は解除
    if (!WAIT_ONLY_RE.test(text)) this.paused = false;
  }

  private noteModelActivity(): void {
    this.modelTurnOpen = true;
    this.modelSpokeOnce = true;
    this.awaitingModel = false;
  }

  /** "Wait" で一時停止、"Go" で再開（聞き流しモードの自動継続を止める/戻す） */
  private updatePause(text: string): void {
    const t = text.trim();
    if (WAIT_ONLY_RE.test(t)) this.paused = true;
    else if (t.length <= 30 && RESUME_RE.test(t)) this.paused = false;
  }

  /**
   * 聞き流しモードの自動継続。AIの発話と再生が終わり、ユーザーも話していない
   * 無音が続いたら、次のコーナーを促す。
   */
  private tick(): void {
    if (!this.opts.autoContinue || this.state !== "live" || !this.session) return;
    if (this.paused || this.finishPending) return;
    const now = Date.now();
    if (this.player.speaking || this.modelTurnOpen) {
      this.quietSince = 0;
      return;
    }
    if (this.awaitingModel && now - this.nudgedAt < NUDGE_TIMEOUT_MS) return;
    if (now - this.lastUserSpeechAt < USER_GRACE_MS) {
      this.quietSince = 0;
      return;
    }
    if (this.quietSince === 0) {
      this.quietSince = now;
      return;
    }
    if (now - this.quietSince < CONTINUE_GAP_MS) return;
    this.promptNow(this.modelSpokeOnce ? APP_CUES.listenContinue : APP_CUES.listenStart);
  }

  /**
   * テキストの1ターンを送り、AIに話し始めさせる（最初の一声・聞き流しの継続）。
   * ユーザーの発話ではないので turns（文字起こし保存）には入らない。
   */
  promptNow(note: string): void {
    if (this.state !== "live" || !this.session) return;
    try {
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: `[app note: ${note}]` }] }],
        turnComplete: true,
      });
      this.awaitingModel = true;
      this.nudgedAt = Date.now();
      this.quietSince = 0;
    } catch {
      /* 接続断の瞬間は捨てる（再接続後に自動継続が再度促す） */
    }
  }

  private flushAi(): boolean {
    const text = this.outputBuf.trim();
    this.outputBuf = "";
    if (!text) return false;
    this.seq += 1;
    this.cb.onTurn({ seq: this.seq, speaker: "ai", text });
    return true;
  }

  sendAudioChunk(base64: string): void {
    if (this.state !== "live" || !this.session) return;
    try {
      this.session.sendRealtimeInput({ audio: { data: base64, mimeType: MIC_MIME } });
    } catch {
      /* 接続断の瞬間は捨てる（再接続後の音声から再開） */
    }
  }

  /**
   * 話し終わってマイク送信を止めたことを伝える（自動の発話区切り検出が既定のため使える）。
   * 次に音声を送れば自動で再開する（SDK: LiveSendRealtimeInputParameters.audioStreamEnd）。
   */
  sendAudioStreamEnd(): void {
    if (this.state !== "live" || !this.session) return;
    try {
      this.session.sendRealtimeInput({ audioStreamEnd: true });
    } catch {
      /* 接続断の瞬間は捨てる */
    }
  }

  /** アプリからの注記（読み上げない指示）。例: 残り時間 */
  sendAppNote(note: string): void {
    if (this.state !== "live" || !this.session) return;
    try {
      this.session.sendRealtimeInput({ text: `[app note: ${note}]` });
    } catch {
      /* noop */
    }
  }

  close(): void {
    this.intentionalClose = true;
    if (this.tickIv) {
      clearInterval(this.tickIv);
      this.tickIv = null;
    }
    // 未確定の発話を確定して取りこぼさない
    this.flushUser();
    this.flushAi();
    try {
      this.session?.close();
    } catch {
      /* noop */
    }
    this.session = null;
    this.setState("closed");
  }
}
