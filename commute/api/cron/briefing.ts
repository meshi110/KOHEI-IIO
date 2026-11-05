import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminClient } from "../_lib/supabase";
import { ENV } from "../_lib/env";
import {
  assignSourceUrls,
  generateGroundedBriefing,
  structureBriefing,
} from "../_lib/gemini";
import { buildBriefingSearchPrompt } from "../_lib/prompts";
import { jstToday } from "../../shared/leitner";

/**
 * GET /api/cron/briefing
 * Vercel Cron（平日 JST 5:30 = UTC 前日20:30、vercel.json の "30 20 * * 0-4"）から起動。
 * CRON_SECRET で保護（Vercel は Authorization: Bearer <CRON_SECRET> を自動付与）。
 * profile を持つ各ユーザーに当日分のブリーフィングを生成して保存する。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${ENV.CRON_SECRET}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const db = adminClient();
  const today = jstToday();
  const results: Record<string, string> = {};

  try {
    const users = await db.from("profile").select("user_id");
    if (users.error) throw users.error;

    for (const u of users.data ?? []) {
      try {
        // 既に当日分があればスキップ（手動再実行に耐える）
        const exists = await db
          .from("briefings")
          .select("id")
          .eq("user_id", u.user_id)
          .eq("date", today)
          .maybeSingle();
        if (exists.data) {
          results[u.user_id] = "already exists";
          continue;
        }

        // 1段階目: 検索グラウンディング付きで本文生成
        const grounded = await generateGroundedBriefing(buildBriefingSearchPrompt());
        // 2段階目: 構造化（検索ツールとJSONスキーマは併用できないため分離）
        let briefing = await structureBriefing(grounded.text);
        // 出典URLはグラウンディングメタデータの実URLのみ（本文中のURLは使わない）
        briefing = assignSourceUrls(briefing, grounded.text, grounded.grounding);

        if (!briefing.stories.length) throw new Error("no stories generated");

        const ins = await db.from("briefings").insert({
          user_id: u.user_id,
          date: today,
          stories: briefing.stories,
          vocab: briefing.vocab,
          questions: briefing.questions,
        });
        if (ins.error) throw ins.error;
        results[u.user_id] = `ok (${briefing.stories.length} stories)`;
      } catch (e) {
        // 失敗した日はブリーフィング無しで進む（仕様書8）。記録だけ残す。
        results[u.user_id] = "failed: " + String(e instanceof Error ? e.message : e);
      }
    }

    res.status(200).json({ date: today, results });
  } catch (e) {
    res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
  }
}
