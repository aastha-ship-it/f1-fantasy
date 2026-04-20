"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Clears the Supabase session, then bounces to /login.
 *
 * We intentionally do NOT delete the invite cookie — it's a device-level
 * capability token ("this browser was invited once"), not a user session.
 * Keeping it sticky means a returning user after sign-out doesn't have to
 * re-enter the invite code; they just sign in with Google and land on the
 * dashboard.
 */
export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
