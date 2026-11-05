// 解析結果の `said` を、文字起こし（turns）に実在する発話とだけ照合する（仕様書9）。
// 一致しない指摘は保存しない。LLMの引用ゆらぎ（大文字小文字・句読点・空白）は吸収するが、
// 単語列そのものが存在しないものは不一致とする。

import type { Turn } from "./types";

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    // アポストロフィ類は除去（don't → dont）して引用ゆらぎを吸収
    .replace(/[’'‘]/g, "")
    // それ以外の記号・句読点は空白へ
    .replace(/[^a-z0-9À-ɏ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ユーザー発話全文（正規化済み）を作る */
export function userCorpus(turns: Turn[]): string {
  return normalizeForMatch(
    turns
      .filter((t) => t.speaker === "user")
      .map((t) => t.text)
      .join(" \n "),
  );
}

/**
 * said が実際のユーザー発話に含まれるか。
 * 3語以上の連続一致を要求（1〜2語だと偶然一致でほぼ素通りになるため、
 * said が2語以下の場合はその全体の完全一致部分列を要求する＝同じ基準）。
 */
export function saidExistsInTurns(said: string, turns: Turn[]): boolean {
  const corpus = userCorpus(turns);
  const needle = normalizeForMatch(said);
  if (!needle) return false;
  if (corpus.includes(needle)) return true;

  // 長い引用はLLMが途中を省略することがあるため、
  // 先頭・末尾それぞれ5語のウィンドウでの一致も許容する（どちらも実在すること）
  const words = needle.split(" ");
  if (words.length > 10) {
    const head = words.slice(0, 5).join(" ");
    const tail = words.slice(-5).join(" ");
    return corpus.includes(head) && corpus.includes(tail);
  }
  return false;
}
