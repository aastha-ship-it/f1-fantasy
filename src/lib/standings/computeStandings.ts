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
