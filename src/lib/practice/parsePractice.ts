/**
 * Pure: turn an OpenF1 `/session_result` payload for a practice session into
 * the banner's top-3 (changes.md §6).
 *
 * Practice has no official podium — classification is fastest-lap order, which
 * OpenF1 exposes as `position`. We take the three lowest positions that
 * resolve to a known driver (unresolved driver_numbers are skipped so a
 * mid-list mapping gap doesn't blank the banner).
 */

export type PracticeResultRow = {
  driver_number: number;
  position: number | null;
  /** Fastest-lap time in seconds; absent/zero for no timed lap. */
  duration?: number | null;
};

export type FpPodiumEntry = {
  pos: number;
  driverId: number;
  code: string;
  team: string;
  lapSeconds: number | null;
};

export function parsePractice(
  rows: PracticeResultRow[],
  driverMap: Map<number, { id: number; code: string; team: string }>,
): FpPodiumEntry[] {
  const classified = rows
    .filter((r) => r.position != null)
    .sort((a, b) => (a.position as number) - (b.position as number));

  const out: FpPodiumEntry[] = [];
  for (const r of classified) {
    if (out.length === 3) break;
    const d = driverMap.get(r.driver_number);
    if (!d) continue;
    const dur = r.duration;
    out.push({
      pos: r.position as number,
      driverId: d.id,
      code: d.code,
      team: d.team,
      lapSeconds:
        typeof dur === "number" && Number.isFinite(dur) && dur > 0
          ? dur
          : null,
    });
  }
  return out;
}
