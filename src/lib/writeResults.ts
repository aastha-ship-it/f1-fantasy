import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeScore,
  type Prediction,
  type Actual,
} from "./computeScores";
import { isAdmin } from "./adminGuard";

/**
 * Results + scoring pipeline (Phase 3).
 *
 * Called from either:
 *   - the admin manual-entry server action (`/admin/results/[eventId]`)
 *   - the OpenF1 cron fetcher (Phase 3b, if enabled after a post-Miami
 *     latency rerun)
 *
 * Both paths write the same shape — a `results` row per event plus per-user
 * `scores` rows — so downstream is indistinguishable.
 *
 * Idempotent by construction:
 *   - results: UPSERT on event_id (PK)
 *   - scores: UPSERT on (user_id, event_id)
 *   - user_streaks: recomputed from scratch per affected user by walking
 *     the user's complete scoring history in chronological event order
 */

export type WriteResultsInput = {
  eventId: string;
  p1: number;
  p2: number | null;
  p3: number | null;
};

export type WriteResultsError =
  | "UNAUTHENTICATED"
  | "ADMIN_REQUIRED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "DB";

export type WriteResultsResult =
  | { ok: true; scoresUpdated: number }
  | { ok: false; error: WriteResultsError; message: string };

function isSprintType(t: string): boolean {
  return t === "sprint_race" || t === "sprint_quali";
}

export async function writeResultsWith(
  caller: SupabaseClient,
  svc: SupabaseClient,
  input: WriteResultsInput,
): Promise<WriteResultsResult> {
  // 1. Caller must be authenticated.
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, error: "UNAUTHENTICATED", message: "Not signed in" };
  }

  // 2. Caller must be an admin.
  if (!(await isAdmin(svc, userData.user.id))) {
    return {
      ok: false,
      error: "ADMIN_REQUIRED",
      message: "Admin privilege required",
    };
  }

  return writeResultsService(svc, input);
}

/**
 * Same pipeline, no auth/admin gate. Trust boundary is the caller — used by
 * the OpenF1 cron fetcher, which is itself protected by `Bearer CRON_SECRET`.
 * Do NOT call this from a request handler that lacks an equivalent gate.
 */
export async function writeResultsService(
  svc: SupabaseClient,
  input: WriteResultsInput,
): Promise<WriteResultsResult> {
  // 3. Event exists.
  const { data: event, error: evErr } = await svc
    .from("events")
    .select("id, session_type")
    .eq("id", input.eventId)
    .maybeSingle<{ id: string; session_type: string }>();
  if (evErr) return { ok: false, error: "DB", message: evErr.message };
  if (!event) return { ok: false, error: "NOT_FOUND", message: "Event not found" };

  const sprint = isSprintType(event.session_type);

  // 4. Shape validation for the actual results payload.
  if (sprint) {
    if (input.p2 !== null || input.p3 !== null) {
      return {
        ok: false,
        error: "VALIDATION",
        message: "Sprint sessions record P1 only",
      };
    }
  } else {
    if (input.p2 === null || input.p3 === null) {
      return {
        ok: false,
        error: "VALIDATION",
        message: "Race/quali sessions require P1, P2, and P3",
      };
    }
    const picks = [input.p1, input.p2, input.p3];
    if (new Set(picks).size !== picks.length) {
      return {
        ok: false,
        error: "VALIDATION",
        message: "Actual results must have three distinct drivers",
      };
    }
  }

  // 5. UPSERT the results row.
  const { error: resultsErr } = await svc.from("results").upsert(
    {
      event_id: input.eventId,
      p1_driver_id: input.p1,
      p2_driver_id: input.p2,
      p3_driver_id: input.p3,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );
  if (resultsErr) {
    return { ok: false, error: "DB", message: resultsErr.message };
  }

  // 6. Fetch every prediction for this event. Service role bypasses RLS.
  const { data: predictions, error: predErr } = await svc
    .from("predictions")
    .select("user_id, p1_driver_id, p2_driver_id, p3_driver_id")
    .eq("event_id", input.eventId);
  if (predErr) return { ok: false, error: "DB", message: predErr.message };

  const actual: Actual = { p1: input.p1, p2: input.p2, p3: input.p3 };
  const affectedUsers = new Set<string>();

  for (const pred of predictions ?? []) {
    const prediction: Prediction = {
      p1: Number(pred.p1_driver_id),
      p2: pred.p2_driver_id === null ? null : Number(pred.p2_driver_id),
      p3: pred.p3_driver_id === null ? null : Number(pred.p3_driver_id),
    };
    const score = computeScore(prediction, actual, sprint);
    const userId = pred.user_id as string;
    const { error: scoreErr } = await svc.from("scores").upsert(
      {
        user_id: userId,
        event_id: input.eventId,
        points: score.points,
        exact_matches: score.exact_matches,
        slot_mismatches: score.slot_mismatches,
        dnf_zeros: score.dnf_zeros,
        perfect_bonus: score.perfect_bonus,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,event_id" },
    );
    if (scoreErr) return { ok: false, error: "DB", message: scoreErr.message };
    affectedUsers.add(userId);
  }

  // 7. Recompute streaks for every affected user, walking history in order.
  for (const userId of affectedUsers) {
    const err = await recomputeStreaksFor(svc, userId);
    if (err) return { ok: false, error: "DB", message: err };
  }

  return { ok: true, scoresUpdated: affectedUsers.size };
}

/**
 * Recompute a user's streak counters from their entire scoring history.
 * Re-running after the same event yields identical counters — so the whole
 * results → scores → streaks pipeline is truly idempotent.
 */
async function recomputeStreaksFor(
  svc: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: scores, error: scoresErr } = await svc
    .from("scores")
    .select("event_id, points, perfect_bonus")
    .eq("user_id", userId);
  if (scoresErr) return scoresErr.message;

  const eventIds = (scores ?? []).map((s) => s.event_id as string);
  if (eventIds.length === 0) {
    const { error } = await svc.from("user_streaks").upsert(
      {
        user_id: userId,
        current_p1_streak: 0,
        longest_p1_streak: 0,
        current_podium_streak: 0,
        total_perfect_podiums: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    return error?.message ?? null;
  }

  const [
    { data: events, error: evErr },
    { data: preds, error: predErr },
    { data: results, error: resErr },
  ] = await Promise.all([
    svc
      .from("events")
      .select("id, session_start_at")
      .in("id", eventIds),
    svc
      .from("predictions")
      .select("event_id, p1_driver_id")
      .eq("user_id", userId)
      .in("event_id", eventIds),
    svc
      .from("results")
      .select("event_id, p1_driver_id")
      .in("event_id", eventIds),
  ]);
  if (evErr) return evErr.message;
  if (predErr) return predErr.message;
  if (resErr) return resErr.message;

  const eventStart = new Map<string, number>();
  for (const e of events ?? [])
    eventStart.set(
      e.id as string,
      new Date(e.session_start_at as string).getTime(),
    );
  const predP1 = new Map<string, number>();
  for (const p of preds ?? [])
    predP1.set(p.event_id as string, Number(p.p1_driver_id));
  const resultP1 = new Map<string, number>();
  for (const r of results ?? [])
    resultP1.set(r.event_id as string, Number(r.p1_driver_id));

  const ordered = (scores ?? [])
    .map((s) => ({ ...s, ts: eventStart.get(s.event_id as string) ?? 0 }))
    .sort((a, b) => a.ts - b.ts);

  let current_p1 = 0;
  let longest_p1 = 0;
  let current_podium = 0;
  let perfect_count = 0;

  for (const s of ordered) {
    const eid = s.event_id as string;
    const p1Exact =
      predP1.get(eid) !== undefined &&
      resultP1.get(eid) !== undefined &&
      predP1.get(eid) === resultP1.get(eid);
    if (p1Exact) {
      current_p1 += 1;
      if (current_p1 > longest_p1) longest_p1 = current_p1;
    } else {
      current_p1 = 0;
    }
    current_podium = s.points > 0 ? current_podium + 1 : 0;
    if (s.perfect_bonus) perfect_count += 1;
  }

  const { error: upsertErr } = await svc.from("user_streaks").upsert(
    {
      user_id: userId,
      current_p1_streak: current_p1,
      longest_p1_streak: longest_p1,
      current_podium_streak: current_podium,
      total_perfect_podiums: perfect_count,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  return upsertErr?.message ?? null;
}
