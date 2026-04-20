"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  InviteCodeError,
  validateInviteCode,
} from "@/lib/validateInviteCode";
import { INVITE_COOKIE_NAME, inviteCookieValue } from "@/lib/inviteCookie";

export type JoinResult = { ok: false; error: string } | { ok: true };

export async function submitInviteCode(formData: FormData): Promise<JoinResult> {
  const submitted = formData.get("code");
  const next =
    typeof formData.get("next") === "string"
      ? (formData.get("next") as string)
      : "/dashboard";

  if (typeof submitted !== "string") {
    return { ok: false, error: "Invite code required" };
  }

  try {
    validateInviteCode(submitted, { envCode: process.env.INVITE_CODE });
  } catch (err) {
    if (err instanceof InviteCodeError) {
      return { ok: false, error: "Invalid invite code" };
    }
    throw err;
  }

  const cookieStore = await cookies();
  const signedValue = await inviteCookieValue();
  cookieStore.set(INVITE_COOKIE_NAME, signedValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });

  redirect(next.startsWith("/") ? `/login?next=${encodeURIComponent(next)}` : "/login");
}
