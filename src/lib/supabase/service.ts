import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client that uses the SERVICE_ROLE key.
 *
 * Bypasses RLS. Use only from:
 *   - server actions that need to write to tables without user-writable
 *     policies (`results`, `scores`, `user_streaks`, `events.revealed_at`,
 *     `admins`)
 *   - route handlers invoked by the Vercel cron (`/api/cron/*`)
 *
 * Never import this from a client component or Edge middleware — it reads
 * the private service-role key from env.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL must be set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
