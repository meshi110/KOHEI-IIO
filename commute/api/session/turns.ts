import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminClient, methodGuard, requireUser } from "../_lib/supabase";

/**
 * POST /api/session/turns
 * 発話を1ターンずつ（または小さなバッチで）保存する。
 * 途中で接続が切れても記録が残るよう、クライアントはターン確定ごとに送る。
 * リトライに耐えるため (session_id, seq) で upsert。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;
  const user = await requireUser(req, res);
  if (!user) return;

  const body = req.body ?? {};
  const sessionId: string = body.session_id;
  const turns: { seq: number; speaker: string; text: string }[] = Array.isArray(body.turns)
    ? body.turns
    : [];

  if (!sessionId || turns.length === 0) {
    res.status(400).json({ error: "session_id and turns[] are required" });
    return;
  }

  const db = adminClient();
  try {
    // セッションの所有者を確認
    const ses = await db
      .from("sessions")
      .select("id, user_id, status")
      .eq("id", sessionId)
      .single();
    if (ses.error || ses.data.user_id !== user.id) {
      res.status(403).json({ error: "session not found or not yours" });
      return;
    }

    const rows = turns
      .filter(
        (t) =>
          Number.isInteger(t.seq) &&
          (t.speaker === "user" || t.speaker === "ai") &&
          typeof t.text === "string" &&
          t.text.trim().length > 0,
      )
      .map((t) => ({
        user_id: user.id,
        session_id: sessionId,
        seq: t.seq,
        speaker: t.speaker,
        text: t.text.trim(),
      }));

    if (rows.length === 0) {
      res.status(400).json({ error: "no valid turns in payload" });
      return;
    }

    const ins = await db.from("turns").upsert(rows, { onConflict: "session_id,seq" });
    if (ins.error) throw ins.error;

    res.status(200).json({ saved: rows.length });
  } catch (e) {
    res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
  }
}
