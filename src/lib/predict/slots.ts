/**
 * How many podium slots a session takes predictions for.
 *
 * Sprint sessions (sprint_quali, sprint_race) score P1 only — see CLAUDE.md
 * "Scoring rule": a sprint event is `exact ? 5 : 0` on one slot, max 5 pts.
 * Race and qualifying take the full P1 · P2 · P3, max 18.
 *
 * Behaviour-preserving extraction of the inline `isSprint ? [p1] : [p1,p2,p3]`
 * ternary in `/dashboard/predict/round/[round]/page.tsx`, pulled out so the
 * slot count is unit-testable: that page renders one pick chip per slot in
 * two trees (mobile below the 780px fork, desktop at and above it) and both
 * must agree. Same idiom as `orderRecentForm` in `src/lib/nudges/recentForm.ts`.
 */

/** Sprint sessions score P1 only; quali and race take a full podium. */
export function isSprintSession(sessionType: string): boolean {
  return sessionType === "sprint_race" || sessionType === "sprint_quali";
}

/** 1 for sprint sessions, 3 for quali/race. Never any other value. */
export function slotCount(sessionType: string): 1 | 3 {
  return isSprintSession(sessionType) ? 1 : 3;
}

type PickRow = {
  p1_driver_id: number | null;
  p2_driver_id: number | null;
  p3_driver_id: number | null;
};

/**
 * The driver ids to render as pick chips, one entry per slot.
 *
 * `null` entries are empty slots — the caller draws the dashed placeholder.
 * A missing `pick` row (the user has not predicted this session) yields an
 * array of the right length filled with `null`, so the chip row keeps its
 * shape whether or not picks exist.
 */
export function slotDriverIds(
  sessionType: string,
  pick: PickRow | null | undefined,
): (number | null)[] {
  if (isSprintSession(sessionType)) return [pick?.p1_driver_id ?? null];
  return [
    pick?.p1_driver_id ?? null,
    pick?.p2_driver_id ?? null,
    pick?.p3_driver_id ?? null,
  ];
}

/** True when every slot the session takes has a driver in it. */
export function allSlotsFilled(slotIds: (number | null)[]): boolean {
  return slotIds.length > 0 && slotIds.every((id) => id != null);
}
