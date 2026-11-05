import { describe, expect, it } from "vitest";
import { computeMetrics } from "../shared/metrics";
import type { Turn } from "../shared/types";

const turns: Turn[] = [
  { seq: 1, speaker: "user", text: "Good morning coach" },
  { seq: 2, speaker: "ai", text: "Good morning Kohei. How are you today?" },
  { seq: 3, speaker: "user", text: "I am fine  thank you." },
];

describe("computeMetrics", () => {
  it("単語数・ターン数を実データから計算する", () => {
    const m = computeMetrics(turns, null, null);
    expect(m.user_words).toBe(8); // 3 + 5
    expect(m.ai_words).toBe(7);
    expect(m.user_turns).toBe(2);
  });
  it("時刻が揃っていれば duration を秒で計算、無ければ null", () => {
    const a = computeMetrics(turns, new Date("2026-11-05T06:50:00Z"), new Date("2026-11-05T07:20:30Z"));
    expect(a.duration_sec).toBe(1830);
    const b = computeMetrics(turns, null, new Date());
    expect(b.duration_sec).toBeNull(); // 計算できない値は null（仕様書4）
  });
  it("負の duration は null", () => {
    const m = computeMetrics(turns, new Date("2026-11-05T08:00:00Z"), new Date("2026-11-05T07:00:00Z"));
    expect(m.duration_sec).toBeNull();
  });
  it("空のターンでもゼロで返る", () => {
    const m = computeMetrics([], null, null);
    expect(m).toEqual({ user_words: 0, ai_words: 0, user_turns: 0, duration_sec: null });
  });
});
