import { describe, expect, it } from "vitest";
import { normalizeForMatch, saidExistsInTurns } from "../shared/verify";
import type { Turn } from "../shared/types";

const turns: Turn[] = [
  { seq: 1, speaker: "user", text: "Yesterday I operated him for rotator cuff tear." },
  { seq: 2, speaker: "ai", text: "You mean you operated on him. What technique did you use?" },
  { seq: 3, speaker: "user", text: "I use double-row technique, and the patient don't have pain now." },
];

describe("said の実在照合（仕様書9: 実在しない引用は保存しない）", () => {
  it("実際の発話と完全一致 → 採用", () => {
    expect(saidExistsInTurns("I operated him for rotator cuff tear", turns)).toBe(true);
  });
  it("大文字小文字・句読点・アポストロフィのゆらぎは吸収", () => {
    expect(saidExistsInTurns("the patient dont have pain now", turns)).toBe(true);
    expect(saidExistsInTurns("I use double row technique", turns)).toBe(true);
  });
  it("AIの発話からの引用は不採用（ユーザー発話のみ照合）", () => {
    expect(saidExistsInTurns("What technique did you use", turns)).toBe(false);
  });
  it("存在しない捏造引用は不採用", () => {
    expect(saidExistsInTurns("I has went to hospital", turns)).toBe(false);
  });
  it("空文字は不採用", () => {
    expect(saidExistsInTurns("", turns)).toBe(false);
  });
  it("normalizeForMatch は記号を吸収する", () => {
    expect(normalizeForMatch("Don't  worry, be-happy!")).toBe("dont worry be happy");
  });
});
