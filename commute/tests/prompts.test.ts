import { describe, expect, it } from "vitest";
import {
  buildListenSystemInstruction,
  buildSystemInstruction,
  buildTeacherBlock,
  type PromptMaterials,
} from "../api/_lib/prompts";
import { teachersForDate } from "../shared/teachers";
import { focusForDate } from "../shared/curriculum";

function materials(ymd: string): PromptMaterials {
  return {
    teacherBlock: buildTeacherBlock(teachersForDate(ymd)),
    focusBlock: focusForDate(ymd).promptBlock,
    profileText: "Level: test",
    lastSummary: null,
    topWeaknesses: [
      { category: "grammar", pattern: "article missing", example_said: null, example_better: null, count: 3 },
    ],
    dueCards: [{ id: "c1", front_ja: "発表後の質問を促す", back_en: "I'd be happy to take any questions.", box: 2 }],
    briefing: {
      stories: [{ title: "Test story", summary_sentences: ["Sentence one.", "Sentence two."] }],
      vocab: [{ word: "resilient", definition_en: "strong under stress", meaning_ja: "回復力のある", example: "The economy proved resilient." }],
      questions: ["What do you think?"],
    },
    stats: { totalSessions: 10, weekdayStreak: 3 },
  };
}

describe("buildSystemInstruction（通常レッスン）", () => {
  it("今日の練習モードブロックが挿入される", () => {
    const m = materials("2026-11-02"); // 月曜
    const s = buildSystemInstruction(m);
    expect(s).toContain("TODAY'S TRAINING FOCUS: SPEAKING");
    expect(s).toContain("TODAY'S TEACHER");
  });
});

describe("buildListenSystemInstruction（聞き流しモード）", () => {
  it("ラジオ形式・Finishで終了・発話を強要しない", () => {
    const s = buildListenSystemInstruction(materials("2026-11-02"));
    expect(s).toContain("LISTEN-ONLY RADIO SHOW");
    expect(s).toContain('until he says "Finish"');
    expect(s).toContain("Never pressure him to talk");
  });
  it("ブリーフィング・復習フレーズ・弱点が組み込まれる", () => {
    const s = buildListenSystemInstruction(materials("2026-11-02"));
    expect(s).toContain("Test story");
    expect(s).toContain("I'd be happy to take any questions.");
    expect(s).toContain("article missing");
  });
  it("ブリーフィングが無い日は映画・会議英語中心の構成になる", () => {
    const m = materials("2026-11-07");
    m.briefing = null;
    const s = buildListenSystemInstruction(m);
    expect(s).toContain("No briefing today");
    expect(s).toContain("MOVIE CORNER");
  });
});
