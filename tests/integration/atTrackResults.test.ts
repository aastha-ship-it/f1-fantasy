import { beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { atTrackResultsFor } from "@/lib/jolpica/atTrackResults";
import { serviceClient } from "./helpers";

/**
 * Integration tests for the historical at-track {wins, podiums} aggregate.
 *
 * Uses dedicated fixture rows in seasons 9991/9992/9993 + driver id 901/902
 * so they don't collide with real seeded data. Cleaned up before each test.
 */

const TEST_SEASONS = [9991, 9992, 9993];
const TEST_DRIVER_IDS = [901, 902];
const TEST_CIRCUIT = "test_track";

async function reset() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    await sql`delete from public.historical_results where season in ${sql(TEST_SEASONS)}`;
    await sql`delete from public.historical_races where season in ${sql(TEST_SEASONS)}`;
    await sql`delete from public.drivers where id in ${sql(TEST_DRIVER_IDS)}`;
    await sql`
      insert into public.drivers (id, code, full_name, team, active)
      values
        (901, 'TST', 'Test Driver One', 'Test Team', false),
        (902, 'TS2', 'Test Driver Two', 'Test Team', false)
    `;
  } finally {
    await sql.end();
  }
}

describe("atTrackResultsFor", () => {
  beforeEach(async () => {
    await reset();
  });

  it("J7 · counts wins (P1) and podiums (P1–P3) at the given circuit within window", async () => {
    const svc = serviceClient();

    await svc.from("historical_races").insert([
      { season: 9991, round: 1, name: "Test 1", ergast_circuit_id: TEST_CIRCUIT, race_date: "9991-05-01" },
      { season: 9992, round: 1, name: "Test 2", ergast_circuit_id: TEST_CIRCUIT, race_date: "9992-05-01" },
      { season: 9993, round: 1, name: "Test 3", ergast_circuit_id: TEST_CIRCUIT, race_date: "9993-05-01" },
      { season: 9991, round: 2, name: "Other circuit", ergast_circuit_id: "other_track", race_date: "9991-06-01" },
    ]);
    await svc.from("historical_results").insert([
      // Driver 901: P1 (9991), P2 (9992), P4 (9993, no podium) at TEST_CIRCUIT
      { season: 9991, round: 1, session_kind: "race", driver_id: 901, position: 1, points: 25 },
      { season: 9992, round: 1, session_kind: "race", driver_id: 901, position: 2, points: 18 },
      { season: 9993, round: 1, session_kind: "race", driver_id: 901, position: 4, points: 12 },
      // Driver 901 P1 at OTHER track — must not count
      { season: 9991, round: 2, session_kind: "race", driver_id: 901, position: 1, points: 25 },
      // Driver 902 nothing on podium at TEST_CIRCUIT
      { season: 9991, round: 1, session_kind: "race", driver_id: 902, position: 5, points: 10 },
    ]);

    const r901 = await atTrackResultsFor(svc, 901, TEST_CIRCUIT, {
      windowYears: 5,
      asOfDate: "9994-01-01",
    });
    const r902 = await atTrackResultsFor(svc, 902, TEST_CIRCUIT, {
      windowYears: 5,
      asOfDate: "9994-01-01",
    });

    expect(r901).toEqual({ wins: 1, podiums: 2 });
    expect(r902).toEqual({ wins: 0, podiums: 0 });
  });

  it("J8 · excludes races on/after asOfDate so we don't count the upcoming race", async () => {
    const svc = serviceClient();

    await svc.from("historical_races").insert([
      { season: 9991, round: 1, name: "Past race", ergast_circuit_id: TEST_CIRCUIT, race_date: "9991-05-01" },
      { season: 9991, round: 2, name: "Future race", ergast_circuit_id: TEST_CIRCUIT, race_date: "9991-08-01" },
    ]);
    await svc.from("historical_results").insert([
      { season: 9991, round: 1, session_kind: "race", driver_id: 901, position: 1, points: 25 },
      { season: 9991, round: 2, session_kind: "race", driver_id: 901, position: 1, points: 25 },
    ]);

    const before = await atTrackResultsFor(svc, 901, TEST_CIRCUIT, {
      windowYears: 50,
      asOfDate: "9991-07-01",
    });
    expect(before).toEqual({ wins: 1, podiums: 1 });

    const all = await atTrackResultsFor(svc, 901, TEST_CIRCUIT, {
      windowYears: 50,
      asOfDate: "9999-01-01",
    });
    expect(all).toEqual({ wins: 2, podiums: 2 });
  });

  it("J7b · respects windowYears (older races outside the window are excluded)", async () => {
    const svc = serviceClient();

    await svc.from("historical_races").insert([
      { season: 9991, round: 1, name: "Old", ergast_circuit_id: TEST_CIRCUIT, race_date: "9991-05-01" },
      { season: 9993, round: 1, name: "Recent", ergast_circuit_id: TEST_CIRCUIT, race_date: "9993-05-01" },
    ]);
    await svc.from("historical_results").insert([
      { season: 9991, round: 1, session_kind: "race", driver_id: 901, position: 1, points: 25 },
      { season: 9993, round: 1, session_kind: "race", driver_id: 901, position: 2, points: 18 },
    ]);

    const narrow = await atTrackResultsFor(svc, 901, TEST_CIRCUIT, {
      windowYears: 1,
      asOfDate: "9994-01-01",
    });
    expect(narrow).toEqual({ wins: 0, podiums: 1 });

    const wide = await atTrackResultsFor(svc, 901, TEST_CIRCUIT, {
      windowYears: 10,
      asOfDate: "9994-01-01",
    });
    expect(wide).toEqual({ wins: 1, podiums: 2 });
  });

  it("J7c · returns null when no historical races at this circuit in the window (data missing)", async () => {
    const svc = serviceClient();

    // No historical_races rows at all for TEST_CIRCUIT.
    const r = await atTrackResultsFor(svc, 901, TEST_CIRCUIT, {
      windowYears: 10,
      asOfDate: "9994-01-01",
    });
    expect(r).toBeNull();
  });
});
