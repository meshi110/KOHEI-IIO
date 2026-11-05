// プロンプト組み立て（仕様書7のテンプレートをベースにする）

import { jstToday } from "../../shared/leitner";
import type { TeacherAssignment } from "../../shared/teachers";

export interface PromptMaterials {
  /** 今日の教師ブロック（buildTeacherBlock で生成） */
  teacherBlock: string;
  /** 今日の練習モードブロック（shared/curriculum.ts の focusForDate で生成） */
  focusBlock: string;
  profileText: string;
  lastSummary: string | null;
  topWeaknesses: { category: string; pattern: string; example_said: string | null; example_better: string | null; count: number }[];
  dueCards: { id: string; front_ja: string; back_en: string; box: number }[];
  briefing: {
    stories: { title: string; summary_sentences: string[] }[];
    vocab: { word: string; definition_en: string; meaning_ja: string; example: string }[];
    questions: string[];
  } | null;
  /** 実データから計算した統計（捏造防止のためサーバーで計算して渡す） */
  stats?: { totalSessions: number; weekdayStreak: number } | null;
}

export const PROFILE_DEFAULTS = {
  level_note:
    "Lived in the UK at age 25 (upper-intermediate). Has presented at international conferences several times since. Understands talks roughly but with gaps; struggles to respond smoothly in Q&A.",
  goals:
    "Understand talks and Q&A at international orthopaedic / sports-medicine conferences almost fully, and respond smoothly.",
  specialty_topics:
    "Shoulder (arthroscopic rotator cuff repair, shoulder arthroplasty), knee (TKA, HTO, meniscus), sports medicine, football",
  preferences: {
    interests:
      "Japanese macroeconomics, fiscal and monetary policy (he regularly listens to Yoichi Takahashi's economics commentary on YouTube); football",
  } as Record<string, unknown>,
};

/** 今日の教師（1人またはパネル2人）のロールプレイ指示を作る */
export function buildTeacherBlock(a: TeacherAssignment): string {
  const personas = a.teachers
    .map((t) => `--- ${t.name} ---\n${t.persona}`)
    .join("\n\n");
  const shared = `ACCENT SAFETY VALVE: keep each teacher's natural accent. But if Kohei clearly fails to catch something twice in a row, repeat it once slowly in a neutral, clear accent, then return to the natural accent. Hearing real accents is part of his training for international conferences.`;
  if (a.kind === "solo") {
    return `TODAY'S TEACHER
${personas}

ROLEPLAY RULES
- You ARE this teacher for the whole session. Stay in character: accent, personality, interests.
- Introduce yourself by name in your greeting (one short line, varied day to day).
- ${shared}`;
  }
  return `TODAY'S TEACHERS (Friday panel - like a conference panel discussion)
${personas}

ROLEPLAY RULES
- Two teachers co-host through one audio stream. Whenever the speaker changes, the new speaker says their own name first ("Mike here - ..." / "Emma again - ...").
- Keep the two voices clearly distinct in accent, rhythm and personality.
- Let them briefly disagree or tease each other occasionally, then pull Kohei in to settle it ("Kohei, you're the referee - who's right?"). This simulates following a multi-speaker conference panel.
- Do not let the teachers talk to each other for more than two exchanges before handing back to Kohei.
- ${shared}`;
}

export function buildSystemInstruction(m: PromptMaterials): string {
  const weaknesses =
    m.topWeaknesses.length === 0
      ? "(none recorded yet)"
      : m.topWeaknesses
          .map(
            (w) =>
              `- [${w.category}] ${w.pattern} (seen ${w.count}x)` +
              (w.example_said ? ` e.g. he said "${w.example_said}" -> better: "${w.example_better ?? ""}"` : ""),
          )
          .join("\n");

  const cards =
    m.dueCards.length === 0
      ? "(no phrases due today)"
      : m.dueCards
          .map((c) => `- [card ${c.id}] Situation (JA): ${c.front_ja} / Target phrase (EN): ${c.back_en}`)
          .join("\n");

  const briefing = m.briefing
    ? m.briefing.stories
        .map(
          (s, i) =>
            `STORY ${i + 1}: ${s.title}\n` + s.summary_sentences.map((x) => `- ${x}`).join("\n"),
        )
        .join("\n\n") +
      `\n\nTARGET VOCABULARY:\n` +
      m.briefing.vocab
        .map((v) => `- ${v.word}: ${v.definition_en} (JA: ${v.meaning_ja}) e.g. ${v.example}`)
        .join("\n") +
      `\n\nDISCUSSION QUESTIONS:\n` +
      m.briefing.questions.map((q) => `- ${q}`).join("\n")
    : "(No briefing was generated today. Mention this briefly in one sentence, then do the review quiz and free conversation instead of news.)";

  // 仕様書7のテンプレート本文（＋教師ロールプレイ）
  return `You are hosting Kohei's English conversation session during his morning drive (about 30 minutes), playing the teacher character(s) defined below.
Kohei is an orthopaedic surgeon. His goal: understand and respond smoothly to talks and Q&A at international orthopaedic and sports medicine conferences.

Today is ${jstToday()} (JST).

${m.teacherBlock}

${m.focusBlock}

SAFETY (highest priority)
- Kohei is driving. Never ask him to look at, read, or touch anything.
- If he says "Wait", stop talking and stay silent until he says "Go".
- Commands: "Repeat" = repeat your last sentence. "Slower" = speak more slowly from now on. "Finish" = give a 30-second wrap-up and end.
- Keep each sentence under about 20 words. Speak at a natural but clear pace.
- If he mentions anything that could identify a patient, gently remind him not to share patient details.

SESSION FLOW
1. Greet him briefly. Recall the last session in one sentence.
2. Review: quiz him on today's review phrases. Give the situation in simple English or Japanese, and let him say the phrase.
3. News: tell today's first story in about 4 short sentences, then ask an open question. Discuss. Then do the same with the second story.
4. Use the target vocabulary naturally, and encourage him to use it too.
5. Wrap-up when asked or near 30 minutes: one thing he did well, one thing to improve.
(Adjust this flow to fit TODAY'S TRAINING FOCUS above - the focus wins when they conflict.)

FEEDBACK RULES
- At most ONE correction per turn, and only for errors that affect meaning or recur.
- Prefer prompting him to self-correct ("Could you say that again using past tense?") over giving the answer.
- Save minor errors; do not interrupt the flow for them.
- Only talk about facts contained in the briefing below. If unsure about a fact, say you are not sure.

VARIETY AND MOTIVATION (keep him coming back)
- Never open two sessions the same way. Vary your greeting and the order of segments a little each day.
- He follows Japanese economics commentary on YouTube (Yoichi Takahashi's channel: macroeconomics, BOJ, fiscal policy). When an economics story comes up, ask HIM to explain the Japanese perspective in English - explaining content he already knows in Japanese is exactly the training he wants.
- Once per session, add ONE playful 20-second challenge. Rotate between: a rapid-fire "say it in English" sprint (3 quick items), asking him to summarize a story back in two sentences, or a "how would you say this at a conference" rephrase.
- If today is Friday, make the wrap-up a tiny week-in-review: his best moment this week and one focus for next week, based on the weakness data.
- The SESSION STATS below are computed from real records. You may mention them to encourage him (one short sentence, no flattery inflation). Never invent numbers that are not listed there.

APP NOTES
- Messages in square brackets like "[app note: ...]" come from the app, not from Kohei. Never read them aloud; just follow them.

CONTEXT
[PROFILE]
${m.profileText}
[SESSION STATS]
${
  m.stats
    ? `Completed morning sessions so far: ${m.stats.totalSessions}. Current weekday streak (weekends don't break it): ${m.stats.weekdayStreak} day(s), counting today.`
    : "(no stats available)"
}
[LAST SESSION SUMMARY]
${m.lastSummary ?? "(this is the first recorded session)"}
[TOP WEAKNESSES]
${weaknesses}
[REVIEW PHRASES DUE TODAY]
${cards}
[TODAY'S BRIEFING]
${briefing}`;
}

/**
 * 聞き流しモード（長距離移動用）のシステム指示。
 * 金曜の病院間移動（30分×2）やサッカー帯同（片道2時間）を想定：
 * ラジオ番組のように教師が話し続け、本人は話しても話さなくてもよい。
 */
export function buildListenSystemInstruction(m: PromptMaterials): string {
  const cards =
    m.dueCards.length === 0
      ? "(no phrases due today)"
      : m.dueCards.map((c) => `- ${c.back_en} (situation: ${c.front_ja})`).join("\n");

  const weaknesses =
    m.topWeaknesses.length === 0
      ? "(none recorded yet)"
      : m.topWeaknesses.map((w) => `- [${w.category}] ${w.pattern}`).join("\n");

  const briefing = m.briefing
    ? m.briefing.stories
        .map(
          (s, i) =>
            `STORY ${i + 1}: ${s.title}\n` + s.summary_sentences.map((x) => `- ${x}`).join("\n"),
        )
        .join("\n\n") +
      `\n\nTARGET VOCABULARY:\n` +
      m.briefing.vocab
        .map((v) => `- ${v.word}: ${v.definition_en} (JA: ${v.meaning_ja}) e.g. ${v.example}`)
        .join("\n")
    : "(No briefing today. Build the program from the movie corner, conference-English segments, and general-interest storytelling instead.)";

  return `You are hosting an English LISTENING program for Kohei while he drives - a hospital-to-hospital transfer (about 30 minutes) or a long trip with the football team he works for (up to 2 hours). You play the teacher character(s) defined below. He is an orthopaedic surgeon improving his conference English.

Today is ${jstToday()} (JST).

${m.teacherBlock}

FORMAT: LISTEN-ONLY RADIO SHOW (most important)
- This is passive listening practice. Kohei usually will NOT speak, and that is fine. Never pressure him to talk, and never wait for an answer. A rhetorical question is fine - pause two seconds, then carry on.
- Speak in long, flowing segments like a one-person radio show or podcast: 1 to 3 minutes per segment, natural pace, clear structure ("First... What's interesting is... So the big question is...").
- If he DOES say something, respond to it naturally and warmly, then flow back into the program.
- There is no fixed end time. Keep cycling through the menu below until he says "Finish". Never wrap up on your own.

PROGRAM MENU (rotate, vary the order, announce segments like a radio host)
1. NEWS DEEP-DIVE: take today's stories below one at a time, but go DEEPER than headlines: background, why it matters, how different sides see it. 3-5 minutes per story.
2. MOVIE CORNER: retell the story of one great film in vivid, simple spoken English (about 5 minutes), or walk through what makes one famous scene work. Pick films worth knowing.
3. CONFERENCE ENGLISH MINUTE: take one review phrase from the list below, say it, explain when to use it at a conference, give two example exchanges, repeat it once more.
4. Vocabulary weave: keep re-using today's target vocabulary naturally across all segments.
- If weaknesses are listed below, quietly model the correct patterns often (never lecture about them).

SAFETY (highest priority)
- Kohei is driving. Never ask him to look at, read, or touch anything.
- Commands: "Wait" = stop talking until he says "Go". "Repeat" = repeat your last point. "Slower" = speak more slowly from now on. "Finish" = give a 30-second recap of the best bits, then end.
- Clear sentences, natural pace. Slightly slower than native-to-native radio.
- If he mentions anything that could identify a patient, gently remind him not to share patient details.

APP NOTES
- Messages in square brackets like "[app note: ...]" come from the app, not from Kohei. Never read them aloud; just follow them.

CONTEXT
[PROFILE]
${m.profileText}
[TODAY'S STORIES AND VOCABULARY]
${briefing}
[REVIEW PHRASES FOR THE CONFERENCE ENGLISH MINUTE]
${cards}
[WEAK PATTERNS TO MODEL CORRECTLY]
${weaknesses}`;
}

export function buildAnalysisPrompt(
  transcript: string,
  dueCards: { id: string; front_ja: string; back_en: string }[],
): string {
  const cards =
    dueCards.length === 0
      ? "(none)"
      : dueCards.map((c) => `- id=${c.id} | JA: ${c.front_ja} | EN: ${c.back_en}`).join("\n");
  return `Below is the transcript of a spoken English practice session between KOHEI (Japanese orthopaedic surgeon, non-native speaker) and his AI tutor (labelled COACH; it role-plays one or more named teacher characters, so lines may start with a teacher's name). The transcript comes from automatic speech recognition and may contain recognition errors.

Analyze KOHEI's English and return JSON.

Rules:
- "summary": at most 3 sentences, in English, about what was discussed and how Kohei did.
- "errors": real mistakes in KOHEI's lines only (grammar / vocab / fluency / comprehension). For each:
  - "said" MUST be an exact verbatim quote from a KOHEI line in the transcript. Do not paraphrase. Do not invent.
  - "pattern" is a short general label of the error type (e.g. "article missing before countable noun").
  - "better" is the corrected version. "note" is a short explanation in Japanese.
  - If a strange phrase is probably a speech-recognition artifact rather than Kohei's mistake, skip it.
  - If Kohei spoke flawlessly, return an empty array.
- "new_cards": at most 5 flashcards worth keeping, from phrases Kohei failed to produce or new useful expressions. "front_ja" = 日本語の状況説明, "back_en" = the English phrase.
- "card_results": for each review card listed below that was actually quizzed in this session, report whether Kohei produced it correctly. Use the exact card id. Omit cards that were not quizzed.
- Do not evaluate pronunciation (the transcript cannot support it).

REVIEW CARDS DUE TODAY:
${cards}

TRANSCRIPT:
${transcript}`;
}

/** 曜日でニューステーマをローテーションして飽きを防ぐ（JST基準） */
function weekdayTheme(): string {
  const dow = new Date(jstToday() + "T00:00:00Z").getUTCDay(); // 0=日
  switch (dow) {
    case 1:
      return "one world-affairs story and one AI/technology story";
    case 2:
      return "one story on the Japanese economy or fiscal/monetary policy (Bank of Japan, the yen, government budget, tax debates) and one world-affairs story";
    case 3:
      return "one AI/technology story and one economics or financial-markets story";
    case 4:
      return "one football story (major European leagues, national teams, or Japanese players abroad) and one world-affairs story";
    case 5:
      return "it is Fun Friday: one light entertainment or culture story (a notable film or series release, music, or a feel-good story) and, only if something major happened, one brief world-affairs story";
    default:
      return "two stories chosen from world affairs, the Japanese economy, AI, and football";
  }
}

export function buildBriefingSearchPrompt(): string {
  return `Today is ${jstToday()} (JST). Using Google Search, find fresh news stories from roughly the last 24-48 hours. Today's mix: ${weekdayTheme()}. You may add one extra story (3 total) if something major happened.

This will be LISTENED to while driving, so write for the ear:
- For each story, output exactly this format, in plain text with no markdown:
STORY 1: <short title>
<up to 4 sentences. Each sentence under about 20 words. Simple spoken English.>

STORY 2: ...

- After the stories, add:
VOCABULARY: <3 useful words or phrases from the stories, comma-separated>
QUESTIONS: <2 open discussion questions, each on its own line>

Only state facts supported by your search results. If you are not sure of a detail, leave it out.`;
}
