import { accessToken } from "./supabase";

async function call<T>(path: string, body: unknown, timeoutMs = 20000): Promise<T> {
  const token = await accessToken();
  if (!token) throw new Error("not logged in");
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  let r: Response;
  try {
    r = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error("timeout");
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
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
  teacher: {
    key: string;
    display: string;
    labels: string[];
    kind: "solo" | "panel";
    voice: string | null;
  };
}

export const api = {
  /** mode: "morning"=通常レッスン / "listen"=聞き流し（長距離移動用） */
  start: (mode: "morning" | "listen" = "morning") =>
    call<StartResponse>("/api/session/start", { mode }),
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
    }>("/api/session/end", { session_id }, 40000), // サーバー解析(最大30秒)+余裕
};
