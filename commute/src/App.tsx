import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import LoginView from "./views/LoginView";
import SessionView from "./views/SessionView";
import HistoryView from "./views/HistoryView";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<"session" | "history">("session");
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!checked) return <div className="center dim">読み込み中…</div>;
  if (!user) return <LoginView />;

  return (
    <div className="app">
      <main className="main">
        {tab === "session" ? (
          <SessionView onActiveChange={setSessionActive} />
        ) : (
          <HistoryView />
        )}
      </main>
      {!sessionActive && (
        <nav className="tabbar">
          <button className={tab === "session" ? "on" : ""} onClick={() => setTab("session")}>
            🚗 セッション
          </button>
          <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>
            📒 履歴
          </button>
        </nav>
      )}
    </div>
  );
}
