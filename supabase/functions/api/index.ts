// Ortho English Voice — API 中継 (Supabase Edge Function)
// 役割:
//   1) Gemini API キーをブラウザに出さないためのプロキシ
//   2) service_role による DB 読み書き (テーブルは RLS で外部から遮断済み)
// 認証: リクエストヘッダ x-app-pin を APP_PIN シークレットと照合する簡易認証。
// 必要なシークレット (Dashboard → Edge Functions → Secrets):
//   GEMINI_API_KEY : Google AI Studio で発行
//   APP_PIN        : 任意の暗証番号 (アプリの設定画面に入れる)
//   GEMINI_MODEL   : 省略可。既定 gemini-2.5-flash

import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const APP_PIN = Deno.env.get("APP_PIN") ?? "";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-app-pin",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// deno-lint-ignore no-explicit-any
function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function gemini(body: any): Promise<any> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  return await r.json();
}

// deno-lint-ignore no-explicit-any
function geminiText(resp: any): string {
  const parts = resp?.candidates?.[0]?.content?.parts ?? [];
  // deno-lint-ignore no-explicit-any
  return parts.map((p: any) => p.text ?? "").join("").trim();
}

// 会話履歴を Gemini の contents 形式へ
// deno-lint-ignore no-explicit-any
function toContents(messages: any[]): any[] {
  return (messages ?? []).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: String(m.text ?? "") }],
  }));
}

// 下車時の抽出スキーマ (Structured Outputs)
const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    news_topic: { type: "string", description: "Main news topic discussed, in English" },
    summary: { type: "string", description: "3-4 sentence summary of the conversation, in English" },
    vocabularies: {
      type: "array",
      description: "Up to 3 words or phrases that were NEW to the user in this conversation",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          meaning: { type: "string", description: "日本語の意味" },
          example_sentence: { type: "string" },
        },
        required: ["word", "meaning", "example_sentence"],
      },
    },
    feedback: {
      type: "array",
      description: "Grammar or vocabulary mistakes the user actually made, with corrections",
      items: {
        type: "object",
        properties: {
          user_raw_speech: { type: "string" },
          corrected_speech: { type: "string" },
          explanation: { type: "string", description: "なぜ直すのかの短い日本語解説" },
        },
        required: ["user_raw_speech", "corrected_speech", "explanation"],
      },
    },
    review_result: {
      type: "object",
      nullable: true,
      description: "The review quiz at the start of the session, if one happened",
      properties: {
        word: { type: "string" },
        correct: { type: "boolean" },
      },
      required: ["word", "correct"],
    },
  },
  required: ["news_topic", "summary", "vocabularies", "feedback"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!APP_PIN) return json({ error: "APP_PIN secret is not set on the server" }, 500);
  if (req.headers.get("x-app-pin") !== APP_PIN) return json({ error: "unauthorized" }, 401);

  try {
    const { action, ...p } = await req.json();

    // ---- 乗車時: 弱点データを取得 ----
    if (action === "weaknesses") {
      const [vocab, fb, stats] = await Promise.all([
        db.from("vocabularies").select("id, word, meaning, example_sentence, review_count")
          .eq("mastered", false).order("last_reviewed_at", { ascending: true, nullsFirst: true })
          .limit(8),
        db.from("feedback_logs").select("user_raw_speech, corrected_speech, explanation")
          .eq("resolved", false).order("created_at", { ascending: false }).limit(5),
        db.from("sessions").select("id", { count: "exact", head: true }),
      ]);
      if (vocab.error) throw vocab.error;
      if (fb.error) throw fb.error;
      return json({
        vocabularies: vocab.data,
        feedback: fb.data,
        session_count: stats.count ?? 0,
      });
    }

    // ---- 会話中: Gemini プロキシ ----
    if (action === "chat") {
      if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY secret is not set" }, 500);
      // deno-lint-ignore no-explicit-any
      const body: any = {
        contents: toContents(p.messages),
        systemInstruction: { parts: [{ text: String(p.system ?? "") }] },
        generationConfig: { temperature: 0.9, maxOutputTokens: 600 },
      };
      // 冒頭ブリーフィングだけ Google 検索グラウンディングを使う
      if (p.use_search) body.tools = [{ google_search: {} }];
      const resp = await gemini(body);
      return json({ text: geminiText(resp) });
    }

    // ---- 下車時: 構造化抽出 → DB 保存 ----
    if (action === "finish") {
      if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY secret is not set" }, 500);
      const transcript = (p.messages ?? [])
        // deno-lint-ignore no-explicit-any
        .map((m: any) => `${m.role === "user" ? "LEARNER" : "TUTOR"}: ${m.text}`)
        .join("\n");

      const resp = await gemini({
        contents: [{
          role: "user",
          parts: [{
            text: `Below is a voice English-practice conversation between a TUTOR (AI) and a LEARNER (Japanese orthopaedic surgeon, non-native speaker).

Extract learning data. Rules:
- "vocabularies": up to 3 words/phrases that appeared to be NEW to the learner (the tutor introduced or explained them, or the learner asked about them). Not basic words.
- "feedback": actual mistakes in the LEARNER's own lines only. Quote the learner verbatim in user_raw_speech. If the learner spoke flawlessly, return an empty array — do not invent mistakes.
- "review_result": if the tutor opened with a review quiz about a specific word, record which word and whether the learner got it right; otherwise null.
- meaning / explanation fields are in Japanese.

TRANSCRIPT:
${transcript}`,
          }],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: EXTRACT_SCHEMA,
          temperature: 0.2,
        },
      });

      const ex = JSON.parse(geminiText(resp) || "{}");

      // sessions
      const ses = await db.from("sessions").insert({
        news_topic: ex.news_topic ?? null,
        summary: ex.summary ?? null,
        duration_seconds: p.duration_seconds ?? null,
        turn_count: (p.messages ?? []).length,
      }).select("id").single();
      if (ses.error) throw ses.error;
      const sid = ses.data.id;

      // vocabularies (同語の重複は追加しない)
      let added = 0;
      for (const v of ex.vocabularies ?? []) {
        if (!v?.word) continue;
        const dup = await db.from("vocabularies").select("id").ilike("word", v.word).limit(1);
        if (dup.error) throw dup.error;
        if (dup.data.length) continue;
        const ins = await db.from("vocabularies").insert({
          session_id: sid,
          word: v.word,
          meaning: v.meaning ?? null,
          example_sentence: v.example_sentence ?? null,
        });
        if (ins.error) throw ins.error;
        added++;
      }

      // feedback_logs
      const fbRows = (ex.feedback ?? [])
        // deno-lint-ignore no-explicit-any
        .filter((f: any) => f?.user_raw_speech && f?.corrected_speech)
        // deno-lint-ignore no-explicit-any
        .map((f: any) => ({
          session_id: sid,
          user_raw_speech: f.user_raw_speech,
          corrected_speech: f.corrected_speech,
          explanation: f.explanation ?? null,
        }));
      if (fbRows.length) {
        const ins = await db.from("feedback_logs").insert(fbRows);
        if (ins.error) throw ins.error;
      }

      // 冒頭クイズの結果で習熟カウンタを更新 (正解3回で mastered)
      if (ex.review_result?.word) {
        const q = await db.from("vocabularies")
          .select("id, review_count, correct_count")
          .ilike("word", ex.review_result.word).eq("mastered", false).limit(1);
        if (!q.error && q.data.length) {
          const row = q.data[0];
          const correct = ex.review_result.correct === true;
          const cc = (row.correct_count ?? 0) + (correct ? 1 : 0);
          await db.from("vocabularies").update({
            review_count: (row.review_count ?? 0) + 1,
            correct_count: cc,
            mastered: cc >= 3,
            last_reviewed_at: new Date().toISOString(),
          }).eq("id", row.id);
        }
      }

      return json({ saved: true, session_id: sid, vocab_added: added, extraction: ex });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
