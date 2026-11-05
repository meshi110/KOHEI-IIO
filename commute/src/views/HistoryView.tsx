import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { jstToday } from "../../shared/leitner";
import { TEACHERS } from "../../shared/teachers";

interface SessionRow {
  id: string;
  started_at: string;
  summary: string | null;
  status: string;
  teacher: string | null;
  type: string | null;
}

function teacherNames(key: string | null): string {
  if (!key) return "";
  return key
    .split("+")
    .map((id) => {
      const t = TEACHERS.find((x) => x.id === id);
      return t ? `${t.emoji} ${t.name.split(" ").pop()}` : id;
    })
    .join(" & ");
}
interface MetricRow {
  session_id: string;
  user_words: number | null;
  user_turns: number | null;
  duration_sec: number | null;
}
interface WeaknessRow {
  category: string;
  pattern: string;
  example_said: string | null;
  example_better: string | null;
  count: number;
}
interface CardRow {
  front_ja: string;
  back_en: string;
  box: number;
  due_date: string;
}

export default function HistoryView() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [metrics, setMetrics] = useState<Record<string, MetricRow>>({});
  const [weaknesses, setWeaknesses] = useState<WeaknessRow[]>([]);
  const [dueCards, setDueCards] = useState<CardRow[]>([]);

  useEffect(() => {
    (async () => {
      const ses = await supabase
        .from("sessions")
        .select("id, started_at, summary, status, teacher, type")
        .order("started_at", { ascending: false })
        .limit(14);
      const rows = ses.data ?? [];
      setSessions(rows);
      if (rows.length) {
        const met = await supabase
          .from("session_metrics")
          .select("session_id, user_words, user_turns, duration_sec")
          .in("session_id", rows.map((r) => r.id));
        const map: Record<string, MetricRow> = {};
        for (const m of met.data ?? []) map[m.session_id] = m;
        setMetrics(map);
      }
      const wk = await supabase
        .from("weaknesses")
        .select("category, pattern, example_said, example_better, count")
        .order("count", { ascending: false })
        .limit(10);
      setWeaknesses(wk.data ?? []);
      const cd = await supabase
        .from("cards")
        .select("front_ja, back_en, box, due_date")
        .lte("due_date", jstToday())
        .order("due_date")
        .limit(20);
      setDueCards(cd.data ?? []);
    })();
  }, []);

  return (
    <div className="history">
      <h2>📒 履歴（自宅で見る用）</h2>

      <h3>今日の復習カード（{dueCards.length}）</h3>
      {dueCards.length === 0 && <p className="dim">今日が期限のカードはありません</p>}
      {dueCards.map((c, i) => (
        <div className="card" key={i}>
          <div className="ja">{c.front_ja}</div>
          <div className="en">{c.back_en}</div>
          <div className="meta">box {c.box} ・ 期限 {c.due_date}</div>
        </div>
      ))}

      <h3>弱点トップ</h3>
      {weaknesses.length === 0 && <p className="dim">まだ記録がありません</p>}
      {weaknesses.map((w, i) => (
        <div className="card" key={i}>
          <div className="meta">
            [{w.category}] ×{w.count}
          </div>
          <div className="en">{w.pattern}</div>
          {w.example_said && (
            <div className="ja">
              <s>{w.example_said}</s> → {w.example_better}
            </div>
          )}
        </div>
      ))}

      <h3>セッション</h3>
      {sessions.map((s) => {
        const m = metrics[s.id];
        return (
          <div className="card" key={s.id}>
            <div className="meta">
              {s.type === "listen" ? "🎧 " : ""}
              {new Date(s.started_at).toLocaleString("ja-JP")}
              {s.teacher ? " ・ " + teacherNames(s.teacher) : ""} ・ {s.status}
              {m &&
                ` ・ ${m.user_words ?? "-"}語 / ${m.user_turns ?? "-"}ターン / ${
                  m.duration_sec != null ? Math.round(m.duration_sec / 60) + "分" : "-"
                }`}
            </div>
            <div className="ja">{s.summary ?? "(要約なし)"}</div>
          </div>
        );
      })}
    </div>
  );
}
