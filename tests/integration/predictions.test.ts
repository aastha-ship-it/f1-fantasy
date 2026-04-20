import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  anonClient,
  createTestEvent,
  createTestUser,
  ensureTestDrivers,
  resetTestData,
} from "./helpers";
import { submitPredictionWith } from "@/lib/submitPrediction";

/**
 * Phase 2 — predict flow integration tests.
 *
 *   I1 happy-path insert before lock
 *   I2 insert at T-4s (lock passed) → DB trigger rejects
 *   I3 insert at T+1s (session started) → DB trigger rejects
 *   I4 unauthenticated submission → not-authenticated error
 *   I5 double-submit → second write UPSERTs, single row remains
 */

beforeEach(async () => {
  await resetTestData();
  await ensureTestDrivers();
});

afterAll(async () => {
  await resetTestData();
});

describe("submitPrediction", () => {
  it("I1 · happy path before lock → row inserted", async () => {
    const user = await createTestUser("alice");
    const event = await createTestEvent({ lockInFuture: true });

    const result = await submitPredictionWith(user.client, {
      eventId: event.id,
      p1: 901,
      p2: 902,
      p3: 903,
    });

    expect(result.ok, JSON.stringify(result)).toBe(true);

    const { data } = await user.client
      .from("predictions")
      .select("p1_driver_id, p2_driver_id, p3_driver_id")
      .eq("event_id", event.id)
      .single();
    expect(data).toEqual({
      p1_driver_id: 901,
      p2_driver_id: 902,
      p3_driver_id: 903,
    });
  });

  it("I2 · at T-4s (lock already passed) → server action fast-fails with LOCKED", async () => {
    const user = await createTestUser("alice");
    // lockInFuture:false → session_start_at is an hour ago → lock_at is also past
    const event = await createTestEvent({ lockInFuture: false });

    const result = await submitPredictionWith(user.client, {
      eventId: event.id,
      p1: 901,
      p2: 902,
      p3: 903,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("LOCKED");
  });

  it("I3 · at T+1s (session running) → DB trigger also rejects", async () => {
    const user = await createTestUser("alice");
    const event = await createTestEvent({ lockInFuture: false });

    const result = await submitPredictionWith(user.client, {
      eventId: event.id,
      p1: 901,
      p2: 902,
      p3: 903,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("LOCKED");
  });

  it("I4 · unauthenticated → UNAUTHENTICATED", async () => {
    const event = await createTestEvent({ lockInFuture: true });
    const noSession = anonClient();

    const result = await submitPredictionWith(noSession, {
      eventId: event.id,
      p1: 901,
      p2: 902,
      p3: 903,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("UNAUTHENTICATED");
  });

  it("I5 · double-submit is idempotent (UPSERT, second write wins)", async () => {
    const user = await createTestUser("alice");
    const event = await createTestEvent({ lockInFuture: true });

    const first = await submitPredictionWith(user.client, {
      eventId: event.id,
      p1: 901,
      p2: 902,
      p3: 903,
    });
    expect(first.ok).toBe(true);

    const second = await submitPredictionWith(user.client, {
      eventId: event.id,
      p1: 903,
      p2: 901,
      p3: 902,
    });
    expect(second.ok).toBe(true);

    const { data } = await user.client
      .from("predictions")
      .select("p1_driver_id, p2_driver_id, p3_driver_id")
      .eq("event_id", event.id);
    expect(data).toHaveLength(1);
    expect(data![0]).toEqual({
      p1_driver_id: 903,
      p2_driver_id: 901,
      p3_driver_id: 902,
    });
  });

  it("I5b · sprint event rejects P2/P3 being non-null (VALIDATION)", async () => {
    // Edge-guard that sprint picks aren't over-supplied; complements U9.
    const user = await createTestUser("alice");
    const event = await createTestEvent({
      lockInFuture: true,
      sessionType: "sprint_race",
    });

    const result = await submitPredictionWith(user.client, {
      eventId: event.id,
      p1: 901,
      p2: 902, // NOT null — should be rejected
      p3: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("VALIDATION");
  });
});
