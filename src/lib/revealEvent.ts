import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin } from "./adminGuard";

/**
 * Admin-triggered reveal (Phase 4).
 *
 * Sets events.revealed_at = now() so the coordinated reveal policy on
 * predictions fires for every friend simultaneously. Fallback: if admin
 * forgets, the 10-minute post-results RLS clause opens it automatically.
 */

export type RevealEventInput = { eventId: string };

export type RevealEventError =
  | "UNAUTHENTICATED"
  | "ADMIN_REQUIRED"
  | "NOT_FOUND"
  | "DB";

export type RevealEventResult =
  | { ok: true; revealedAt: string }
  | { ok: false; error: RevealEventError; message: string };

export async function revealEventWith(
  caller: SupabaseClient,
  svc: SupabaseClient,
  input: RevealEventInput,
): Promise<RevealEventResult> {
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: "UNAUTHENTICATED", message: "Not signed in" };
  }
  if (!(await isAdmin(svc, userData.user.id))) {
    return {
      ok: false,
      error: "ADMIN_REQUIRED",
      message: "Admin privilege required",
    };
  }

  const { data: event, error: evErr } = await svc
    .from("events")
    .select("id")
    .eq("id", input.eventId)
    .maybeSingle();
  if (evErr) return { ok: false, error: "DB", message: evErr.message };
  if (!event) return { ok: false, error: "NOT_FOUND", message: "Event not found" };

  const revealedAt = new Date().toISOString();
  const { error: updErr } = await svc
    .from("events")
    .update({ revealed_at: revealedAt })
    .eq("id", input.eventId);
  if (updErr) return { ok: false, error: "DB", message: updErr.message };

  return { ok: true, revealedAt };
}
