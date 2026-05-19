/**
 * Score computation — DNF-aware, idempotent, pure.
 *
 * Called from the server path that writes `results` (cron or admin manual entry).
 * Kept out of DB triggers so it's trivially unit-testable.
 *
 * Race / Quali (3 slots):
 *   - Each driver predicted in its exact finishing slot: +5.
 *   - Drivers that are on the podium but in the wrong slot are scored as a
 *     non-linear bucket on the COUNT of such drivers: 1→1, 2→2, 3→4.
 *   - Perfect podium (all three exact): +3 bonus.
 *   - A predicted driver not on the podium scores 0 (DNF rule — never awarded
 *     "right driver wrong slot" unless the driver is on the classified podium).
 *   Max = 3·5 + 3 = 18.
 * Sprint (P1 only): exact P1 = 5, else 0.
 */

/**
 * Points for the count of predicted drivers that are on the podium but in the
 * wrong slot. Deliberately non-linear (see changes.md): rewarding "I got the
 * whole podium, just jumbled" more than scattered single hits.
 */
export function wrongSlotBucket(n: number): number {
  switch (n) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 4;
    default:
      return 0;
  }
}

export type DriverId = number;

export type SlotOutcome = "exact" | "onPodium" | "miss";

export type Prediction = {
  p1: DriverId;
  p2: DriverId | null;
  p3: DriverId | null;
};

export type Actual = {
  p1: DriverId;
  p2: DriverId | null;
  p3: DriverId | null;
};

export type ScoreBreakdown = {
  points: number;
  exact_matches: number;
  slot_mismatches: number;
  dnf_zeros: number;
  perfect_bonus: boolean;
  /**
   * Human one-liner, wording locked to design/data.jsx MIAMI_PREDICTIONS
   * (design_handoff_phase11/ADDENDUM §C). Persisted to `scores.breakdown`.
   */
  breakdown: string;
};

/**
 * Plain-language summary of a scored prediction. Same shape for sprint
 * (P1 only → exact=0|1, wrongSlot=0, perfect=false). Locked by BD1..BD6.
 */
export function breakdownText(
  exact: number,
  wrongSlot: number,
  perfect: boolean,
): string {
  if (perfect) return "3 exact + perfect bonus";
  if (exact === 0 && wrongSlot === 0) {
    return "0 exact · 0 on podium — rough week";
  }
  const exactPart = exact > 0 ? `${exact} exact (${exact * 5})` : "0 exact";
  const bucketPart =
    wrongSlot > 0
      ? `${wrongSlot} on podium bucket (${wrongSlotBucket(wrongSlot)})`
      : null;
  return [exactPart, bucketPart].filter(Boolean).join(" + ");
}

/**
 * Classify one predicted slot against the actual podium. The single source
 * of the §4 "exact / on-podium-wrong-slot / miss" rule — `computeScore`
 * scores from it and the reveal FriendCard badges read from it, so display
 * and points can never disagree.
 */
export function slotOutcome(
  pick: DriverId | null,
  actual: Actual,
  pos: "p1" | "p2" | "p3",
): SlotOutcome {
  if (pick === null) return "miss";
  if (pick === actual[pos]) return "exact";
  const classified = new Set<DriverId>();
  if (actual.p1 !== null) classified.add(actual.p1);
  if (actual.p2 !== null) classified.add(actual.p2);
  if (actual.p3 !== null) classified.add(actual.p3);
  return classified.has(pick) ? "onPodium" : "miss";
}

/**
 * Reveal FriendCard pick-row badge for a slot outcome. The wrong-slot
 * ("on podium") and miss rows deliberately carry NO number — the
 * non-linear bucket is shown once, in the bucket-tally row. Only the
 * fixed per-driver +5 appears on an exact row (by spec). Single source
 * for the FriendCard so the badge text can't drift (ADDENDUM §C, RS*).
 */
export function slotBadge(o: SlotOutcome): {
  text: string;
  color: string;
  weight: number;
} {
  if (o === "exact") {
    return { text: "✓ Exact +5", color: "var(--success)", weight: 600 };
  }
  if (o === "onPodium") {
    return { text: "⊙ On podium", color: "var(--warning)", weight: 600 };
  }
  return { text: "× Miss", color: "var(--fg-subtle)", weight: 400 };
}

export function computeScore(
  prediction: Prediction,
  actual: Actual,
  isSprint: boolean,
): ScoreBreakdown {
  if (isSprint) {
    const pick = prediction.p1;
    const inClassified = pick === actual.p1;
    return {
      points: inClassified ? 5 : 0,
      exact_matches: inClassified ? 1 : 0,
      slot_mismatches: 0,
      dnf_zeros: inClassified ? 0 : 1,
      perfect_bonus: false,
      breakdown: breakdownText(inClassified ? 1 : 0, 0, false),
    };
  }

  // Race scoring — all three slots required. Classify each slot through the
  // shared `slotOutcome` so points and the reveal FriendCard badges agree.
  const slots: Array<["p1" | "p2" | "p3", DriverId | null]> = [
    ["p1", prediction.p1],
    ["p2", prediction.p2],
    ["p3", prediction.p3],
  ];

  let exact = 0;
  let onPodiumWrongSlot = 0;
  let dnfZeros = 0;

  for (const [pos, pick] of slots) {
    const outcome = slotOutcome(pick, actual, pos);
    if (outcome === "exact") exact++;
    else if (outcome === "onPodium") onPodiumWrongSlot++;
    else dnfZeros++;
  }

  const perfect_bonus = exact === 3;
  const points =
    exact * 5 + wrongSlotBucket(onPodiumWrongSlot) + (perfect_bonus ? 3 : 0);

  return {
    points,
    exact_matches: exact,
    slot_mismatches: onPodiumWrongSlot,
    dnf_zeros: dnfZeros,
    perfect_bonus,
    breakdown: breakdownText(exact, onPodiumWrongSlot, perfect_bonus),
  };
}
