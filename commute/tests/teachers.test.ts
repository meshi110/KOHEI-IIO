import { describe, expect, it } from "vitest";
import { TEACHERS, teacherKey, teachersForDate } from "../shared/teachers";

// 2026-11-02(月) 〜 2026-11-06(金)
describe("教師ローテーション", () => {
  it("全教師に必須フィールドがある", () => {
    expect(TEACHERS).toHaveLength(4);
    for (const t of TEACHERS) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.voice).toBeTruthy();
      expect(t.persona.length).toBeGreaterThan(100);
    }
  });
  it("月〜木は固定ローテ（emma/raj/fiona/mike）", () => {
    expect(teachersForDate("2026-11-02").teachers[0].id).toBe("emma");
    expect(teachersForDate("2026-11-03").teachers[0].id).toBe("raj");
    expect(teachersForDate("2026-11-04").teachers[0].id).toBe("fiona");
    expect(teachersForDate("2026-11-05").teachers[0].id).toBe("mike");
  });
  it("金曜は異なる2人のパネル", () => {
    const a = teachersForDate("2026-11-06");
    expect(a.kind).toBe("panel");
    expect(a.teachers).toHaveLength(2);
    expect(a.teachers[0].id).not.toBe(a.teachers[1].id);
  });
  it("金曜のペアは週によって変わる（52週で2種類以上・常に2人組）", () => {
    const keys = new Set<string>();
    for (let w = 0; w < 52; w++) {
      const d = new Date(Date.UTC(2026, 0, 2)); // 2026-01-02 は金曜
      d.setUTCDate(d.getUTCDate() + w * 7);
      const a = teachersForDate(d.toISOString().slice(0, 10));
      expect(a.kind).toBe("panel");
      expect(a.teachers[0].id).not.toBe(a.teachers[1].id);
      keys.add(teacherKey(a));
    }
    expect(keys.size).toBeGreaterThan(1);
  });
  it("週末も有効な1人が返る", () => {
    const a = teachersForDate("2026-11-07");
    expect(a.kind).toBe("solo");
    expect(a.teachers).toHaveLength(1);
  });
});
