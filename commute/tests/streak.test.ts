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

describe("weekdayStreak（当直＝rest_days はカウントせず途切れもしない）", () => {
  it("当直日を橋渡しして連続が続く", () => {
    const days = ["2026-11-02", "2026-11-03", "2026-11-05"]; // 月火木（水曜に抜け）
    const rest = ["2026-11-04"]; // 水曜は当直
    expect(weekdayStreak(days, "2026-11-05", rest)).toBe(3); // 当直日は数えない
  });
  it("当直登録がなければ同じ抜けで途切れる", () => {
    const days = ["2026-11-02", "2026-11-03", "2026-11-05"];
    expect(weekdayStreak(days, "2026-11-05")).toBe(1);
  });
  it("今日が当直（未実施）でも昨日までの連続を保持", () => {
    const days = ["2026-11-03", "2026-11-04"]; // 火水
    const rest = ["2026-11-05"]; // 木曜（今日）は当直
    expect(weekdayStreak(days, "2026-11-05", rest)).toBe(2);
  });
  it("当直2日連続でも橋渡しされる", () => {
    const days = ["2026-11-02", "2026-11-05"]; // 月・木
    const rest = ["2026-11-03", "2026-11-04"]; // 火水とも当直
    expect(weekdayStreak(days, "2026-11-05", rest)).toBe(2);
  });
  it("週末＋金曜当直をまたいで月曜につながる", () => {
    const days = ["2026-11-04", "2026-11-05", "2026-11-09"]; // 水木月
    const rest = ["2026-11-06"]; // 金曜は当直
    expect(weekdayStreak(days, "2026-11-09", rest)).toBe(3);
  });
  it("当直だけでセッション実績ゼロなら0", () => {
    expect(weekdayStreak([], "2026-11-05", ["2026-11-04", "2026-11-05"])).toBe(0);
  });
});
