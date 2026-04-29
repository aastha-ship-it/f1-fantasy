import type { SupabaseClient } from "@supabase/supabase-js";

export type AtTrackResults = { wins: number; podiums: number };

/**
 * Count this driver's wins (P1) and podiums (P1–P3) at a given circuit
 * within the lookback window, excluding races on/after `asOfDate`.
 *
 *   asOfDate  — typically the upcoming session_start_at; we don't want to
 *               attribute results from a race that hasn't happened yet.
 *   windowYears — symmetric lookback (asOfDate - windowYears years).
 *
 * Returns:
 *   - `null` when historical_races has zero rows for this circuit/window
 *     (data is genuinely missing — caller should render `—`)
 *   - `{ wins: 0, podiums: 0 }` when races exist but the driver never
 *     classified ≤ P3 (genuinely zero)
 *   - `{ wins: w, podiums: p }` otherwise; wins is always ≤ podiums
 */
export async function atTrackResultsFor(
  svc: SupabaseClient,
  driverId: number,
  ergastCircuitId: string,
  opts: { windowYears: number; asOfDate: string },
): Promise<AtTrackResults | null> {
  const cutoff = new Date(opts.asOfDate);
  const earliest = new Date(cutoff);
  earliest.setUTCFullYear(earliest.getUTCFullYear() - opts.windowYears);

  const earliestIso = earliest.toISOString().slice(0, 10);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const { data: races, error: rErr } = await svc
    .from("historical_races")
    .select("season, round")
    .eq("ergast_circuit_id", ergastCircuitId)
    .gte("race_date", earliestIso)
    .lt("race_date", cutoffIso);
  if (rErr) throw rErr;
  if (!races || races.length === 0) return null;

  const filterClauses = races
    .map((r) => `and(season.eq.${r.season},round.eq.${r.round})`)
    .join(",");

  // Pull every classified P1–P3 row for this driver at this circuit, then
  // bucket wins (position=1) and total podiums client-side. Single round-trip;
  // race counts at any one circuit are tiny (≤ windowYears rows).
  const { data: rows, error: cErr } = await svc
    .from("historical_results")
    .select("position")
    .eq("driver_id", driverId)
    .eq("session_kind", "race")
    .lte("position", 3)
    .gt("position", 0)
    .or(filterClauses);
  if (cErr) throw cErr;

  const podiums = rows?.length ?? 0;
  const wins = (rows ?? []).filter((r) => r.position === 1).length;
  return { wins, podiums };
}
