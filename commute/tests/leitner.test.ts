import { describe, expect, it } from "vitest";
import { BOX_INTERVALS_DAYS, jstDatePlusDays, jstToday, nextBox, nextDueDate } from "../shared/leitner";

describe("leitner", () => {
  it("正解で box+1（上限5）", () => {
    expect(nextBox(1, true)).toBe(2);
    expect(nextBox(4, true)).toBe(5);
    expect(nextBox(5, true)).toBe(5);
  });
  it("不正解で box=1", () => {
    expect(nextBox(5, false)).toBe(1);
    expect(nextBox(1, false)).toBe(1);
  });
  it("間隔は 1/2/4/7/14 日", () => {
    expect(BOX_INTERVALS_DAYS).toEqual({ 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 });
  });
  it("JSTの日付が YYYY-MM-DD で返る", () => {
    expect(jstToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("JST 0:30 には JST では当日、UTCでは前日になる（タイムゾーン境界）", () => {
    // 2026-11-05T15:30:00Z = JST 2026-11-06 00:30
    const d = new Date("2026-11-05T15:30:00Z");
    expect(jstToday(d)).toBe("2026-11-06");
  });
  it("日付の加算が月またぎでも正しい", () => {
    const d = new Date("2026-11-30T03:00:00Z"); // JST 11/30 12:00
    expect(jstDatePlusDays(1, d)).toBe("2026-12-01");
    expect(jstDatePlusDays(14, d)).toBe("2026-12-14");
  });
  it("nextDueDate が box に応じた日数後", () => {
    const d = new Date("2026-11-05T00:00:00Z"); // JST 11/5 09:00
    expect(nextDueDate(1, d)).toBe("2026-11-06");
    expect(nextDueDate(5, d)).toBe("2026-11-19");
  });
});
