import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { backfillSeason } from "./backfillResults";
import type {
  ErgastQualifyingRow,
  ErgastRace,
  ErgastResultRow,
} from "./types";

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeRaceRow(driverId: string, position: string, points: string): ErgastResultRow {
  return {
    number: "1",
    position,
    positionText: position,
    points,
    grid: "1",
    laps: "57",
    status: "Finished",
    Driver: { driverId, givenName: driverId, familyName: driverId.toUpperCase() },
    Constructor: { constructorId: "x", name: "X" },
  };
}

function makeRace(
  round: string,
  results: ErgastResultRow[],
  sprint?: ErgastResultRow[],
  qualifying?: ErgastQualifyingRow[],
): ErgastRace {
  return {
    season: "2024",
    round,
    raceName: `Round ${round} GP`,
    date: `2024-03-${String(Number(round) * 7).padStart(2, "0")}`,
    Circuit: {
      circuitId: round === "1" ? "bahrain" : "miami",
      circuitName: round === "1" ? "Bahrain" : "Miami",
    },
    Results: results,
    SprintResults: sprint,
    QualifyingResults: qualifying,
  };
}

function makeQualiRow(
  driverId: string,
  position: string,
  reachedQ3 = true,
): ErgastQualifyingRow {
  return {
    number: "1",
    position,
    Driver: { driverId, givenName: driverId, familyName: driverId.toUpperCase() },
    Constructor: { constructorId: "x", name: "X" },
    Q1: "1:30.000",
    Q2: reachedQ3 ? "1:29.000" : undefined,
    Q3: reachedQ3 ? "1:28.000" : undefined,
  };
}

const EMPTY_QUALI_PAGE = {
  MRData: {
    limit: "100",
    offset: "0",
    total: "0",
    RaceTable: { season: "2024", Races: [] },
  },
};

function makeFakeSvc(driversByErgast: Record<string, number>) {
  const racesUpserted: { season: number; round: number; ergast_circuit_id: string }[] = [];
  const resultsUpserted: {
    season: number;
    round: number;
    session_kind: string;
    driver_id: number;
    points: number;
    fastest_lap?: boolean;
    position?: number | null;
    status?: string;
  }[] = [];

  return {
    racesUpserted,
    resultsUpserted,
    client: {
      from(table: string) {
        if (table === "drivers") {
          return {
            select() {
              return {
                not() {
                  return Promise.resolve({
                    data: Object.entries(driversByErgast).map(([ergast_id, id]) => ({
                      id,
                      ergast_id,
                    })),
                    error: null,
                  });
                },
              };
            },
          };
        }
        if (table === "historical_races") {
          return {
            upsert(rows: { season: number; round: number; ergast_circuit_id: string }[]) {
              racesUpserted.push(...rows);
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === "historical_results") {
          return {
            upsert(
              rows: {
                season: number;
                round: number;
                session_kind: string;
                driver_id: number;
                points: number;
                fastest_lap?: boolean;
                position?: number | null;
                status?: string;
              }[],
            ) {
              resultsUpserted.push(...rows);
              return Promise.resolve({ error: null });
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as Parameters<typeof backfillSeason>[0],
  };
}

describe("backfillSeason", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("J5 · UPSERTs historical_races + historical_results from race + sprint endpoints", async () => {
    // Race endpoint: 2 races, with full results
    fetchSpy.mockResolvedValueOnce(
      jsonOk({
        MRData: {
          limit: "100",
          offset: "0",
          total: "4", // 2 races × 2 drivers per race for the sake of test
          RaceTable: {
            season: "2024",
            Races: [
              makeRace("1", [
                makeRaceRow("max_verstappen", "1", "25"),
                makeRaceRow("norris", "2", "18"),
              ]),
              makeRace("2", [
                makeRaceRow("norris", "1", "25"),
                makeRaceRow("max_verstappen", "2", "18"),
              ]),
            ],
          },
        },
      }),
    );
    // Sprint endpoint: 1 sprint at round 2
    fetchSpy.mockResolvedValueOnce(
      jsonOk({
        MRData: {
          limit: "100",
          offset: "0",
          total: "2",
          RaceTable: {
            season: "2024",
            Races: [
              makeRace(
                "2",
                [],
                [makeRaceRow("max_verstappen", "1", "8")],
              ),
            ],
          },
        },
      }),
    );
    // Qualifying endpoint — empty for this test.
    fetchSpy.mockResolvedValueOnce(jsonOk(EMPTY_QUALI_PAGE));

    const fake = makeFakeSvc({ max_verstappen: 3, norris: 1 });
    const summary = await backfillSeason(fake.client, 2024);

    expect(summary).toMatchObject({
      season: 2024,
      races: 2,
      raceResults: 4,
      sprintResults: 1,
      qualifyingResults: 0,
    });
    expect(fake.racesUpserted).toHaveLength(2);
    expect(fake.racesUpserted[0]).toMatchObject({
      season: 2024,
      round: 1,
      ergast_circuit_id: "bahrain",
    });
    expect(fake.resultsUpserted).toHaveLength(5); // 4 race + 1 sprint
    const sprintRow = fake.resultsUpserted.find((r) => r.session_kind === "sprint");
    expect(sprintRow).toMatchObject({
      driver_id: 3,
      points: 8,
      session_kind: "sprint",
    });
  });

  it("J6 · skips drivers without ergast_id mapping (e.g., reserve drivers we don't track)", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonOk({
        MRData: {
          limit: "100",
          offset: "0",
          total: "2",
          RaceTable: {
            season: "2024",
            Races: [
              makeRace("1", [
                makeRaceRow("max_verstappen", "1", "25"),
                makeRaceRow("doohan", "20", "0"), // not in our drivers table
              ]),
            ],
          },
        },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      jsonOk({
        MRData: {
          limit: "100",
          offset: "0",
          total: "0",
          RaceTable: { season: "2024", Races: [] },
        },
      }),
    );
    // Qualifying endpoint — empty for this test.
    fetchSpy.mockResolvedValueOnce(jsonOk(EMPTY_QUALI_PAGE));

    const fake = makeFakeSvc({ max_verstappen: 3 });
    const summary = await backfillSeason(fake.client, 2024);

    expect(summary.raceResults).toBe(1); // only Verstappen written
    expect(summary.unmappedDriverIds).toContain("doohan");
    expect(fake.resultsUpserted.every((r) => r.driver_id === 3)).toBe(true);
  });

  it("J5c · captures fastest_lap from race FastestLap.rank=1", async () => {
    const verRow = makeRaceRow("max_verstappen", "1", "25");
    verRow.FastestLap = { rank: "2", lap: "47" };
    const norRow = makeRaceRow("norris", "2", "18");
    norRow.FastestLap = { rank: "1", lap: "47", Time: { time: "1:29.284" } };
    fetchSpy.mockResolvedValueOnce(
      jsonOk({
        MRData: {
          limit: "100",
          offset: "0",
          total: "2",
          RaceTable: {
            season: "2024",
            Races: [makeRace("1", [verRow, norRow])],
          },
        },
      }),
    );
    fetchSpy.mockResolvedValueOnce(jsonOk(EMPTY_QUALI_PAGE));
    fetchSpy.mockResolvedValueOnce(jsonOk(EMPTY_QUALI_PAGE));

    const fake = makeFakeSvc({ max_verstappen: 3, norris: 1 });
    const summary = await backfillSeason(fake.client, 2024);

    expect(summary.fastestLaps).toBe(1);
    const flRow = fake.resultsUpserted.find((r) => r.fastest_lap === true);
    expect(flRow).toBeDefined();
    expect(flRow!.driver_id).toBe(1); // Norris
  });

  it("J5d · ingests qualifying as session_kind='qualifying' with pole=position 1", async () => {
    fetchSpy.mockResolvedValueOnce(jsonOk(EMPTY_QUALI_PAGE));
    fetchSpy.mockResolvedValueOnce(jsonOk(EMPTY_QUALI_PAGE));
    fetchSpy.mockResolvedValueOnce(
      jsonOk({
        MRData: {
          limit: "100",
          offset: "0",
          total: "2",
          RaceTable: {
            season: "2024",
            Races: [
              makeRace(
                "1",
                [],
                undefined,
                [
                  makeQualiRow("max_verstappen", "1", true),
                  makeQualiRow("norris", "2", true),
                ],
              ),
            ],
          },
        },
      }),
    );

    const fake = makeFakeSvc({ max_verstappen: 3, norris: 1 });
    const summary = await backfillSeason(fake.client, 2024);

    expect(summary.qualifyingResults).toBe(2);
    const poleRow = fake.resultsUpserted.find(
      (r) => r.session_kind === "qualifying" && r.position === 1,
    );
    expect(poleRow).toBeDefined();
    expect(poleRow!.driver_id).toBe(3); // Verstappen
    expect(poleRow!.status).toBe("Q3");
  });
});
