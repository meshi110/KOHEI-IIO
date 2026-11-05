// 平日ストリーク（連続日数）の計算。
// 通勤アプリなので土日は「カウントしない・途切れさせない」扱い。
// すべて sessions テーブルの実データ（JST日付）から計算する。

function dayOfWeek(ymd: string): number {
  // YYYY-MM-DD → 0(日)〜6(土)。日付のみの計算なのでUTC固定でよい
  return new Date(ymd + "T00:00:00Z").getUTCDay();
}

export function isWeekday(ymd: string): boolean {
  const d = dayOfWeek(ymd);
  return d >= 1 && d <= 5;
}

export function prevDay(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function prevWeekday(ymd: string): string {
  let d = prevDay(ymd);
  while (!isWeekday(d)) d = prevDay(d);
  return d;
}

/**
 * 平日ストリークを返す。
 * - today が平日で実施済みなら today を含めて数える
 * - today が未実施（または週末）なら、直近の平日から遡って数える
 *   （「今日まだやっていない」だけでは途切れた扱いにしない）
 */
export function weekdayStreak(sessionDays: Iterable<string>, today: string): number {
  const days = new Set(sessionDays);
  let d = today;
  if (!isWeekday(d)) d = prevWeekday(d);
  if (!days.has(d)) d = prevWeekday(d);
  let count = 0;
  while (days.has(d)) {
    count += 1;
    d = prevWeekday(d);
  }
  return count;
}
