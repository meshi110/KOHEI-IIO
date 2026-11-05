// 週間カリキュラム: 曜日ごとの練習モード。
// 教師ローテ（teachers.ts）・ニューステーマ（prompts.ts）と噛み合う設計。

export interface TrainingFocus {
  id: string;
  emoji: string;
  labelJa: string;
  /** システム指示に入れる英語ブロック */
  promptBlock: string;
}

const SPEAKING: TrainingFocus = {
  id: "speaking",
  emoji: "🎤",
  labelJa: "スピーキング強化",
  promptBlock: `TODAY'S TRAINING FOCUS: SPEAKING (output day)
- Kohei should do most of the talking today - aim for him speaking well over half the time.
- Keep your own turns extra short. Ask questions that need full answers, then push: "Good - now in three sentences," or "Say it the way you would in a conference Q&A."
- For one story, have him deliver a 30-second mini-presentation about it, then ask one follow-up question like a conference audience member.`,
};

const LISTENING: TrainingFocus = {
  id: "listening",
  emoji: "👂",
  labelJa: "リスニング強化",
  promptBlock: `TODAY'S TRAINING FOCUS: LISTENING (input day)
- Today you talk somewhat more than usual. Tell each story in 6 to 8 sentences at natural speed instead of 4.
- After each story, check comprehension: ask 2 quick questions about specific details, then have him summarize the story back in two sentences.
- Vary your pace deliberately: deliver one passage noticeably faster, then confirm he caught it.`,
};

const QUICK: TrainingFocus = {
  id: "quick",
  emoji: "⚡",
  labelJa: "瞬発力（クイックレスポンス）",
  promptBlock: `TODAY'S TRAINING FOCUS: QUICK RESPONSE (reflex day)
- Short turns, high tempo. Run three 60-second sprints spread through the session:
  (1) say-it-in-English: you give a situation in Japanese or simple English, he answers instantly;
  (2) paraphrase: he restates your sentence in different words;
  (3) one-liners: his opinion in exactly one sentence, no hesitation.
- Don't let him over-think: if he stalls more than about 3 seconds, give the answer cheerfully and move on.`,
};

const DISCUSSION: TrainingFocus = {
  id: "discussion",
  emoji: "🗣",
  labelJa: "ディスカッション",
  promptBlock: `TODAY'S TRAINING FOCUS: DISCUSSION (opinion day)
- Pick sides. After each story, state a mild opinion of your own and invite him to agree or push back with reasons.
- Follow up twice on whatever he says ("Why?", "What about the counter-argument?").
- Feed him one natural discussion phrase per story (e.g. "That's fair, but...", "I see it differently because...") and get him to actually use it.`,
};

const FUN: TrainingFocus = {
  id: "fun",
  emoji: "🎬",
  labelJa: "息抜き（映画・カルチャー）",
  promptBlock: `TODAY'S TRAINING FOCUS: FUN FRIDAY (recovery day)
- Lighter mood. News takes a back seat: one light story at most.
- Main theme: movies, series, music or travel. Ask what he has watched lately; recommend something; quote one famous movie line, let him guess the film, then have him repeat the line with feeling.
- Keep the laughs coming, but it is still English training: slip in useful colloquial phrases.
- End with the week-in-review (best moment this week, one focus for next week) as described elsewhere.`,
};

const WEEKEND: TrainingFocus = {
  id: "weekend",
  emoji: "🌤",
  labelJa: "当番日ライトミックス",
  promptBlock: `TODAY'S TRAINING FOCUS: WEEKEND LIGHT MIX
- He is commuting on a weekend duty day - keep it relaxed and encouraging, and thank him for showing up.
- A shorter session is fine; follow his energy. Mix a little listening and a little speaking, no hard drills.`,
};

export function focusForDate(ymd: string): TrainingFocus {
  const dow = new Date(ymd + "T00:00:00Z").getUTCDay();
  switch (dow) {
    case 1:
      return SPEAKING;
    case 2:
      return LISTENING;
    case 3:
      return QUICK;
    case 4:
      return DISCUSSION;
    case 5:
      return FUN;
    default:
      return WEEKEND;
  }
}
