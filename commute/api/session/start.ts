import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminClient, methodGuard, requireUser } from "../_lib/supabase";
import { createEphemeralToken } from "../_lib/gemini";
import {
  buildListenSystemInstruction,
  buildSystemInstruction,
  buildTeacherBlock,
  PROFILE_DEFAULTS,
} from "../_lib/prompts";
import { ENV } from "../_lib/env";
import { jstToday } from "../../shared/leitner";
import { weekdayStreak } from "../../shared/streak";
import { teacherDisplay, teacherKey, teachersForDate } from "../../shared/teachers";
import { focusForDate } from "../../shared/curriculum";

/**
 * POST /api/session/start
 * ログイン確認 → システム指示の組み立て → エフェメラルトークン発行 → セッション行作成
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;
  const user = await requireUser(req, res);
  if (!user) return;

  // "morning" = 通常の会話レッスン / "listen" = 聞き流しモード（病院間移動・帯同などの長距離用）
  const mode: "morning" | "listen" =
    (req.body as { mode?: string } | undefined)?.mode === "listen" ? "listen" : "morning";

  const db = adminClient();
  try {
    // profile（無ければ既定値で作成）
    let { data: profile } = await db
      .from("profile")
      .select("level_note, goals, specialty_topics, preferences")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) {
      const ins = await db
        .from("profile")
        .insert({ user_id: user.id, ...PROFILE_DEFAULTS })
        .select("level_note, goals, specialty_topics, preferences")
        .single();
      if (ins.error) throw ins.error;
      profile = ins.data;
    }

    const today = jstToday();

    const [lastSession, weaknesses, dueCards, briefingRow, pastSessions, restRows] = await Promise.all([
      db
        .from("sessions")
        .select("summary")
        .eq("user_id", user.id)
        .eq("status", "analyzed")
        .not("summary", "is", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("weaknesses")
        .select("category, pattern, example_said, example_better, count")
        .eq("user_id", user.id)
        .order("count", { ascending: false })
        .order("last_seen", { ascending: false })
        .limit(5),
      db
        .from("cards")
        .select("id, front_ja, back_en, box")
        .eq("user_id", user.id)
        .lte("due_date", today)
        .order("due_date", { ascending: true })
        .limit(8),
      db
        .from("briefings")
        .select("id, stories, vocab, questions")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      db
        .from("sessions")
        .select("started_at")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(200),
      db
        .from("rest_days")
        .select("date")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(200),
    ]);

    if (weaknesses.error) throw weaknesses.error;
    if (dueCards.error) throw dueCards.error;

    // ストリークと通算回数（実データから計算。今から作るセッションで今日は実施扱い）
    const sessionDays = new Set<string>(
      (pastSessions.data ?? []).map((s) => jstToday(new Date(s.started_at))),
    );
    const totalSessions = (pastSessions.data ?? []).length + 1;
    sessionDays.add(today);
    const restDays = (restRows.data ?? []).map((r) => r.date);
    const streak = weekdayStreak(sessionDays, today, restDays);

    const briefing = briefingRow.data ?? null;

    const prefs = (profile.preferences ?? {}) as Record<string, unknown>;
    const interests = typeof prefs.interests === "string" ? prefs.interests : null;

    // 今日の教師（曜日ローテ。金曜は2人パネル）
    const assignment = teachersForDate(today);

    const materials = {
      teacherBlock: buildTeacherBlock(assignment),
      focusBlock: focusForDate(today).promptBlock,
      profileText: [
        profile.level_note && `Level: ${profile.level_note}`,
        profile.goals && `Goal: ${profile.goals}`,
        profile.specialty_topics && `Specialty topics: ${profile.specialty_topics}`,
        interests && `Personal interests: ${interests}`,
      ]
        .filter(Boolean)
        .join("\n"),
      lastSummary: lastSession.data?.summary ?? null,
      topWeaknesses: weaknesses.data ?? [],
      dueCards: dueCards.data ?? [],
      briefing: briefing
        ? { stories: briefing.stories, vocab: briefing.vocab, questions: briefing.questions }
        : null,
      stats: { totalSessions, weekdayStreak: streak },
    };
    const systemInstruction =
      mode === "listen"
        ? buildListenSystemInstruction(materials)
        : buildSystemInstruction(materials);

    // セッション行を作成（active）
    const ses = await db
      .from("sessions")
      .insert({
        user_id: user.id,
        type: mode,
        briefing_id: briefing?.id ?? null,
        status: "active",
        started_at: new Date().toISOString(),
        teacher: teacherKey(assignment),
      })
      .select("id")
      .single();
    if (ses.error) throw ses.error;

    // エフェメラルトークン（uses:1 / モデル固定）
    // 聞き流しはサッカー帯同（片道2時間）まで持つよう150分。通常は45分（仕様書3）
    const token = await createEphemeralToken(ENV.LIVE_MODEL, mode === "listen" ? 150 : 45);

    res.status(200).json({
      session_id: ses.data.id,
      token,
      model: ENV.LIVE_MODEL,
      system_instruction: systemInstruction,
      briefing_title: briefing?.stories?.[0]?.title ?? null,
      due_cards: dueCards.data ?? [],
      teacher: {
        key: teacherKey(assignment),
        display: teacherDisplay(assignment),
        labels: assignment.teachers.map((t) => t.label),
        kind: assignment.kind,
        // パネル日は進行役（1人目）の声を使う
        voice: assignment.teachers[0].voice,
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
  }
}
