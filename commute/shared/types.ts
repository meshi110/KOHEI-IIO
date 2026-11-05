// 共有型定義（フロント・サーバー・テストで使用）

export type Speaker = "user" | "ai";

export interface Turn {
  seq: number;
  speaker: Speaker;
  text: string;
}

export interface BriefingStory {
  title: string;
  summary_sentences: string[];
  source_urls: string[];
}

export interface BriefingVocab {
  word: string;
  definition_en: string;
  meaning_ja: string;
  example: string;
}

export interface Briefing {
  stories: BriefingStory[];
  vocab: BriefingVocab[];
  questions: string[];
}

export type WeaknessCategory =
  | "grammar"
  | "vocab"
  | "pronunciation"
  | "fluency"
  | "comprehension";

export interface AnalysisError {
  category: WeaknessCategory;
  pattern: string;
  said: string;
  better: string;
  note: string;
}

export interface AnalysisCardResult {
  card_id: string;
  said_correctly: boolean;
}

export interface AnalysisOutput {
  summary: string;
  errors: AnalysisError[];
  new_cards: { front_ja: string; back_en: string }[];
  card_results: AnalysisCardResult[];
}

export interface SessionMetrics {
  user_words: number;
  ai_words: number;
  user_turns: number;
  duration_sec: number | null;
}
