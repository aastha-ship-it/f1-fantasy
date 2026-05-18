/**
 * Format an OpenF1 fastest-lap `duration` (seconds, e.g. 103.372) as the
 * F1-conventional `M:SS.mmm` (→ "1:43.372"). changes.md §6.
 *
 * Returns "—" for null/undefined/NaN/non-positive — used directly in the
 * Practice banner where admin-override rows have no lap time.
 */
export function formatLapTime(
  seconds: number | null | undefined,
): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return "—";
  }
  const totalMs = Math.round(seconds * 1000);
  const minutes = Math.floor(totalMs / 60_000);
  const remMs = totalMs - minutes * 60_000;
  const secs = Math.floor(remMs / 1000);
  const ms = remMs % 1000;
  return `${minutes}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}
