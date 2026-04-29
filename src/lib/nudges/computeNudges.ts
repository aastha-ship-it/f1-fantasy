/**
 * Telemetry nudges — pure aggregation primitives.
 *
 * Predict screen reads pre-computed nudge rows from the `driver_nudges`
 * cache; the cache is filled by a nightly cron that calls these helpers
 * with already-shaped OpenF1 history. Nothing here touches the network.
 */

export type FinishPosition = number | null | undefined;

export type TrackResult = {
  circuit: string;
  position: number | null;
};

export type GridClassified = {
  grid: number;
  classified: number | null;
};

const DASH = "—";

export function recentForm(positions: FinishPosition[]): string {
  if (positions.length === 0) return DASH;
  return positions
    .slice(0, 5)
    .map((p) => (p == null ? "DNF" : `P${p}`))
    .join(" · ");
}

export function atTrackPodiums(
  results: TrackResult[],
  circuit: string,
): number {
  return results.filter(
    (r) => r.circuit === circuit && r.position !== null && r.position <= 3,
  ).length;
}

export function qualiRaceDelta(rows: GridClassified[]): number | null {
  const valid = rows.filter(
    (r): r is { grid: number; classified: number } => r.classified !== null,
  );
  if (valid.length === 0) return null;
  const total = valid.reduce((sum, r) => sum + (r.grid - r.classified), 0);
  return Math.round((total / valid.length) * 10) / 10;
}
