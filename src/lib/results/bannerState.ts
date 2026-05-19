/**
 * Admin OpenF1-fetch banner state (design_handoff_phase11 §7).
 *
 * Pure derivation from the event/results status the admin page already
 * loads — no schema change. Composes with the Phase-12 freeze rule:
 * `source='admin'` (manual entry or an accepted fetch) and `revealed` are
 * the frozen states; `openf1` pre-reveal is provisional (refetchable).
 * Unit-locked BS1–BS4.
 */
export type OpenF1BannerState =
  | "idle"
  | "provisional"
  | "official"
  | "revealed";

export function openF1BannerState(input: {
  revealed: boolean;
  hasResults: boolean;
  source: "openf1" | "admin" | null;
}): OpenF1BannerState {
  if (input.revealed) return "revealed";
  if (!input.hasResults) return "idle";
  if (input.source === "admin") return "official";
  return "provisional";
}
