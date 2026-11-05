import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
    setBusy(false);
  }

  return (
    <div className="center">
      <form className="login" onSubmit={login}>
        <h1>🚗 通勤英会話</h1>
        <p className="dim">Supabase に登録したアカウントでログイン</p>
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button className="btn primary" disabled={busy}>
          {busy ? "ログイン中…" : "ログイン"}
        </button>
        {err && <p className="err">{err}</p>}
      </form>
    </div>
  );
}
