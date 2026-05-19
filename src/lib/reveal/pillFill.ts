/**
 * Show-Reel session-pill accent fill % (design_handoff_phase11 §3).
 *
 * Pure emphasis map so standout sessions still pop in the otherwise
 * brand-uniform accent strip. Mirrors canvas screens-lobby.jsx:636
 * (`s.perfect ? 28 : s.pts >= 10 ? 18 : 10`), null-safe for sessions the
 * viewer hasn't scored. Unit-locked SR1–SR3.
 */
export function pillFill(perfect: boolean, pts: number | null): number {
  if (perfect) return 28;
  if (pts !== null && pts >= 10) return 18;
  return 10;
}
