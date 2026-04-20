import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validatePrediction,
  ValidationError,
  type SessionType,
} from "./validatePrediction";

/**
 * Prediction submit pipeline (Phase 2).
 *
 * Shaped as `submitPredictionWith(client, input)` so it's callable from both
 * a Next.js server action (cookie-bound client) and an integration test
 * (per-user anon client). The server action under
 * `src/app/dashboard/predict/actions.ts` is just the thin HTTP wrapper.
 *
 * Order of checks matters: we fail fast on auth, event existence, and lock
 * boundary BEFORE hitting validation or UPSERT. That keeps surface area
 * small when a user double-taps at T-1s.
 */

export type SubmitPredictionInput = {
  eventId: string;
  p1: number;
  p2: number | null;
  p3: number | null;
};

export type SubmitPredictionError =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "LOCKED"
  | "VALIDATION"
  | "DB";

export type SubmitPredictionResult =
  | { ok: true; id: string }
  | { ok: false; error: SubmitPredictionError; message: string };

export async function submitPredictionWith(
  client: SupabaseClient,
  input: SubmitPredictionInput,
): Promise<SubmitPredictionResult> {
  // 1. Authenticated?
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: "UNAUTHENTICATED", message: "Not signed in" };
  }
  const userId = userData.user.id;

  // 2. Event exists and is readable?
  const { data: event, error: eventErr } = await client
    .from("events")
    .select("id, session_type, lock_at")
    .eq("id", input.eventId)
    .maybeSingle();
  if (eventErr) {
    return { ok: false, error: "DB", message: eventErr.message };
  }
  if (!event) {
    return { ok: false, error: "NOT_FOUND", message: "Event not found" };
  }

  // 3. Fast-fail on lock boundary (DB trigger is still the ultimate guard).
  const lockAt = new Date(event.lock_at as string).getTime();
  if (Date.now() >= lockAt) {
    return {
      ok: false,
      error: "LOCKED",
      message: "Predictions closed for this event",
    };
  }

  // 4. Validate shape + drivers against the active roster.
  const { data: drivers, error: driversErr } = await client
    .from("drivers")
    .select("id")
    .eq("active", true);
  if (driversErr) {
    return { ok: false, error: "DB", message: driversErr.message };
  }
  const activeDriverIds = new Set((drivers ?? []).map((d) => Number(d.id)));

  try {
    validatePrediction(
      { p1: input.p1, p2: input.p2, p3: input.p3 },
      {
        sessionType: event.session_type as SessionType,
        activeDriverIds,
      },
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, error: "VALIDATION", message: err.message };
    }
    throw err;
  }

  // 5. UPSERT. ON CONFLICT (user_id, event_id) DO UPDATE makes
  //    repeated submits idempotent — the last write wins.
  const { data: inserted, error: upsertErr } = await client
    .from("predictions")
    .upsert(
      {
        user_id: userId,
        event_id: input.eventId,
        p1_driver_id: input.p1,
        p2_driver_id: input.p2,
        p3_driver_id: input.p3,
      },
      { onConflict: "user_id,event_id" },
    )
    .select("id")
    .single();

  if (upsertErr) {
    const msg = upsertErr.message ?? "";
    // The DB trigger (predictions_lock_guard) still runs even if we raced
    // past the fast-fail. Surface that as LOCKED, not DB.
    if (msg.includes("Predictions closed")) {
      return { ok: false, error: "LOCKED", message: msg };
    }
    return { ok: false, error: "DB", message: msg };
  }

  return { ok: true, id: (inserted as { id: string }).id };
}
