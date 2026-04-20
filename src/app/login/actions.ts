"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginResult =
  | { ok: false; error: string }
  | { ok: true; message: string };

function isValidEmail(email: string): boolean {
  // RFC-5322 is a rabbit hole; this is the "good enough for a friend league" check.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function requestMagicLink(
  formData: FormData,
): Promise<LoginResult> {
  const email = formData.get("email");
  const next =
    typeof formData.get("next") === "string"
      ? (formData.get("next") as string)
      : "/dashboard";

  if (typeof email !== "string" || !isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email" };
  }

  const supabase = await createSupabaseServerClient();
  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("host") ? `http://${h.get("host")}` : "http://localhost:3000");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, message: "Check your email for the magic link." };
}
