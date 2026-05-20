/**
 * Pure standings aggregation. Given session classification rows and an active
 * drivers list, produce sorted driver and constructor standings using the
 * official F1 points scale (race + sprint).
 */

const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

export type ClassificationRow = {
  event_id: string;
  driver_id: number;
  position: number | null;
  is_sprint: boolean;
};

export type DriverInfo = {
  id: number;
  code: string;
  full_name: string;
  team: string;
};

export type DriverStanding = {
  driver: DriverInfo;
  points: number;
};

export type ConstructorStanding = {
  team: string;
  points: number;
};

/**
 * Whether a `historical_results.status` value means the driver completed
 * the race. Jolpica labels are: "Finished", "Lapped" (finished but >1 lap
 * down — still a finisher), "Retired", "Did not start", "Disqualified",
 * plus the legacy Ergast "+N Lap(s)" form. Anything not in the finisher
 * set counts as a DNF for the `/dashboard/standings` summary tile.
 *
 * Bug-002 regression-locked: pre-fix the regex didn't include "Lapped"
 * (Jolpica's actual literal), so all lapped finishers were over-counted
 * as DNF — inflated the tile from the real 18 to a displayed 47 against
 * the 2026 mock data.
 */
const FINISHER_STATUSES = new Set(["Finished", "Lapped"]);
const LEGACY_LAP_DOWN_RE = /^\+\d+ Laps?$/i;
export function isRaceFinisher(status: string | null | undefined): boolean {
  if (!status) return false;
  return (
    FINISHER_STATUSES.has(status) || LEGACY_LAP_DOWN_RE.test(status)
  );
}

export function pointsForPosition(
  position: number | null,
  isSprint: boolean,
): number {
  if (position == null) return 0;
  const scale = isSprint ? SPRINT_POINTS : RACE_POINTS;
  if (position < 1 || position > scale.length) return 0;
  return scale[position - 1] ?? 0;
}

export function computeDriverStandings(
  rows: ClassificationRow[],
  drivers: DriverInfo[],
): DriverStanding[] {
  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const totals = new Map<number, number>();
  for (const r of rows) {
    const pts = pointsForPosition(r.position, r.is_sprint);
    if (pts === 0) continue;
    totals.set(r.driver_id, (totals.get(r.driver_id) ?? 0) + pts);
  }
  const out: DriverStanding[] = [];
  for (const [driverId, points] of totals) {
    const driver = driverById.get(driverId);
    if (!driver) continue;
    out.push({ driver, points });
  }
  out.sort((a, b) => b.points - a.points || a.driver.id - b.driver.id);
  return out;
}

/**
 * Pre-summed Jolpica points per driver (one row per driver_id).
 */
export type JolpicaTotal = {
  driver_id: number;
  points: number;
};

/**
 * Minimal `events` shape `selectBackstopRows` reads. The page loader maps
 * its row shape onto this.
 */
export type EventInfo = {
  id: string;
  season: number;
  round: number;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  ergast_circuit_id: string | null;
};

/**
 * Assemble the OpenF1-backstop row set fed to `combineStandings`.
 *
 * Two filters that the inline page loop missed (Bug-001):
 *  1. Only `race` and `sprint_race` award F1 championship points — drop
 *     `quali` and `sprint_quali` rows so the pole-sitter never accidentally
 *     gets scored as a race winner.
 *  2. Dedup against Jolpica by **circuit**, not by `(season, round)`. Real
 *     F1 cancellations renumber the season in Jolpica/Ergast (e.g. Miami =
 *     Jolpica round 4 vs OpenF1 round 6 in our 2026 seed), and a
 *     round-number dedup misses that → the same race gets counted twice.
 *     `ergast_circuit_id` is the stable identifier on both sides.
 *
 * Events with a null `ergast_circuit_id` are allowed through (defensive —
 * they cannot be in `ingestedCircuits` by construction); the caller should
 * still feed them, since they're the only signal we have for a freshly-
 * added round before the Jolpica resolver runs.
 */
const SCORING_SESSION_TYPES = new Set([
  "race",
  "sprint_race",
] as const);

export function selectBackstopRows(
  classifications: {
    event_id: string;
    driver_id: number;
    position: number | null;
  }[],
  eventsById: Map<string, EventInfo>,
  ingestedCircuits: Set<string>,
  currentSeason: number,
): ClassificationRow[] {
  const out: ClassificationRow[] = [];
  for (const c of classifications) {
    const ev = eventsById.get(c.event_id);
    if (!ev) continue;
    if (ev.season !== currentSeason) continue;
    if (!SCORING_SESSION_TYPES.has(ev.session_type as "race" | "sprint_race")) {
      continue;
    }
    if (ev.ergast_circuit_id && ingestedCircuits.has(ev.ergast_circuit_id)) {
      continue;
    }
    out.push({
      event_id: c.event_id,
      driver_id: c.driver_id,
      position: c.position,
      is_sprint: ev.session_type === "sprint_race",
    });
  }
  return out;
}

/**
 * Combine Jolpica-canonical season totals with OpenF1-backstop classification
 * rows for races Jolpica hasn't ingested yet. Returns sorted driver +
 * constructor standings.
 *
 * Jolpica: trust `points` directly (it's per-season-rules correct).
 * Backstop: recompute via `pointsForPosition` from finishing position.
 */
export function combineStandings(
  jolpicaTotals: JolpicaTotal[],
  backstopRows: ClassificationRow[],
  drivers: DriverInfo[],
): { drivers: DriverStanding[]; constructors: ConstructorStanding[] } {
  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const totals = new Map<number, number>();

  for (const j of jolpicaTotals) {
    totals.set(j.driver_id, (totals.get(j.driver_id) ?? 0) + j.points);
  }
  for (const b of backstopRows) {
    const pts = pointsForPosition(b.position, b.is_sprint);
    if (pts === 0) continue;
    totals.set(b.driver_id, (totals.get(b.driver_id) ?? 0) + pts);
  }

  const driverStandings: DriverStanding[] = [];
  const constructorTotals = new Map<string, number>();
  for (const [driverId, points] of totals) {
    const driver = driverById.get(driverId);
    if (!driver) continue;
    driverStandings.push({ driver, points });
    constructorTotals.set(
      driver.team,
      (constructorTotals.get(driver.team) ?? 0) + points,
    );
  }
  driverStandings.sort(
    (a, b) => b.points - a.points || a.driver.id - b.driver.id,
  );
  const constructorStandings: ConstructorStanding[] = [];
  for (const [team, points] of constructorTotals) {
    constructorStandings.push({ team, points });
  }
  constructorStandings.sort(
    (a, b) => b.points - a.points || a.team.localeCompare(b.team),
  );

  return { drivers: driverStandings, constructors: constructorStandings };
}

export function computeConstructorStandings(
  rows: ClassificationRow[],
  drivers: DriverInfo[],
): ConstructorStanding[] {
  const teamByDriver = new Map(drivers.map((d) => [d.id, d.team]));
  const totals = new Map<string, number>();
  for (const r of rows) {
    const pts = pointsForPosition(r.position, r.is_sprint);
    if (pts === 0) continue;
    const team = teamByDriver.get(r.driver_id);
    if (!team) continue;
    totals.set(team, (totals.get(team) ?? 0) + pts);
  }
  const out: ConstructorStanding[] = [];
  for (const [team, points] of totals) {
    out.push({ team, points });
  }
  out.sort((a, b) => b.points - a.points || a.team.localeCompare(b.team));
  return out;
}
