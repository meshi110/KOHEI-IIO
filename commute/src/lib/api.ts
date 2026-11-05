import { accessToken } from "./supabase";

async function call<T>(path: string, body: unknown): Promise<T> {
  const token = await accessToken();
  if (!token) throw new Error("not logged in");
  const r = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`);
  return data as T;
}

export interface StartResponse {
  session_id: string;
  token: string;
  model: string;
  system_instruction: string;
  briefing_title: string | null;
  due_cards: { id: string; front_ja: string; back_en: string; box: number }[];
}

export const api = {
  start: () => call<StartResponse>("/api/session/start", {}),
  turns: (session_id: string, turns: { seq: number; speaker: string; text: string }[]) =>
    call<{ saved: number }>("/api/session/turns", { session_id, turns }),
  end: (session_id: string) =>
    call<{
      analyzed: boolean;
      summary?: string | null;
      metrics?: { user_words: number; ai_words: number; user_turns: number; duration_sec: number | null };
      errors_saved?: number;
      new_cards?: number;
      cards_updated?: number;
      reason?: string;
    }>("/api/session/end", { session_id }),
};
