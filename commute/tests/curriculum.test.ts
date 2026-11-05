import { describe, expect, it } from "vitest";
import { focusForDate } from "../shared/curriculum";

// 2026-11-02(月)〜2026-11-08(日) の週で検証
describe("focusForDate（週間カリキュラム）", () => {
  it("月曜はスピーキング強化", () => {
    expect(focusForDate("2026-11-02").id).toBe("speaking");
  });
  it("火曜はリスニング強化", () => {
    expect(focusForDate("2026-11-03").id).toBe("listening");
  });
  it("水曜は瞬発力", () => {
    expect(focusForDate("2026-11-04").id).toBe("quick");
  });
  it("木曜はディスカッション", () => {
    expect(focusForDate("2026-11-05").id).toBe("discussion");
  });
  it("金曜は息抜き（映画・カルチャー）", () => {
    const f = focusForDate("2026-11-06");
    expect(f.id).toBe("fun");
    expect(f.promptBlock).toContain("movies");
  });
  it("土日は当番日ライトミックス", () => {
    expect(focusForDate("2026-11-07").id).toBe("weekend");
    expect(focusForDate("2026-11-08").id).toBe("weekend");
  });
  it("全フォーカスにシステム指示用ブロックと日本語ラベルがある", () => {
    for (const d of ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]) {
      const f = focusForDate(d);
      expect(f.promptBlock).toContain("TODAY'S TRAINING FOCUS");
      expect(f.labelJa.length).toBeGreaterThan(0);
      expect(f.emoji.length).toBeGreaterThan(0);
    }
  });
});
