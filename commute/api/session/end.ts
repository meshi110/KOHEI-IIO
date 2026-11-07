import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminClient, methodGuard, requireUser } from "../_lib/supabase";
import { runAnalysis } from "../_lib/gemini";
import { buildAnalysisPrompt } from "../_lib/prompts";
import { saidExistsInTurns } from "../../shared/verify";
import { computeMetrics } from "../../shared/metrics";
import { jstToday, nextBox, nextDueDate } from "../../shared/leitner";
import type { AnalysisOutput, Turn } from "../../shared/types";

// 解析(Gemini)が遅くても関数が余裕を持って応答を返せるように上限を伸ばす
export const config = { maxDuration: 30 };

/**
 * POST /api/session/end
 * セッションを終了扱いにし、解析を実行して weaknesses / cards / metrics を更新する。
 * - errors[].said は turns と照合し、実在しない引用は破棄（仕様書9）
 * - session_metrics はコードで計算（AIに計算させない）
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;
  const user = await requireUser(req, res);
  if (!user) return;

  const sessionId: string = (req.body ?? {}).session_id;
  if (!sessionId) {
    res.status(400).json({ error: "session_id is required" });
    return;
  }

  const db = adminClient();
  try {
    const ses = await db
      .from("sessions")
      .select("id, user_id, started_at, status")
      .eq("id", sessionId)
      .single();
    if (ses.error || ses.data.user_id !== user.id) {
      res.status(403).json({ error: "session not found or not yours" });
      return;
    }

    const endedAt = new Date();
    await db
      .from("sessions")
      .update({ ended_at: endedAt.toISOString(), status: "ended" })
      .eq("id", sessionId);

    // turns を取得
    const turnsQ = await db
      .from("turns")
      .select("seq, speaker, text")
      .eq("session_id", sessionId)
      .order("seq", { ascending: true });
    if (turnsQ.error) throw turnsQ.error;
    const turns = (turnsQ.data ?? []) as Turn[];

    // metrics はコードで計算
    const startedAt = ses.data.started_at ? new Date(ses.data.started_at) : null;
    const metrics = computeMetrics(turns, startedAt, endedAt);
    await db.from("session_metrics").upsert(
      { session_id: sessionId, user_id: user.id, ...metrics },
      { onConflict: "session_id" },
    );

    const userTurnCount = turns.filter((t) => t.speaker === "user").length;
    if (userTurnCount === 0) {
      await db.from("sessions").update({ status: "analyzed", summary: null }).eq("id", sessionId);
      res.status(200).json({ analyzed: false, reason: "no user turns", metrics });
      return;
    }

    // 当日出題対象だったカード（解析プロンプトに渡した集合と同じ条件）
    const today = jstToday();
    const dueQ = await db
      .from("cards")
      .select("id, front_ja, back_en, box")
      .eq("user_id", user.id)
      .lte("due_date", today)
      .limit(8);
    if (dueQ.error) throw dueQ.error;
    const dueCards = dueQ.data ?? [];
    const dueIds = new Set(dueCards.map((c) => c.id));

    // 解析
    const transcript = turns
      .map((t) => `${t.speaker === "user" ? "KOHEI" : "COACH"}: ${t.text}`)
      .join("\n");
    let analysis: AnalysisOutput;
    try {
      analysis = await runAnalysis(buildAnalysisPrompt(transcript, dueCards));
    } catch (e) {
      // 解析は失敗しても会話記録とメトリクスは守る。
      // status は "ended"（解析待ち）のままにして、後で再解析できるようにする。
      // 完了画面には必ず進めるよう 200 を返す（仕様書4: 計算できた値は返す）。
      await db.from("sessions").update({ status: "ended", summary: null }).eq("id", sessionId);
      res.status(200).json({
        analyzed: false,
        reason: "analysis_unavailable",
        metrics,
      });
      return;
    }

    // --- errors: said を実発話と照合、通ったものだけ weaknesses に反映 ---
    const validCategories = new Set(["grammar", "vocab", "pronunciation", "fluency", "comprehension"]);
    const verifiedErrors = (analysis.errors ?? []).filter(
      (er) =>
        validCategories.has(er.category) &&
        er.said &&
        er.better &&
        saidExistsInTurns(er.said, turns),
    );
    const droppedErrors = (analysis.errors ?? []).length - verifiedErrors.length;

    for (const er of verifiedErrors) {
      const existing = await db
        .from("weaknesses")
        .select("id, count")
        .eq("user_id", user.id)
        .eq("category", er.category)
        .eq("pattern", er.pattern)
        .maybeSingle();
      if (existing.data) {
        await db
          .from("weaknesses")
          .update({
            count: (existing.data.count ?? 1) + 1,
            example_said: er.said,
            example_better: er.better,
            last_seen: endedAt.toISOString(),
          })
          .eq("id", existing.data.id);
      } else {
        await db.from("weaknesses").insert({
          user_id: user.id,
          category: er.category,
          pattern: er.pattern,
          example_said: er.said,
          example_better: er.better,
          count: 1,
          last_seen: endedAt.toISOString(),
        });
      }
    }

    // --- new_cards: 最大5枚 ---
    const newCards = (analysis.new_cards ?? [])
      .filter((c) => c.front_ja && c.back_en)
      .slice(0, 5)
      .map((c) => ({
        user_id: user.id,
        front_ja: c.front_ja,
        back_en: c.back_en,
        source_session_id: sessionId,
        box: 1,
        due_date: nextDueDate(1),
      }));
    if (newCards.length) {
      const ins = await db.from("cards").insert(newCards);
      if (ins.error) throw ins.error;
    }

    // --- card_results: 実在する当日due のカードIDのみ反映（ライトナー更新） ---
    let cardsUpdated = 0;
    for (const r of analysis.card_results ?? []) {
      if (!dueIds.has(r.card_id)) continue; // 実在しないIDは無視
      const card = dueCards.find((c) => c.id === r.card_id)!;
      const box = nextBox(card.box, r.said_correctly === true);
      await db
        .from("cards")
        .update({ box, due_date: nextDueDate(box) })
        .eq("id", r.card_id)
        .eq("user_id", user.id);
      cardsUpdated++;
    }

    const summary = (analysis.summary ?? "").slice(0, 2000) || null;
    await db
      .from("sessions")
      .update({ status: "analyzed", summary })
      .eq("id", sessionId);

    res.status(200).json({
      analyzed: true,
      summary,
      metrics,
      errors_saved: verifiedErrors.length,
      errors_dropped_unverified: droppedErrors,
      new_cards: newCards.length,
      cards_updated: cardsUpdated,
    });
  } catch (e) {
    await db.from("sessions").update({ status: "failed" }).eq("id", sessionId);
    res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
  }
}
