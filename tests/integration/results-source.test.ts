import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  createTestEvent,
  ensureTestDrivers,
  resetTestData,
  serviceClient,
} from "./helpers";
import { writeResultsService } from "@/lib/writeResults";

/**
 * changes.md §7 — results.source + freeze rule.
 *
 *   S1 openf1 write stamps source='openf1'
 *   S2 admin write stamps source='admin'
 *   S3 openf1 fetch is frozen when the existing row is source='admin'
 *   S4 openf1 fetch is frozen when the event is revealed
 *   S5 openf1 fetch DOES refresh an unrevealed source='openf1' row
 *
 * Regression-tracked (results pipeline change).
 */

beforeEach(async () => {
  await resetTestData();
  await ensureTestDrivers();
});

afterAll(async () => {
  await resetTestData();
});

const PODIUM_A = { p1: 901, p2: 902, p3: 903 };
const PODIUM_B = { p1: 902, p2: 901, p3: 903 };

async function readResult(eventId: string) {
  const svc = serviceClient();
  const { data } = await svc
    .from("results")
    .select("p1_driver_id, p2_driver_id, p3_driver_id, source")
    .eq("event_id", eventId)
    .single();
  return data;
}

describe("results.source + freeze", () => {
  it("S1 · openf1 write stamps source='openf1'", async () => {
    const svc = serviceClient();
    const event = await createTestEvent({ lockInFuture: false });
    const r = await writeResultsService(svc, {
      eventId: event.id,
      ...PODIUM_A,
    });
    expect(r.ok).toBe(true);
    expect((await readResult(event.id))?.source).toBe("openf1");
  });

  it("S2 · admin write stamps source='admin'", async () => {
    const svc = serviceClient();
    const event = await createTestEvent({ lockInFuture: false });
    const r = await writeResultsService(
      svc,
      { eventId: event.id, ...PODIUM_A },
      "admin",
    );
    expect(r.ok).toBe(true);
    expect((await readResult(event.id))?.source).toBe("admin");
  });

  it("S3 · openf1 fetch is frozen when existing row is admin", async () => {
    const svc = serviceClient();
    const event = await createTestEvent({ lockInFuture: false });
    await writeResultsService(svc, { eventId: event.id, ...PODIUM_A }, "admin");

    const r = await writeResultsService(
      svc,
      { eventId: event.id, ...PODIUM_B },
      "openf1",
    );
    expect(r).toEqual({ ok: true, scoresUpdated: 0, frozen: true });

    const row = await readResult(event.id);
    expect(row?.source).toBe("admin");
    expect(row?.p1_driver_id).toBe(PODIUM_A.p1); // unchanged
  });

  it("S4 · openf1 fetch is frozen when the event is revealed", async () => {
    const svc = serviceClient();
    const event = await createTestEvent({ lockInFuture: false });
    await writeResultsService(svc, { eventId: event.id, ...PODIUM_A }, "openf1");
    await svc
      .from("events")
      .update({ revealed_at: new Date().toISOString() })
      .eq("id", event.id);

    const r = await writeResultsService(
      svc,
      { eventId: event.id, ...PODIUM_B },
      "openf1",
    );
    expect(r).toEqual({ ok: true, scoresUpdated: 0, frozen: true });
    expect((await readResult(event.id))?.p1_driver_id).toBe(PODIUM_A.p1);
  });

  it("S5 · openf1 fetch refreshes an unrevealed source='openf1' row", async () => {
    const svc = serviceClient();
    const event = await createTestEvent({ lockInFuture: false });
    await writeResultsService(svc, { eventId: event.id, ...PODIUM_A }, "openf1");

    const r = await writeResultsService(
      svc,
      { eventId: event.id, ...PODIUM_B },
      "openf1",
    );
    expect(r.ok).toBe(true);
    expect("frozen" in r && r.frozen).toBeFalsy();

    const row = await readResult(event.id);
    expect(row?.source).toBe("openf1");
    expect(row?.p1_driver_id).toBe(PODIUM_B.p1); // refreshed
  });
});
