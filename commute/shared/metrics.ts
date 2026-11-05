// session_metrics は turns からコードで計算する（仕様書9：AIに計算させない）

import type { SessionMetrics, Turn } from "./types";

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export function computeMetrics(
  turns: Turn[],
  startedAt: Date | null,
  endedAt: Date | null,
): SessionMetrics {
  let userWords = 0;
  let aiWords = 0;
  let userTurns = 0;
  for (const t of turns) {
    const n = countWords(t.text);
    if (t.speaker === "user") {
      userWords += n;
      userTurns += 1;
    } else {
      aiWords += n;
    }
  }
  let duration: number | null = null;
  if (startedAt && endedAt) {
    const ms = endedAt.getTime() - startedAt.getTime();
    duration = ms >= 0 ? Math.round(ms / 1000) : null; // 計算できない値は null（仕様書4）
  }
  return {
    user_words: userWords,
    ai_words: aiWords,
    user_turns: userTurns,
    duration_sec: duration,
  };
}
