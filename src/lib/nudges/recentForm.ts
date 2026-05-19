/**
 * Order the last-5 form tokens for the predict telemetry strip.
 *
 * `driver_nudges.recent_form` is stored most-recent-first (e.g.
 * "P1·P3·DNF·P2·P1"). The strip renders oldest-left → latest-right (sports
 * convention — changes.md §2 / design_handoff_phase11 §11), so the rightmost
 * pip is the latest result and carries the ↑ LATEST tag.
 *
 * Extracted verbatim from the inline IIFE in driver-picker.tsx so the
 * ordering is regression-locked (ADDENDUM Diff §4).
 */
export function orderRecentForm(
  recentForm: string | null | undefined,
): string[] {
  const toks = (recentForm || "")
    .split("·")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  toks.reverse();
  return toks;
}
