import { createClient } from "@supabase/supabase-js";

// Admin client — bypasses RLS. Only use server-side, never in code reachable
// from the client. Requires SUPABASE_SECRET_KEY in env.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
