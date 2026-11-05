// Gemini API 呼び出し（サーバー専用）
// モデル名・SDKの形は @google/genai v2.32.0 の型定義で確認済み（TESTLOG.md参照）

import { GoogleGenAI, Type, type GroundingMetadata } from "@google/genai";
import { ENV } from "./env";
import type { AnalysisOutput, Briefing } from "../../shared/types";

export function geminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
}

/**
 * エフェメラルトークン発行（v1alpha限定・@experimental）
 * @param expireMinutes トークン有効期限（分）。通常セッション45分、聞き流しは長距離移動
 *   （サッカー帯同 片道2時間）に合わせて延長する。再接続はこのトークンで新規接続するため、
 *   期限が切れると約10分ごとの再接続が失敗する。
 */
export async function createEphemeralToken(liveModel: string, expireMinutes = 45): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey: ENV.GEMINI_API_KEY,
    httpOptions: { apiVersion: "v1alpha" },
  });
  const now = Date.now();
  const token = await ai.authTokens.create({
    config: {
      uses: 1, // 再接続(resume)は使用回数にカウントされない（SDKドキュメント）
      expireTime: new Date(now + expireMinutes * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 5 * 60 * 1000).toISOString(), // 新規接続は5分以内に
      // モデルをトークン側で固定する。config の固定は sessionResumption の handle が
      // 再接続ごとに変わるため行わない（固定すると再接続時に不一致になる恐れがある）。
      liveConnectConstraints: { model: liveModel },
    },
  });
  if (!token.name) throw new Error("ephemeral token creation returned no name");
  return token.name;
}

/** 解析（Structured Outputs）。summary/errors/new_cards/card_results を返す */
export async function runAnalysis(prompt: string): Promise<AnalysisOutput> {
  const ai = geminiClient();
  const resp = await ai.models.generateContent({
    model: ENV.TEXT_MODEL,
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          errors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  enum: ["grammar", "vocab", "pronunciation", "fluency", "comprehension"],
                },
                pattern: { type: Type.STRING },
                said: { type: Type.STRING },
                better: { type: Type.STRING },
                note: { type: Type.STRING },
              },
              required: ["category", "pattern", "said", "better", "note"],
            },
          },
          new_cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front_ja: { type: Type.STRING },
                back_en: { type: Type.STRING },
              },
              required: ["front_ja", "back_en"],
            },
          },
          card_results: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                card_id: { type: Type.STRING },
                said_correctly: { type: Type.BOOLEAN },
              },
              required: ["card_id", "said_correctly"],
            },
          },
        },
        required: ["summary", "errors", "new_cards", "card_results"],
      },
    },
  });
  const text = resp.text;
  if (!text) throw new Error("analysis returned empty response");
  return JSON.parse(text) as AnalysisOutput;
}

export interface GroundedBriefingText {
  text: string;
  grounding: GroundingMetadata | undefined;
}

/** ブリーフィング第1段階：検索グラウンディング付きで本文生成 */
export async function generateGroundedBriefing(prompt: string): Promise<GroundedBriefingText> {
  const ai = geminiClient();
  const resp = await ai.models.generateContent({
    model: ENV.TEXT_MODEL,
    contents: prompt,
    config: {
      temperature: 0.7,
      tools: [{ googleSearch: {} }],
    },
  });
  const text = resp.text;
  if (!text) throw new Error("briefing generation returned empty response");
  const grounding = resp.candidates?.[0]?.groundingMetadata;
  return { text, grounding };
}

/** ブリーフィング第2段階：本文を構造化（検索ツールとJSONスキーマは併用しない） */
export async function structureBriefing(rawText: string): Promise<Briefing> {
  const ai = geminiClient();
  const resp = await ai.models.generateContent({
    model: ENV.TEXT_MODEL,
    contents: `Convert the following news briefing text into JSON. Keep sentences verbatim; do not add facts that are not in the text. meaning_ja is the Japanese translation of the word. definition_en is a short English definition. example is one short example sentence using the word (you may write this yourself).\n\n${rawText}`,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          stories: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary_sentences: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["title", "summary_sentences"],
            },
          },
          vocab: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                definition_en: { type: Type.STRING },
                meaning_ja: { type: Type.STRING },
                example: { type: Type.STRING },
              },
              required: ["word", "definition_en", "meaning_ja", "example"],
            },
          },
          questions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["stories", "vocab", "questions"],
      },
    },
  });
  const text = resp.text;
  if (!text) throw new Error("briefing structuring returned empty response");
  const parsed = JSON.parse(text) as Omit<Briefing, "stories"> & {
    stories: { title: string; summary_sentences: string[] }[];
  };
  return {
    stories: parsed.stories.map((s) => ({ ...s, source_urls: [] })),
    vocab: parsed.vocab.slice(0, 3),
    questions: parsed.questions.slice(0, 2),
  };
}

/**
 * 出典URLの割り当て（仕様書8：グラウンディングメタデータの実URLのみ使用。
 * 本文中にモデルが書いたURLは使わない）。
 * groundingSupports の segment 位置を STORY 見出しの位置と突き合わせて、
 * 各ストーリーに対応するチャンクのURLを割り当てる。失敗した分は空のまま。
 */
export function assignSourceUrls(
  briefing: Briefing,
  rawText: string,
  grounding: GroundingMetadata | undefined,
): Briefing {
  if (!grounding?.groundingChunks?.length) return briefing;
  const chunkUrl = (i: number): string | null => {
    const u = grounding.groundingChunks?.[i]?.web?.uri;
    return typeof u === "string" && u.length > 0 ? u : null;
  };

  // STORY n: 見出しの開始位置
  const offsets: number[] = [];
  for (let n = 1; n <= briefing.stories.length; n++) {
    const idx = rawText.indexOf(`STORY ${n}:`);
    offsets.push(idx);
  }
  const urlSets: Set<string>[] = briefing.stories.map(() => new Set<string>());

  const supports = grounding.groundingSupports ?? [];
  for (const sup of supports) {
    const start = sup.segment?.startIndex ?? null;
    const chunkIdxs = sup.groundingChunkIndices ?? [];
    if (start == null) continue;
    // start位置が属するストーリーを特定
    let storyIdx = -1;
    for (let i = 0; i < offsets.length; i++) {
      const lo = offsets[i];
      const hi = i + 1 < offsets.length && offsets[i + 1] >= 0 ? offsets[i + 1] : Infinity;
      if (lo >= 0 && start >= lo && start < hi) storyIdx = i;
    }
    if (storyIdx < 0) continue;
    for (const ci of chunkIdxs) {
      const u = chunkUrl(ci);
      if (u) urlSets[storyIdx].add(u);
    }
  }

  // supportsでの割り当てが全滅した場合は、全チャンクURLをブリーフィング全体の出典として
  // 1件目のストーリーに付けず、各ストーリー空のままにする（推測で割り当てない）。
  return {
    ...briefing,
    stories: briefing.stories.map((s, i) => ({
      ...s,
      source_urls: Array.from(urlSets[i] ?? []),
    })),
  };
}
