/**
 * Score computation — DNF-aware, idempotent, pure.
 *
 * Called from the server path that writes `results` (cron or admin manual entry).
 * Kept out of DB triggers so it's trivially unit-testable.
 *
 * DNF rule: predicted driver not among classified finishers => 0 for that slot.
 * Never awarded "right driver wrong slot" unless the driver is in the classified set.
 */

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
  let slotMismatch = 0;
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
      slotMismatch++;
    }
  }

  const perfect_bonus = exact === 3;
  const points = exact * 5 + slotMismatch * 2 + (perfect_bonus ? 3 : 0);

  return {
    points,
    exact_matches: exact,
    slot_mismatches: slotMismatch,
    dnf_zeros: dnfZeros,
    perfect_bonus,
  };
}
