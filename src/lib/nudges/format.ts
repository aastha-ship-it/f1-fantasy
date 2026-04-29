/**
 * Telemetry-strip copy helpers for the predict-detail slot card.
 *
 * `formatAtTrack` renders the wins / podiums combo for a driver at a given
 * circuit. The semantics:
 *
 *   - `null` for both → "—" (data is missing — historical_results hasn't been
 *     backfilled, or the circuit has no ergast id resolved yet).
 *   - `wins >= 1`     → "1 win · 2 podiums" (wins clause leads).
 *   - `wins == 0`     → "n podium(s)" (no leading "0 wins ·" — keeps the
 *                                       common case tight).
 *   - `wins == null` but `podiums != null` → fallback to podiums-only so
 *     legacy rows written before the `at_track_wins` column existed still
 *     render meaningfully.
 *
 * Wins should always be ≤ podiums by construction (a P1 finish is also a
 * podium), but this helper trusts the caller — it's purely string formatting.
 */
export function formatAtTrack(
  wins: number | null,
  podiums: number | null,
): string {
  if (podiums == null) return "—";
  const podLabel = `${podiums} podium${podiums === 1 ? "" : "s"}`;
  if (wins == null || wins <= 0) return podLabel;
  const winLabel = `${wins} win${wins === 1 ? "" : "s"}`;
  return `${winLabel} · ${podLabel}`;
}
