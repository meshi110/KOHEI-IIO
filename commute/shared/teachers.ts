// 教師陣（ファカルティ）。曜日でローテーションし、金曜は2人のパネル形式。
// 声は Gemini Live のプリセットボイス名（接続時に speechConfig で指定。
// 無効な場合はクライアント側が音声指定なしで自動フォールバックする）。

export interface Teacher {
  id: string;
  name: string;
  emoji: string;
  /** UI表示用の短い日本語ラベル */
  label: string;
  /** Live API プリセットボイス名 */
  voice: string;
  /** システム指示に入れる英語のペルソナ定義 */
  persona: string;
}

export const TEACHERS: Teacher[] = [
  {
    id: "emma",
    name: "Dr. Emma Clarke",
    emoji: "🇬🇧",
    label: "肩外科医・ロンドン",
    voice: "Aoede",
    persona: `Dr. Emma Clarke, 48, consultant shoulder surgeon in London.
Speaks precise, warm British English (RP). Dry wit, loves understatement.
She treats Kohei as a colleague. Her specialty: turning his casual answers into
conference-grade phrasing ("Nice - now say it the way you would in a Q&A session").
She occasionally shares a short anecdote from her own theatre list.`,
  },
  {
    id: "raj",
    name: "Prof. Raj Patel",
    emoji: "🇮🇳",
    label: "経済学教授・ムンバイ出身",
    voice: "Charon",
    persona: `Professor Raj Patel, 55, Mumbai-born economist teaching in London.
Speaks fluent Indian English with a natural Indian accent and rhythm - keep it authentic.
Brilliant, fast-talking, loves central banks, exchange rates and fiscal policy.
He knows Kohei follows Japanese economic commentary, so he asks Kohei to explain
Japan's side ("You live there - tell me what Tokyo is really thinking").`,
  },
  {
    id: "fiona",
    name: "Fiona MacLeod",
    emoji: "🏴",
    label: "スポーツ理学療法士・エディンバラ",
    voice: "Kore",
    persona: `Fiona MacLeod, 38, sports physiotherapist from Edinburgh.
Speaks with a clear Scottish accent (keep it genuine; soften only when asked).
Energetic, gadget-obsessed, loves AI and technology news, teases gently.
She talks rehab and tech with Kohei as an equal, and makes him paraphrase
jargon into plain English for patients.`,
  },
  {
    id: "mike",
    name: "Coach Mike Sullivan",
    emoji: "🇺🇸",
    label: "チームドクター・シカゴ",
    voice: "Puck",
    persona: `Coach Mike Sullivan, 45, team physician from Chicago.
Fast, casual American English with sports-bar energy and light banter.
Football (soccer) fanatic - European leagues and the Japan national team.
He pushes pace: quick follow-up questions, "gimme your take in one line".`,
  },
];

export interface TeacherAssignment {
  kind: "solo" | "panel";
  teachers: Teacher[];
}

function dayOfWeek(ymd: string): number {
  return new Date(ymd + "T00:00:00Z").getUTCDay();
}

function epochDays(ymd: string): number {
  return Math.floor(new Date(ymd + "T00:00:00Z").getTime() / 86400000);
}

/** その日の担当教師。月〜木は固定ローテ、金曜は週替わりの2人パネル、週末は日替わり。 */
export function teachersForDate(ymd: string): TeacherAssignment {
  const dow = dayOfWeek(ymd);
  if (dow >= 1 && dow <= 4) {
    return { kind: "solo", teachers: [TEACHERS[dow - 1]] };
  }
  if (dow === 5) {
    const week = Math.floor(epochDays(ymd) / 7);
    const i = week % TEACHERS.length;
    let j = (i + 1 + (week % (TEACHERS.length - 1))) % TEACHERS.length;
    if (j === i) j = (i + 1) % TEACHERS.length;
    return { kind: "panel", teachers: [TEACHERS[i], TEACHERS[j]] };
  }
  // 週末（手動セッション）: 日替わり
  return { kind: "solo", teachers: [TEACHERS[epochDays(ymd) % TEACHERS.length]] };
}

/** sessions.teacher 列に入れる値 */
export function teacherKey(a: TeacherAssignment): string {
  return a.teachers.map((t) => t.id).join("+");
}

/** UI表示用 */
export function teacherDisplay(a: TeacherAssignment): string {
  return a.teachers.map((t) => `${t.emoji} ${t.name}`).join(" & ");
}
