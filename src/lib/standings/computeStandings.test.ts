import { describe, it, expect } from "vitest";
import {
  pointsForPosition,
  computeDriverStandings,
  computeConstructorStandings,
  combineStandings,
  selectBackstopRows,
  isRaceFinisher,
} from "./computeStandings";

describe("pointsForPosition", () => {
  it("S1 · race podium: 25/18/15", () => {
    expect(pointsForPosition(1, false)).toBe(25);
    expect(pointsForPosition(2, false)).toBe(18);
    expect(pointsForPosition(3, false)).toBe(15);
  });

  it("S2 · race tail: 12/10/8/6/4/2/1, then 0", () => {
    expect(pointsForPosition(4, false)).toBe(12);
    expect(pointsForPosition(10, false)).toBe(1);
    expect(pointsForPosition(11, false)).toBe(0);
  });

  it("S3 · sprint scale: 8/7/6/5/4/3/2/1, P9+ = 0", () => {
    expect(pointsForPosition(1, true)).toBe(8);
    expect(pointsForPosition(8, true)).toBe(1);
    expect(pointsForPosition(9, true)).toBe(0);
  });

  it("S4 · null position (DNF) scores 0", () => {
    expect(pointsForPosition(null, false)).toBe(0);
    expect(pointsForPosition(null, true)).toBe(0);
  });
});

const DRIVERS = [
  { id: 1, code: "VER", full_name: "Max Verstappen", team: "Red Bull Racing" },
  { id: 16, code: "LEC", full_name: "Charles Leclerc", team: "Ferrari" },
  { id: 4, code: "NOR", full_name: "Lando Norris", team: "McLaren" },
  { id: 81, code: "PIA", full_name: "Oscar Piastri", team: "McLaren" },
];

describe("computeDriverStandings", () => {
  it("S5 · sums race + sprint points, sorts descending, breaks ties by driver_id", () => {
    const rows = [
      // Round 1 race
      { event_id: "r1", driver_id: 1, position: 1, is_sprint: false }, // 25
      { event_id: "r1", driver_id: 16, position: 2, is_sprint: false }, // 18
      { event_id: "r1", driver_id: 4, position: 3, is_sprint: false }, // 15
      { event_id: "r1", driver_id: 81, position: 4, is_sprint: false }, // 12
      // Round 2 sprint
      { event_id: "s2", driver_id: 4, position: 1, is_sprint: true }, // 8
      { event_id: "s2", driver_id: 1, position: 2, is_sprint: true }, // 7
      { event_id: "s2", driver_id: 81, position: 3, is_sprint: true }, // 6
    ];
    const standings = computeDriverStandings(rows, DRIVERS);
    expect(standings.map((s) => [s.driver.code, s.points])).toEqual([
      ["VER", 32],
      ["NOR", 23],
      ["LEC", 18],
      ["PIA", 18],
    ]);
  });

  it("S6 · empty input → empty array", () => {
    expect(computeDriverStandings([], DRIVERS)).toEqual([]);
  });
});

describe("combineStandings (Jolpica + OpenF1 backstop)", () => {
  it("J9 · sums Jolpica points + recomputed backstop points per driver", () => {
    // DRIVERS has VER=1, NOR=4. Jolpica round-1 totals already ingested.
    const jolpicaRows = [
      { driver_id: 1, points: 25 }, // VER
      { driver_id: 4, points: 18 }, // NOR
    ];
    // Backstop: round 2 race finished but Jolpica hasn't caught up.
    // session_classifications has VER P1, NOR P2.
    const backstopRows = [
      { event_id: "r2", driver_id: 1, position: 1, is_sprint: false },
      { event_id: "r2", driver_id: 4, position: 2, is_sprint: false },
    ];
    const result = combineStandings(jolpicaRows, backstopRows, DRIVERS);
    const verRow = result.drivers.find((s) => s.driver.code === "VER");
    const norRow = result.drivers.find((s) => s.driver.code === "NOR");
    expect(verRow?.points).toBe(50); // 25 + 25
    expect(norRow?.points).toBe(36); // 18 + 18
  });

  it("J9b · zero backstop rows → identical to Jolpica only", () => {
    const result = combineStandings(
      [{ driver_id: 1, points: 25 }],
      [],
      DRIVERS,
    );
    expect(result.drivers.map((s) => [s.driver.code, s.points])).toEqual([
      ["VER", 25],
    ]);
  });
});

describe("computeConstructorStandings", () => {
  it("S7 · aggregates teammate points by team", () => {
    const rows = [
      { event_id: "r1", driver_id: 4, position: 1, is_sprint: false }, // McLaren 25
      { event_id: "r1", driver_id: 81, position: 2, is_sprint: false }, // McLaren 18
      { event_id: "r1", driver_id: 1, position: 3, is_sprint: false }, // Red Bull 15
      { event_id: "r1", driver_id: 16, position: 4, is_sprint: false }, // Ferrari 12
    ];
    const standings = computeConstructorStandings(rows, DRIVERS);
    expect(standings.map((s) => [s.team, s.points])).toEqual([
      ["McLaren", 43],
      ["Red Bull Racing", 15],
      ["Ferrari", 12],
    ]);
  });

  it("S8 · empty input → empty array", () => {
    expect(computeConstructorStandings([], DRIVERS)).toEqual([]);
  });
});

describe("isRaceFinisher (Bug-002 regression — DNF over-count)", () => {
  // Real 2026 Jolpica statuses observed in `historical_results`.
  it("DNF1: 'Finished' is a finisher", () => {
    expect(isRaceFinisher("Finished")).toBe(true);
  });
  it("DNF2: 'Lapped' is a finisher (was over-counted as DNF pre-fix)", () => {
    expect(isRaceFinisher("Lapped")).toBe(true);
  });
  it("DNF3: legacy Ergast '+1 Lap' / '+2 Laps' are finishers", () => {
    expect(isRaceFinisher("+1 Lap")).toBe(true);
    expect(isRaceFinisher("+2 Laps")).toBe(true);
  });
  it("DNF4: 'Retired', 'Did not start', 'Disqualified' are NOT finishers", () => {
    expect(isRaceFinisher("Retired")).toBe(false);
    expect(isRaceFinisher("Did not start")).toBe(false);
    expect(isRaceFinisher("Disqualified")).toBe(false);
  });
  it("DNF5: null / empty / undefined → not a finisher (defensive)", () => {
    expect(isRaceFinisher(null)).toBe(false);
    expect(isRaceFinisher(undefined)).toBe(false);
    expect(isRaceFinisher("")).toBe(false);
  });
});

describe("selectBackstopRows (Bug-001 regression)", () => {
  // Two events at the same circuit (miami) — one race, one quali, etc. —
  // under our OpenF1 round 6. Jolpica has miami under round 4 (the
  // renumber-around-cancellations gap). Dedup key must be the circuit,
  // not the round.
  const eventsById = new Map([
    ["miami-race", {
      id: "miami-race", season: 2026, round: 6,
      session_type: "race" as const, ergast_circuit_id: "miami",
    }],
    ["miami-quali", {
      id: "miami-quali", season: 2026, round: 6,
      session_type: "quali" as const, ergast_circuit_id: "miami",
    }],
    ["miami-sprintr", {
      id: "miami-sprintr", season: 2026, round: 6,
      session_type: "sprint_race" as const, ergast_circuit_id: "miami",
    }],
    ["miami-sprintq", {
      id: "miami-sprintq", season: 2026, round: 6,
      session_type: "sprint_quali" as const, ergast_circuit_id: "miami",
    }],
    ["canada-race", {
      id: "canada-race", season: 2026, round: 7,
      session_type: "race" as const, ergast_circuit_id: "villeneuve",
    }],
    ["last-year-race", {
      id: "last-year-race", season: 2025, round: 1,
      session_type: "race" as const, ergast_circuit_id: "albert_park",
    }],
    ["circuitless-race", {
      id: "circuitless-race", season: 2026, round: 8,
      session_type: "race" as const, ergast_circuit_id: null,
    }],
  ]);

  it("SB1 · drops quali and sprint_quali rows (no F1 points awarded)", () => {
    const got = selectBackstopRows(
      [
        { event_id: "miami-race", driver_id: 12, position: 1 },
        { event_id: "miami-quali", driver_id: 12, position: 1 },
        { event_id: "miami-sprintr", driver_id: 12, position: 1 },
        { event_id: "miami-sprintq", driver_id: 12, position: 1 },
      ],
      eventsById,
      new Set<string>(),   // nothing ingested
      2026,
    );
    expect(got.map((r) => [r.event_id, r.is_sprint])).toEqual([
      ["miami-race", false],
      ["miami-sprintr", true],
    ]);
  });

  it("SB2 · drops events whose ergast_circuit_id is already in ingestedCircuits (Bug-B)", () => {
    const got = selectBackstopRows(
      [
        { event_id: "miami-race", driver_id: 12, position: 1 },
        { event_id: "canada-race", driver_id: 12, position: 1 },
      ],
      eventsById,
      new Set(["miami"]),  // Miami is in Jolpica (under whatever round number)
      2026,
    );
    expect(got.map((r) => r.event_id)).toEqual(["canada-race"]);
  });

  it("SB3 · keeps non-ingested events; null circuit_id is allowed through", () => {
    const got = selectBackstopRows(
      [
        { event_id: "canada-race", driver_id: 12, position: 2 },
        { event_id: "circuitless-race", driver_id: 12, position: 3 },
      ],
      eventsById,
      new Set(["miami"]),
      2026,
    );
    expect(got.map((r) => r.event_id)).toEqual([
      "canada-race",
      "circuitless-race",
    ]);
  });

  it("SB4 · drops other-season events and unknown event_ids", () => {
    const got = selectBackstopRows(
      [
        { event_id: "last-year-race", driver_id: 12, position: 1 },
        { event_id: "unknown-id", driver_id: 12, position: 1 },
        { event_id: "miami-race", driver_id: 12, position: 1 },
      ],
      eventsById,
      new Set<string>(),
      2026,
    );
    expect(got.map((r) => r.event_id)).toEqual(["miami-race"]);
  });
});
