import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  createTestEvent,
  createTestUser,
  ensureTestDrivers,
  resetTestData,
  serviceClient,
} from "./helpers";

/**
 * RLS integration suite — I6, I7, I8 from the 29-path plan.
 *
 * Runs against local Supabase (`supabase start`). Each test resets state
 * via resetTestData() to avoid cross-contamination.
 */

beforeEach(async () => {
  await resetTestData();
  await ensureTestDrivers();
});

afterAll(async () => {
  await resetTestData();
});

describe("RLS — predictions visibility", () => {
  it("I6 · User A cannot SELECT User B's predictions pre-reveal", async () => {
    const userA = await createTestUser("alice");
    const userB = await createTestUser("bob");
    const event = await createTestEvent({ lockInFuture: true });

    // Both users submit picks via their own sessions (satisfies insert policy + lock trigger).
    for (const u of [userA, userB]) {
      const { error } = await u.client.from("predictions").insert({
        user_id: u.id,
        event_id: event.id,
        p1_driver_id: 901,
        p2_driver_id: 902,
        p3_driver_id: 903,
      });
      expect(error, `insert pick for ${u.email}`).toBeNull();
    }

    // User A queries predictions — should only see own row.
    const { data: visible, error } = await userA.client
      .from("predictions")
      .select("user_id");
    expect(error).toBeNull();
    expect(visible).toHaveLength(1);
    expect(visible![0].user_id).toBe(userA.id);
  });

  it("I7 · after reveal, User A sees User B's predictions", async () => {
    const userA = await createTestUser("alice");
    const userB = await createTestUser("bob");
    const event = await createTestEvent({ lockInFuture: true });

    for (const u of [userA, userB]) {
      await u.client.from("predictions").insert({
        user_id: u.id,
        event_id: event.id,
        p1_driver_id: 901,
        p2_driver_id: 902,
        p3_driver_id: 903,
      });
    }

    // Admin triggers the reveal (service role writes events.revealed_at).
    // Set 60 seconds in the past to avoid any host/container clock skew
    // interacting with the `now() >= e.revealed_at` RLS check.
    const svc = serviceClient();
    const revealedAt = new Date(Date.now() - 60_000).toISOString();
    const { error: updErr } = await svc
      .from("events")
      .update({ revealed_at: revealedAt })
      .eq("id", event.id);
    expect(updErr).toBeNull();

    // User A queries — should now see both rows.
    const { data, error } = await userA.client
      .from("predictions")
      .select("user_id")
      .eq("event_id", event.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    const userIds = data!.map((r) => r.user_id).sort();
    expect(userIds).toEqual([userA.id, userB.id].sort());
  });
});

describe("RLS — admin privilege escalation", () => {
  it("I8 · no is_admin column on users (regression guard)", async () => {
    // The plan forbids `users.is_admin` — admin-by-column-on-users is a
    // known Supabase RLS footgun (policy self-reference → recursion).
    // Querying a missing column via PostgREST returns 42703 (undefined column).
    const svc = serviceClient();
    const { error } = await svc.from("users").select("is_admin").limit(1);
    expect(error, "users.is_admin must not exist").not.toBeNull();
    expect(String(error?.message ?? "").toLowerCase()).toContain("is_admin");
  });

  it("I8b · user cannot INSERT into admins (only service role can)", async () => {
    const userA = await createTestUser("alice");
    const { error } = await userA.client.from("admins").insert({
      user_id: userA.id,
    });
    // RLS has no INSERT policy for admins → insert must fail.
    expect(error).not.toBeNull();
  });

  it("I8c · user cannot UPDATE admins row via session (no policy allows it)", async () => {
    const userA = await createTestUser("alice");
    // Seed admins via service role first.
    const svc = serviceClient();
    const { error: seedErr } = await svc
      .from("admins")
      .insert({ user_id: userA.id });
    expect(seedErr).toBeNull();

    // Attempt update as the user — no UPDATE policy → 0 rows affected.
    const { data, error } = await userA.client
      .from("admins")
      .update({ granted_at: new Date(0).toISOString() })
      .eq("user_id", userA.id)
      .select();
    expect(error).toBeNull(); // RLS returns empty, not an error
    expect(data).toEqual([]);
  });
});
