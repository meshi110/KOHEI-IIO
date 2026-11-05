// 簡易ライトナー方式（仕様書9）
// 正解: box+1（最大5） / 不正解: box=1
// 次回日: box ごとに 1 / 2 / 4 / 7 / 14 日後

export const BOX_INTERVALS_DAYS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 14,
};

export function nextBox(currentBox: number, correct: boolean): number {
  if (!correct) return 1;
  return Math.min(5, Math.max(1, currentBox) + 1);
}

/** JSTの「今日」を YYYY-MM-DD で返す */
export function jstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** JSTの今日から n 日後を YYYY-MM-DD で返す */
export function jstDatePlusDays(days: number, now: Date = new Date()): string {
  const base = new Date(jstToday(now) + "T00:00:00Z"); // 日付だけの計算なのでUTC固定でよい
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function nextDueDate(newBox: number, now: Date = new Date()): string {
  const days = BOX_INTERVALS_DAYS[newBox] ?? 1;
  return jstDatePlusDays(days, now);
}
