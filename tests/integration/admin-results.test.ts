import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  createTestEvent,
  createTestUser,
  ensureTestDrivers,
  resetTestData,
  serviceClient,
} from "./helpers";
import { writeResultsWith } from "@/lib/writeResults";

/**
 * Phase 3 — results + scoring pipeline.
 *
 *   I9  non-admin call → ADMIN_REQUIRED
 *   I10 admin call → results row + scores + streaks populated.
 *        Includes an idempotency re-run on the same inputs.
 */

beforeEach(async () => {
  await resetTestData();
  await ensureTestDrivers();
});

afterAll(async () => {
  await resetTestData();
});

async function plantPrediction(opts: {
  userClient: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
  eventId: string;
  pick: { p1: number; p2: number | null; p3: number | null };
}) {
  const { error } = await opts.userClient.from("predictions").insert({
    user_id: opts.userId,
    event_id: opts.eventId,
    p1_driver_id: opts.pick.p1,
    p2_driver_id: opts.pick.p2,
    p3_driver_id: opts.pick.p3,
  });
  expect(error, `plant prediction for ${opts.userId}`).toBeNull();
}

async function movePastLock(eventId: string) {
  // Shift session_start_at to the past; the events_set_lock_at_trg trigger
  // will recompute lock_at = start - 5s. That lets the event be "completed"
  // without having to wait real time in tests.
  const svc = serviceClient();
  const past = new Date(Date.now() - 60_000).toISOString();
  const { error } = await svc
    .from("events")
    .update({ session_start_at: past })
    .eq("id", eventId);
  expect(error).toBeNull();
}

describe("writeResults", () => {
  it("I9 · non-admin call → ADMIN_REQUIRED", async () => {
    const user = await createTestUser("alice");
    const event = await createTestEvent({ lockInFuture: true });
    const svc = serviceClient();

    const result = await writeResultsWith(user.client, svc, {
      eventId: event.id,
      p1: 901,
      p2: 902,
      p3: 903,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("ADMIN_REQUIRED");
  });

  it("I10 · admin writes results → results + scores + streaks populated, idempotent", async () => {
    const svc = serviceClient();
    const admin = await createTestUser("admin");
    await svc.from("admins").insert({ user_id: admin.id });

    const alice = await createTestUser("alice");
    const bob = await createTestUser("bob");
    const event = await createTestEvent({ lockInFuture: true });

    // Alice predicts perfectly; Bob picks the right drivers in wrong slots.
    await plantPrediction({
      userClient: alice.client,
      userId: alice.id,
      eventId: event.id,
      pick: { p1: 901, p2: 902, p3: 903 },
    });
    await plantPrediction({
      userClient: bob.client,
      userId: bob.id,
      eventId: event.id,
      pick: { p1: 902, p2: 903, p3: 901 },
    });

    // Time-warp the event so it's "completed".
    await movePastLock(event.id);

    // Admin writes actual results.
    const first = await writeResultsWith(admin.client, svc, {
      eventId: event.id,
      p1: 901,
      p2: 902,
      p3: 903,
    });
    expect(first.ok, JSON.stringify(first)).toBe(true);

    // results row exists with expected values.
    const { data: results } = await svc
      .from("results")
      .select("p1_driver_id, p2_driver_id, p3_driver_id")
      .eq("event_id", event.id)
      .single();
    expect(results).toEqual({
      p1_driver_id: 901,
      p2_driver_id: 902,
      p3_driver_id: 903,
    });

    // scores rows for both users.
    const { data: scores } = await svc
      .from("scores")
      .select("user_id, points, exact_matches, slot_mismatches, dnf_zeros, perfect_bonus")
      .eq("event_id", event.id);
    const byUser = new Map(
      (scores ?? []).map((s) => [s.user_id as string, s]),
    );

    expect(byUser.get(alice.id)).toEqual({
      user_id: alice.id,
      points: 18,
      exact_matches: 3,
      slot_mismatches: 0,
      dnf_zeros: 0,
      perfect_bonus: true,
    });
    expect(byUser.get(bob.id)).toEqual({
      user_id: bob.id,
      points: 6,
      exact_matches: 0,
      slot_mismatches: 3,
      dnf_zeros: 0,
      perfect_bonus: false,
    });

    // streaks: Alice perfect podium, Bob podium-but-no-P1.
    const { data: streaks } = await svc
      .from("user_streaks")
      .select(
        "user_id, current_p1_streak, longest_p1_streak, current_podium_streak, total_perfect_podiums",
      );
    const sByUser = new Map(
      (streaks ?? []).map((s) => [s.user_id as string, s]),
    );
    expect(sByUser.get(alice.id)).toEqual({
      user_id: alice.id,
      current_p1_streak: 1,
      longest_p1_streak: 1,
      current_podium_streak: 1,
      total_perfect_podiums: 1,
    });
    expect(sByUser.get(bob.id)).toEqual({
      user_id: bob.id,
      current_p1_streak: 0,
      longest_p1_streak: 0,
      current_podium_streak: 1,
      total_perfect_podiums: 0,
    });

    // Idempotency: re-running the same inputs doesn't create extra rows
    // and produces identical score values.
    const second = await writeResultsWith(admin.client, svc, {
      eventId: event.id,
      p1: 901,
      p2: 902,
      p3: 903,
    });
    expect(second.ok).toBe(true);

    const { count: resultsCount } = await svc
      .from("results")
      .select("event_id", { count: "exact", head: true })
      .eq("event_id", event.id);
    expect(resultsCount).toBe(1);

    const { count: scoresCount } = await svc
      .from("scores")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    expect(scoresCount).toBe(2);
  });

  it("I10b · sprint event scores P1 only, other slots rejected as VALIDATION", async () => {
    const svc = serviceClient();
    const admin = await createTestUser("admin");
    await svc.from("admins").insert({ user_id: admin.id });

    const alice = await createTestUser("alice");
    const event = await createTestEvent({
      lockInFuture: true,
      sessionType: "sprint_race",
    });

    await plantPrediction({
      userClient: alice.client,
      userId: alice.id,
      eventId: event.id,
      pick: { p1: 901, p2: null, p3: null },
    });

    await movePastLock(event.id);

    // Supplying p2/p3 to a sprint should be rejected before any DB write.
    const bad = await writeResultsWith(admin.client, svc, {
      eventId: event.id,
      p1: 901,
      p2: 902,
      p3: null,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe("VALIDATION");

    // Correct sprint shape works.
    const ok = await writeResultsWith(admin.client, svc, {
      eventId: event.id,
      p1: 901,
      p2: null,
      p3: null,
    });
    expect(ok.ok).toBe(true);

    const { data: score } = await svc
      .from("scores")
      .select("points, exact_matches")
      .eq("event_id", event.id)
      .eq("user_id", alice.id)
      .single();
    expect(score).toEqual({ points: 5, exact_matches: 1 });
  });
});
