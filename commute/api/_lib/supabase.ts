import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ENV } from "./env";

/** service_role クライアント（RLSをバイパスする。user_id は必ず検証済みの値を使うこと） */
export function adminClient(): SupabaseClient {
  return createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Authorization: Bearer <supabase access_token> を検証し、ユーザーを返す */
export async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
): Promise<User | null> {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return null;
  }
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "invalid or expired token" });
    return null;
  }
  return data.user;
}

export function methodGuard(
  req: VercelRequest,
  res: VercelResponse,
  methods: string[],
): boolean {
  if (!methods.includes(req.method || "")) {
    res.status(405).json({ error: `method not allowed: ${req.method}` });
    return false;
  }
  return true;
}
