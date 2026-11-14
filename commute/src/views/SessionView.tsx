import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { APP_CUES, LiveConversation, type LiveState } from "../lib/liveClient";
import { MicCapture, micGateEnabled } from "../lib/audio/mic";
import { describeLiveError } from "../lib/liveErrors";
import { PcmPlayer } from "../lib/audio/playback";
import { jstDatePlusDays, jstToday } from "../../shared/leitner";
import { weekdayStreak } from "../../shared/streak";
import { teacherDisplay, teachersForDate } from "../../shared/teachers";
import { focusForDate } from "../../shared/curriculum";

type Phase = "idle" | "starting" | "live" | "ending" | "done" | "error";

/** 続ける気になる数字（すべて実データから計算。推定値は出さない） */
function StatsBar({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<{ streak: number; total: number; words: number } | null>(
    null,
  );
  useEffect(() => {
    (async () => {
      const ses = await supabase
        .from("sessions")
        .select("started_at")
        .order("started_at", { ascending: false })
        .limit(200);
      const rows = ses.data ?? [];
      if (rows.length === 0) {
        setStats(null);
        return;
      }
      const days = new Set(rows.map((r) => jstToday(new Date(r.started_at))));
      const met = await supabase.from("session_metrics").select("user_words");
      const words = (met.data ?? []).reduce(
        (a: number, m: { user_words: number | null }) => a + (m.user_words ?? 0),
        0,
      );
      // 当直などの登録済み休養日はストリークを途切れさせない
      const rest = await supabase.from("rest_days").select("date").limit(200);
      const restDays = (rest.data ?? []).map((r: { date: string }) => r.date);
      setStats({ streak: weekdayStreak(days, jstToday(), restDays), total: rows.length, words });
    })();
  }, [refreshKey]);
  if (!stats) return null;
  return (
    <p className="statsbar">
      🔥 平日連続 <b>{stats.streak}</b> 日 ・ 通算 <b>{stats.total}</b> 回 ・ 英語で{" "}
      <b>{stats.words.toLocaleString()}</b> 語
    </p>
  );
}

interface EndResult {
  analyzed: boolean;
  summary?: string | null;
  metrics?: { user_words: number; ai_words: number; user_turns: number; duration_sec: number | null };
  errors_saved?: number;
  new_cards?: number;
  cards_updated?: number;
  reason?: string;
}

const WRAPUP_NOTE_AT_SEC = 25 * 60;

export default function SessionView({
  onActiveChange,
}: {
  onActiveChange: (active: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveState, setLiveState] = useState<LiveState>("closed");
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<EndResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [briefingTitle, setBriefingTitle] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<string | null>(null);
  const [restMsg, setRestMsg] = useState<string | null>(null);
  const [statsKey, setStatsKey] = useState(0);
  const [mode, setMode] = useState<"morning" | "listen">("morning");

  const conv = useRef<LiveConversation | null>(null);
  const mic = useRef<MicCapture | null>(null);
  const player = useRef<PcmPlayer | null>(null);
  const sessionId = useRef<string | null>(null);
  const queue = useRef<{ seq: number; speaker: string; text: string }[]>([]);
  const sending = useRef(false);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const timerIv = useRef<number | null>(null);
  const noteSent = useRef(false);
  const endingRef = useRef(false);
  /** 直近のGeminiエラー原文（終了画面で原因として出す） */
  const lastErrRef = useRef<string | null>(null);

  // 今日のブリーフィングのタイトル（小さく表示：仕様書5）
  useEffect(() => {
    supabase
      .from("briefings")
      .select("stories")
      .eq("date", jstToday())
      .maybeSingle()
      .then(({ data }) => {
        const t = data?.stories?.[0]?.title;
        if (t) setBriefingTitle(t);
      });
  }, []);

  useEffect(() => {
    onActiveChange(phase === "starting" || phase === "live" || phase === "ending");
  }, [phase, onActiveChange]);

  // 画面復帰時に Wake Lock を取り直す
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && (phase === "live" || phase === "starting")) {
        void acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  });

  async function acquireWakeLock() {
    try {
      wakeLock.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      /* 非対応でも続行（実機確認項目） */
    }
  }

  function pushTurn(t: { seq: number; speaker: string; text: string }) {
    queue.current.push(t);
    void flushQueue();
  }

  async function flushQueue(retry = 0): Promise<void> {
    if (sending.current || !sessionId.current || queue.current.length === 0) return;
    sending.current = true;
    const batch = queue.current.splice(0, queue.current.length);
    try {
      await api.turns(sessionId.current, batch);
    } catch {
      queue.current.unshift(...batch); // 失敗分は戻して後で再送（切断に備え都度送る：仕様書3）
      if (retry < 100) {
        window.setTimeout(() => {
          sending.current = false;
          void flushQueue(retry + 1);
        }, 5000);
        return;
      }
    }
    sending.current = false;
    if (queue.current.length > 0) void flushQueue(retry);
  }

  async function start(startMode: "morning" | "listen" = "morning") {
    setErr(null);
    lastErrRef.current = null;
    setMode(startMode);
    setPhase("starting");
    try {
      // ユーザー操作直後に音声再生を解禁（iOS）
      player.current = new PcmPlayer();
      await player.current.unlock();
      await acquireWakeLock();

      const s = await api.start(startMode);
      sessionId.current = s.session_id;
      if (s.briefing_title) setBriefingTitle(s.briefing_title);
      setTeacher(s.teacher?.display ?? null);

      conv.current = new LiveConversation(
        s.token,
        s.model,
        s.system_instruction,
        player.current,
        {
          onState: (st) => {
            setLiveState(st);
            if (st === "live") setPhase("live");
            if (st === "closed" && !endingRef.current) {
              // 意図しない完全切断 → 記録を守るため終了処理へ
              void end(true);
            }
          },
          onCaption: (t) => setCaption(t),
          onTurn: (t) => pushTurn(t),
          onAutoFinish: () => void end(),
          onError: (m) => {
            lastErrRef.current = m;
            setErr(describeLiveError(m));
          },
        },
        s.teacher?.voice ?? null,
        { autoContinue: startMode === "listen" },
      );
      await conv.current.connect();

      // 接続に失敗して既に終了処理へ進んでいる場合は、マイクを起動しない
      // （以前は終了後にマイクが起動し、続く promptNow が null 参照で落ちていた）
      if (endingRef.current || !conv.current || conv.current.currentState !== "live") return;

      mic.current = new MicCapture();
      await mic.current.start((b64) => conv.current?.sendAudioChunk(b64), {
        gate: micGateEnabled(),
        onStreamEnd: () => conv.current?.sendAudioStreamEnd(),
      });

      // 先生から話し始める（走行中は画面に触れない前提。黙って待たせない）
      conv.current.promptNow(
        startMode === "listen" ? APP_CUES.listenStart : APP_CUES.morningStart,
      );

      const startedAt = Date.now();
      timerIv.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(sec);
        setSpeaking(player.current?.speaking ?? false);
        // 聞き流しモードは終了時刻が決まっていない（Finishで終える）ため残り時間の注記はしない
        if (startMode === "morning" && sec >= WRAPUP_NOTE_AT_SEC && !noteSent.current) {
          noteSent.current = true;
          conv.current?.sendAppNote(
            "25 minutes have passed. Start moving toward the wrap-up soon.",
          );
        }
      }, 500);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
      cleanup();
      setPhase("error");
    }
  }

  function cleanup() {
    if (timerIv.current) {
      clearInterval(timerIv.current);
      timerIv.current = null;
    }
    const ratio = mic.current?.sentRatio;
    if (ratio != null) {
      // 費用対策の効果確認用（実測値。保存はしない）
      console.info(`[mic] 送信した音声の割合: ${(ratio * 100).toFixed(1)}%`);
    }
    mic.current?.stop();
    mic.current = null;
    conv.current?.close();
    conv.current = null;
    player.current?.close();
    player.current = null;
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
    noteSent.current = false;
  }

  async function end(fromDisconnect = false) {
    if (endingRef.current) return;
    endingRef.current = true;
    setPhase("ending");
    // cleanup で conv が消える前に、切断の本当の原因を取っておく
    const cause = describeLiveError(conv.current?.lastError ?? lastErrRef.current);
    cleanup();
    try {
      // 未送信ターンを最後まで送る（最大3回試行）
      for (let i = 0; i < 3 && queue.current.length > 0; i++) {
        sending.current = false;
        await flushQueue(999); // 999: 内部の自動リトライを使わず即戻す
        if (queue.current.length > 0) await new Promise((r) => setTimeout(r, 2000));
      }
      if (!sessionId.current) throw new Error("no session");
      const r = await api.end(sessionId.current);
      setResult(r);
      setPhase("done");
      if (fromDisconnect) {
        setErr(
          "接続が切断されたため終了しました。記録は保存されています。" +
            (cause ? `\n原因: ${cause}` : ""),
        );
      }
    } catch (e) {
      // 会話記録はセッション中に逐次保存済み。解析の失敗/タイムアウトでは固めず、
      // 完了画面に進めて「記録は保存された」ことを伝える。
      const msg = e instanceof Error ? e.message : String(e);
      setResult({ analyzed: false, reason: msg === "timeout" ? "client_timeout" : "end_error" });
      setPhase("done");
    } finally {
      endingRef.current = false;
      sessionId.current = null;
    }
  }

  /** 当直日の登録（0=今日, 1=昨日）。登録した日はストリークを途切れさせない */
  async function registerRestDay(daysAgo: number) {
    const date = jstDatePlusDays(-daysAgo);
    const label = daysAgo === 0 ? "今日" : "昨日";
    const { error } = await supabase
      .from("rest_days")
      .upsert({ date, reason: "当直" }, { onConflict: "user_id,date", ignoreDuplicates: true });
    if (error) {
      setRestMsg(`登録に失敗しました: ${error.message}`);
    } else {
      setRestMsg(`${label}（${date}）を当直として登録しました。ストリークは維持されます。`);
      setStatsKey((k) => k + 1);
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  if (phase === "idle" || phase === "error") {
    const todays = teachersForDate(jstToday());
    const focus = focusForDate(jstToday());
    return (
      <div className="session idle">
        <h1 className="apptitle">🚗 通勤英会話</h1>
        <StatsBar refreshKey={statsKey} />
        <p className="teacherline">
          今日の担当: <b>{teacherDisplay(todays)}</b>
          <br />
          <span className="dim">
            {todays.teachers.map((t) => t.label).join(" / ")}
            {todays.kind === "panel" && " ・ 金曜パネル（2人の掛け合い）"}
          </span>
          <br />
          今日のメニュー: <b>{focus.emoji} {focus.labelJa}</b>
        </p>
        {briefingTitle && <p className="brieftitle">今日のニュース: {briefingTitle}</p>}
        {!briefingTitle && <p className="brieftitle dim">今日のブリーフィングは未生成です</p>}
        <button className="bigstart" onClick={() => void start("morning")}>
          ▶ Start
          <small>出発前に1回タップ。走行中は画面に触れない</small>
        </button>
        <button className="listenbtn" onClick={() => void start("listen")}>
          🎧 聞き流しモード
          <small>病院間の移動・帯同などの長距離用。話さなくてOK、Finishで終了</small>
        </button>
        {err && <p className="err">{err}</p>}
        <p className="note">
          音声コマンド: <b>Wait</b>（沈黙）/ <b>Go</b>（再開）/ <b>Repeat</b> / <b>Slower</b> /{" "}
          <b>Finish</b>（まとめて終了）
        </p>
        <div className="restbox">
          <span>当直でお休みした日は登録すればストリークが途切れません</span>
          <div className="btns">
            <button className="btn ghost" onClick={() => void registerRestDay(1)}>
              昨日は当直だった
            </button>
            <button className="btn ghost" onClick={() => void registerRestDay(0)}>
              今日は当直
            </button>
          </div>
          {restMsg && <p className="restmsg">{restMsg}</p>}
        </div>
      </div>
    );
  }

  if (phase === "starting") {
    return (
      <div className="session center">
        <div className="statusbig">接続中…</div>
        <p className="dim">マイクの許可を求められたら許可してください</p>
      </div>
    );
  }

  if (phase === "ending") {
    return (
      <div className="session center">
        <div className="statusbig">保存・解析中…</div>
      </div>
    );
  }

  if (phase === "done") {
    const m = result?.metrics;
    return (
      <div className="session done">
        <h2>📝 セッション完了</h2>
        {teacher && <p className="teacherline small">担当: {teacher}</p>}
        <StatsBar refreshKey={1} />
        {result?.summary && <p className="summary">{result.summary}</p>}
        {m && (
          <p className="metrics">
            あなた {m.user_words} 語 / {m.user_turns} ターン ・ AI {m.ai_words} 語 ・{" "}
            {m.duration_sec != null ? `${Math.round(m.duration_sec / 60)} 分` : "-"}
          </p>
        )}
        {result?.analyzed ? (
          <p className="metrics">
            指摘 {result.errors_saved ?? 0} 件 ・ 新カード {result.new_cards ?? 0} 枚 ・ 復習更新{" "}
            {result.cards_updated ?? 0} 枚
          </p>
        ) : result?.reason === "no user turns" ? (
          <p className="dim">発話がなかったため解析をスキップしました</p>
        ) : (
          <p className="dim">会話の記録は保存されました。今回の解析は後ほど行われます。</p>
        )}
        {err && <p className="err">{err}</p>}
        <button
          className="btn primary"
          onClick={() => {
            setResult(null);
            setErr(null);
            setElapsed(0);
            setPhase("idle");
          }}
        >
          ホームへ
        </button>
      </div>
    );
  }

  // phase === "live"
  const statusText =
    liveState === "reconnecting"
      ? "再接続中…"
      : speaking
        ? "話しています"
        : "聞いています";
  return (
    <div className="session live">
      <div className="elapsed">{mm}:{ss}</div>
      {teacher && (
        <div className="teacherline small">
          {mode === "listen" ? "🎧 聞き流し ・ " : ""}
          {teacher}
        </div>
      )}
      <div className={"statusbig " + (liveState === "reconnecting" ? "warn" : speaking ? "speak" : "listen")}>
        {statusText}
      </div>
      <p className="caption">{caption}</p>
      <button className="bigend" onClick={() => void end()}>
        ■ End
      </button>
      {err && <p className="err small">{err}</p>}
    </div>
  );
}
