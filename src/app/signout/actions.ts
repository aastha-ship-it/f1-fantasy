"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { INVITE_COOKIE_NAME } from "@/lib/inviteCookie";

/**
 * Clears the Supabase session AND the invite-gate cookie, then bounces to
 * /login. Invoked from a simple form on /dashboard.
 */
export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(INVITE_COOKIE_NAME);
  redirect("/login");
}
