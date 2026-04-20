import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  createTestEvent,
  createTestUser,
  ensureTestDrivers,
  resetTestData,
  serviceClient,
} from "./helpers";
import { revealEventWith } from "@/lib/revealEvent";
import postgres from "postgres";

/**
 * Phase 4 — reveal pipeline.
 *
 *   R1 admin reveal → events.revealed_at set to now()
 *   R2 non-admin → ADMIN_REQUIRED, revealed_at stays null
 *   R3 10-min results fallback → even without explicit reveal, RLS opens
 *       predictions to other users when results are older than 10 minutes
 */

beforeEach(async () => {
  await resetTestData();
  await ensureTestDrivers();
});

afterAll(async () => {
  await resetTestData();
});

describe("revealEvent", () => {
  it("R1 · admin sets events.revealed_at to now()", async () => {
    const svc = serviceClient();
    const admin = await createTestUser("admin");
    await svc.from("admins").insert({ user_id: admin.id });
    const event = await createTestEvent({ lockInFuture: true });

    const before = await svc
      .from("events")
      .select("revealed_at")
      .eq("id", event.id)
      .single();
    expect(before.data?.revealed_at).toBeNull();

    const result = await revealEventWith(admin.client, svc, {
      eventId: event.id,
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);

    const after = await svc
      .from("events")
      .select("revealed_at")
      .eq("id", event.id)
      .single();
    expect(after.data?.revealed_at).not.toBeNull();
    // Fresh timestamp, within last 10 seconds
    const revealedAtMs = new Date(after.data!.revealed_at as string).getTime();
    expect(Date.now() - revealedAtMs).toBeLessThan(10_000);
  });

  it("R2 · non-admin → ADMIN_REQUIRED, revealed_at stays null", async () => {
    const svc = serviceClient();
    const regular = await createTestUser("regular");
    const event = await createTestEvent({ lockInFuture: true });

    const result = await revealEventWith(regular.client, svc, {
      eventId: event.id,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("ADMIN_REQUIRED");

    const after = await svc
      .from("events")
      .select("revealed_at")
      .eq("id", event.id)
      .single();
    expect(after.data?.revealed_at).toBeNull();
  });
});

describe("RLS · 10-minute results fallback", () => {
  it("R3 · results older than 10m open predictions to others even without admin trigger", async () => {
    const svc = serviceClient();
    const alice = await createTestUser("alice");
    const bob = await createTestUser("bob");
    const event = await createTestEvent({ lockInFuture: true });

    // Both users plant predictions via their own sessions (lock is still future).
    for (const u of [alice, bob]) {
      await u.client.from("predictions").insert({
        user_id: u.id,
        event_id: event.id,
        p1_driver_id: 901,
        p2_driver_id: 902,
        p3_driver_id: 903,
      });
    }

    // Insert a results row with fetched_at backdated 11 minutes.
    // The RLS policy compares against results.fetched_at < now() - interval '10 minutes'.
    // We go through raw SQL because the supabase-js upsert stamps fetched_at server-side.
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    try {
      await sql`
        insert into public.results (event_id, p1_driver_id, p2_driver_id, p3_driver_id, fetched_at)
        values (${event.id}, 901, 902, 903, now() - interval '11 minutes')
      `;
    } finally {
      await sql.end();
    }

    // revealed_at is still null. With the 10-min fallback, Alice should see Bob's pick.
    const { data: eventRow } = await svc
      .from("events")
      .select("revealed_at")
      .eq("id", event.id)
      .single();
    expect(eventRow?.revealed_at).toBeNull();

    const { data } = await alice.client
      .from("predictions")
      .select("user_id")
      .eq("event_id", event.id);
    expect(data).toHaveLength(2);
  });
});
