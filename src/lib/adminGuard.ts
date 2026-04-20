import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./supabase/server";
import { createSupabaseServiceClient } from "./supabase/service";

/**
 * Admin guard. Checks whether a given user id is present in public.admins.
 * Reads through the service-role client because public users have SELECT
 * on admins anyway — but doing the lookup server-side keeps the caller
 * from relying on a round-trip via their own session.
 */
export async function isAdmin(
  svc: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await svc
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[adminGuard] admins lookup failed:", error.message);
    return false;
  }
  return Boolean(data);
}

export type AdminGuardResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/**
 * Convenience helper for server components + route handlers. Resolves the
 * current user from cookies, then checks admin membership.
 */
export async function currentAdmin(): Promise<AdminGuardResult> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, reason: "unauthenticated" };
  const svc = createSupabaseServiceClient();
  if (!(await isAdmin(svc, data.user.id))) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, userId: data.user.id };
}
