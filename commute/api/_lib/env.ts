// 環境変数（サーバー専用）。フロントに出してはいけない値はここからしか読まない。

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const ENV = {
  get GEMINI_API_KEY() {
    return req("GEMINI_API_KEY");
  },
  get SUPABASE_URL() {
    return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || req("SUPABASE_URL");
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return req("SUPABASE_SERVICE_ROLE_KEY");
  },
  get CRON_SECRET() {
    return req("CRON_SECRET");
  },
  // モデル名は変わりやすいため環境変数で差し替え可能にする（仕様書3）。
  // 既定値は 2026-11 時点で公式モデルページが案内する現行モデル。
  get LIVE_MODEL() {
    return process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";
  },
  get TEXT_MODEL() {
    return process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash";
  },
};
