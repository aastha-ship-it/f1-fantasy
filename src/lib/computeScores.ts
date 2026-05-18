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
function wrongSlotBucket(n: number): number {
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
};

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
    };
  }

  // Race scoring — all three slots required.
  const classified = new Set<DriverId>();
  if (actual.p1 !== null) classified.add(actual.p1);
  if (actual.p2 !== null) classified.add(actual.p2);
  if (actual.p3 !== null) classified.add(actual.p3);

  const slots: Array<["p1" | "p2" | "p3", DriverId | null]> = [
    ["p1", prediction.p1],
    ["p2", prediction.p2],
    ["p3", prediction.p3],
  ];

  let exact = 0;
  let onPodiumWrongSlot = 0;
  let dnfZeros = 0;

  for (const [pos, pick] of slots) {
    if (pick === null) {
      dnfZeros++;
      continue;
    }
    if (!classified.has(pick)) {
      dnfZeros++;
    } else if (pick === actual[pos]) {
      exact++;
    } else {
      onPodiumWrongSlot++;
    }
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
  };
}
