import type { SupabaseClient } from "@supabase/supabase-js";
import { jolpicaPaginated } from "./client";
import type {
  ErgastQualifyingRow,
  ErgastRace,
  ErgastResultRow,
  RaceTablePayload,
} from "./types";

/**
 * Pull a season's race + sprint classifications from Jolpica and UPSERT into
 * `historical_races` + `historical_results`. Idempotent.
 *
 * Drivers absent from `drivers.ergast_id` (reserves, junior-team one-offs)
 * are skipped — their finishes don't land in our standings/career stats. The
 * summary records their ergast IDs so the operator can decide whether to
 * widen the active-driver list.
 *
 * Bulk endpoints used:
 *   GET /{season}/results/?limit=100   — race classifications, paginated
 *   GET /{season}/sprint/?limit=100    — sprint classifications, paginated
 */

export type BackfillSeasonSummary = {
  season: number;
  races: number;
  raceResults: number;
  sprintResults: number;
  qualifyingResults: number;
  fastestLaps: number;
  unmappedDriverIds: string[];
};

type ResultRow = {
  season: number;
  round: number;
  session_kind: "race" | "sprint" | "qualifying";
  driver_id: number;
  position: number | null;
  points: number;
  grid: number | null;
  status: string;
  fastest_lap: boolean;
};

function safeIntOrNull(s: string): number | null {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

async function loadDriverErgastMap(
  svc: SupabaseClient,
): Promise<Map<string, number>> {
  const { data, error } = await svc
    .from("drivers")
    .select("id, ergast_id")
    .not("ergast_id", "is", null);
  if (error) throw error;
  const out = new Map<string, number>();
  for (const r of (data ?? []) as { id: number; ergast_id: string }[]) {
    out.set(r.ergast_id, r.id);
  }
  return out;
}

function projectResults(
  race: ErgastRace,
  rows: ErgastResultRow[] | undefined,
  sessionKind: "race" | "sprint",
  driverIdByErgast: Map<string, number>,
  unmapped: Set<string>,
): {
  upsertable: ResultRow[];
} {
  const out: ResultRow[] = [];
  if (!rows) return { upsertable: out };
  const season = Number(race.season);
  const round = Number(race.round);
  for (const r of rows) {
    const ourId = driverIdByErgast.get(r.Driver.driverId);
    if (ourId === undefined) {
      unmapped.add(r.Driver.driverId);
      continue;
    }
    // Fastest lap is only meaningful on the race row — Jolpica's `FastestLap.rank`
    // is "1" for the driver who set the race's fastest lap. Sprint results
    // omit FastestLap entirely.
    const isFastestLap =
      sessionKind === "race" &&
      r.FastestLap !== undefined &&
      r.FastestLap.rank === "1";
    out.push({
      season,
      round,
      session_kind: sessionKind,
      driver_id: ourId,
      position: safeIntOrNull(r.position),
      points: Number.parseFloat(r.points) || 0,
      grid: safeIntOrNull(r.grid),
      status: r.status,
      fastest_lap: isFastestLap,
    });
  }
  return { upsertable: out };
}

/**
 * Project qualifying classification rows. There's no `points` or `grid` on
 * qualifying — they're zeroed for column compatibility. `position` 1 = pole.
 * `status` carries the deepest session the driver reached ("Q3"/"Q2"/"Q1")
 * so the standings page could show "X reached Q3" later if useful.
 */
function projectQualifying(
  race: ErgastRace,
  rows: ErgastQualifyingRow[] | undefined,
  driverIdByErgast: Map<string, number>,
  unmapped: Set<string>,
): { upsertable: ResultRow[] } {
  const out: ResultRow[] = [];
  if (!rows) return { upsertable: out };
  const season = Number(race.season);
  const round = Number(race.round);
  for (const r of rows) {
    const ourId = driverIdByErgast.get(r.Driver.driverId);
    if (ourId === undefined) {
      unmapped.add(r.Driver.driverId);
      continue;
    }
    const reachedQ3 = Boolean(r.Q3);
    const reachedQ2 = Boolean(r.Q2);
    const status = reachedQ3 ? "Q3" : reachedQ2 ? "Q2" : "Q1";
    out.push({
      season,
      round,
      session_kind: "qualifying",
      driver_id: ourId,
      position: safeIntOrNull(r.position),
      points: 0,
      grid: null,
      status,
      fastest_lap: false,
    });
  }
  return { upsertable: out };
}

export async function backfillSeason(
  svc: SupabaseClient,
  season: number,
): Promise<BackfillSeasonSummary> {
  const driverIdByErgast = await loadDriverErgastMap(svc);
  const unmapped = new Set<string>();

  const racesByKey = new Map<
    string,
    {
      season: number;
      round: number;
      name: string;
      ergast_circuit_id: string;
      race_date: string;
    }
  >();
  const resultRows: ResultRow[] = [];

  // 1. Race classifications.
  for await (const page of jolpicaPaginated<RaceTablePayload>(
    `/${season}/results/`,
  )) {
    for (const race of page.MRData.RaceTable.Races) {
      const key = `${race.season}-${race.round}`;
      racesByKey.set(key, {
        season: Number(race.season),
        round: Number(race.round),
        name: race.raceName,
        ergast_circuit_id: race.Circuit.circuitId,
        race_date: race.date,
      });
      const { upsertable } = projectResults(
        race,
        race.Results,
        "race",
        driverIdByErgast,
        unmapped,
      );
      resultRows.push(...upsertable);
    }
  }

  // 2. Sprint classifications.
  for await (const page of jolpicaPaginated<RaceTablePayload>(
    `/${season}/sprint/`,
  )) {
    for (const race of page.MRData.RaceTable.Races) {
      const key = `${race.season}-${race.round}`;
      // The sprint endpoint may surface a round we haven't seen via the race
      // endpoint (rare but possible if the race result hasn't published yet);
      // treat it as authoritative for the metadata too.
      if (!racesByKey.has(key)) {
        racesByKey.set(key, {
          season: Number(race.season),
          round: Number(race.round),
          name: race.raceName,
          ergast_circuit_id: race.Circuit.circuitId,
          race_date: race.date,
        });
      }
      const { upsertable } = projectResults(
        race,
        race.SprintResults,
        "sprint",
        driverIdByErgast,
        unmapped,
      );
      resultRows.push(...upsertable);
    }
  }

  // 3. Qualifying classifications. Pole sitter = position 1.
  for await (const page of jolpicaPaginated<RaceTablePayload>(
    `/${season}/qualifying/`,
  )) {
    for (const race of page.MRData.RaceTable.Races) {
      const key = `${race.season}-${race.round}`;
      if (!racesByKey.has(key)) {
        racesByKey.set(key, {
          season: Number(race.season),
          round: Number(race.round),
          name: race.raceName,
          ergast_circuit_id: race.Circuit.circuitId,
          race_date: race.date,
        });
      }
      const { upsertable } = projectQualifying(
        race,
        race.QualifyingResults,
        driverIdByErgast,
        unmapped,
      );
      resultRows.push(...upsertable);
    }
  }

  const racesArr = Array.from(racesByKey.values());
  if (racesArr.length > 0) {
    const { error: rErr } = await svc.from("historical_races").upsert(racesArr);
    if (rErr) throw rErr;
  }
  if (resultRows.length > 0) {
    const { error: resErr } = await svc
      .from("historical_results")
      .upsert(resultRows);
    if (resErr) throw resErr;
  }

  return {
    season,
    races: racesArr.length,
    raceResults: resultRows.filter((r) => r.session_kind === "race").length,
    sprintResults: resultRows.filter((r) => r.session_kind === "sprint")
      .length,
    qualifyingResults: resultRows.filter(
      (r) => r.session_kind === "qualifying",
    ).length,
    fastestLaps: resultRows.filter((r) => r.fastest_lap).length,
    unmappedDriverIds: Array.from(unmapped),
  };
}
