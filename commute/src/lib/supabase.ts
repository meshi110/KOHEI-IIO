import { createClient } from "@supabase/supabase-js";

// publishable キーは公開前提の値（RLSで保護）。ビルド時のenvで上書き可能。
const url =
  import.meta.env.VITE_SUPABASE_URL || "https://imhsajhnappghezkrmre.supabase.co";
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_LSbPiGQXbe8aur2YcUb5sw_RaAGN2WC";

export const supabase = createClient(url, anonKey);

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
