// Gemini Live API クライアント（仕様書6）
// - エフェメラルトークンで直接WebSocket接続（v1alpha）
// - inputAudioTranscription / outputAudioTranscription 有効
// - contextWindowCompression: slidingWindow
// - sessionResumption: ハンドルを保持し、goAway/切断時に自動再接続

import { GoogleGenAI, Modality } from "@google/genai";
import type { LiveServerMessage, Session } from "@google/genai";
import { PcmPlayer } from "./audio/playback";
import { MIC_MIME } from "./audio/mic";

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

  constructor(
    private tokenName: string,
    private model: string,
    private systemInstruction: string,
    private player: PcmPlayer,
    private cb: LiveCallbacksApp,
  ) {}

  get currentState(): LiveState {
    return this.state;
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
        },
        callbacks: {
          onmessage: (m: LiveServerMessage) => this.onMessage(m),
          onerror: (e: ErrorEvent) => {
            this.cb.onError(e.message || "connection error");
          },
          onclose: () => this.onClose(),
        },
      });
      this.reconnects = 0;
      this.setState("live");
    } catch (e) {
      this.cb.onError(String(e instanceof Error ? e.message : e));
      await this.tryReconnect();
    }
  }

  private onClose(): void {
    this.session = null;
    if (this.intentionalClose) {
      this.setState("closed");
      return;
    }
    void this.tryReconnect();
  }

  private async tryReconnect(): Promise<void> {
    if (this.intentionalClose) return;
    if (this.reconnects >= MAX_RECONNECTS) {
      this.setState("closed");
      this.cb.onError("再接続に失敗しました（上限到達）");
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
      return;
    }

    if (sc.interimInputTranscription?.text) {
      this.cb.onCaption(sc.interimInputTranscription.text);
    }
    if (sc.inputTranscription?.text) {
      this.inputBuf += sc.inputTranscription.text;
      this.cb.onCaption(this.inputBuf);
    }
    if (sc.outputTranscription?.text) {
      this.outputBuf += sc.outputTranscription.text;
    }

    const parts = sc.modelTurn?.parts ?? [];
    for (const p of parts) {
      const data = p.inlineData?.data;
      if (typeof data === "string" && data.length > 0) {
        this.player.enqueue(data);
      }
    }

    if (sc.turnComplete) {
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
