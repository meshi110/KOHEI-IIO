import { describe, expect, it } from "vitest";
import { isWeekday, prevWeekday, weekdayStreak } from "../shared/streak";

// 2026-11-05 は木曜日
describe("weekdayStreak（平日連続・週末はスキップ）", () => {
  it("曜日判定", () => {
    expect(isWeekday("2026-11-05")).toBe(true);  // 木
    expect(isWeekday("2026-11-07")).toBe(false); // 土
    expect(isWeekday("2026-11-08")).toBe(false); // 日
  });
  it("prevWeekday は月曜から金曜に飛ぶ", () => {
    expect(prevWeekday("2026-11-09")).toBe("2026-11-06"); // 月→金
  });
  it("今日を含む連続（月火水木）", () => {
    const days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"];
    expect(weekdayStreak(days, "2026-11-05")).toBe(4);
  });
  it("金曜→月曜は週末を挟んでも連続扱い", () => {
    const days = ["2026-11-05", "2026-11-06", "2026-11-09"]; // 木金月
    expect(weekdayStreak(days, "2026-11-09")).toBe(3);
  });
  it("今日未実施でも昨日までの連続を保持", () => {
    const days = ["2026-11-03", "2026-11-04"];
    expect(weekdayStreak(days, "2026-11-05")).toBe(2);
  });
  it("抜けがあればそこで止まる", () => {
    const days = ["2026-11-02", "2026-11-04", "2026-11-05"]; // 火曜(11/3)が抜け
    expect(weekdayStreak(days, "2026-11-05")).toBe(2);
  });
  it("週末に見ると金曜までの連続", () => {
    const days = ["2026-11-05", "2026-11-06"]; // 木金
    expect(weekdayStreak(days, "2026-11-07")).toBe(2); // 土曜に確認
  });
  it("記録なしなら0", () => {
    expect(weekdayStreak([], "2026-11-05")).toBe(0);
  });
});
