import { describe, it, expect } from "vitest";
import { computeScore } from "./computeScores";

/**
 * Scoring contract (from changes.md §4 — new point system):
 *   Race / Quali (P1/P2/P3):
 *     - exact slot                       → 5 (per driver)
 *     - perfect podium (all 3 exact)     → +3 bonus  (max 18)
 *     - 1 driver on podium, wrong slot   → 1
 *     - 2 drivers on podium, wrong slot  → 2
 *     - 3 drivers on podium, wrong slot  → 4
 *     - 1 exact + 1 on-podium-wrong-slot → 5 + 1 = 6
 *     - 1 exact + 2 on-podium-wrong-slot → 5 + 2 = 7
 *     - miss (predicted driver off podium) → 0 for that driver
 *   Sprint (P1 only): exact P1 = 5, else 0.
 *
 * Driver IDs below are arbitrary integers. Only identity matters.
 * ACTUAL podium: P1=1, P2=4, P3=16.
 */

const ACTUAL_RACE = { p1: 1, p2: 4, p3: 16 };
const ACTUAL_SPRINT = { p1: 1, p2: null, p3: null };

describe("computeScore — race/quali (new point system)", () => {
  it("perfect podium → 18 pts with perfect_bonus", () => {
    const s = computeScore({ p1: 1, p2: 4, p3: 16 }, ACTUAL_RACE, false);
    expect(s.points).toBe(18);
    expect(s.exact_matches).toBe(3);
    expect(s.slot_mismatches).toBe(0);
    expect(s.dnf_zeros).toBe(0);
    expect(s.perfect_bonus).toBe(true);
  });

  it("all three off podium → 0 pts (miss)", () => {
    const s = computeScore({ p1: 77, p2: 99, p3: 55 }, ACTUAL_RACE, false);
    expect(s.points).toBe(0);
    expect(s.exact_matches).toBe(0);
    expect(s.slot_mismatches).toBe(0);
    expect(s.dnf_zeros).toBe(3);
    expect(s.perfect_bonus).toBe(false);
  });

  it("P1 exact only, P2/P3 off podium → 5 pts", () => {
    const s = computeScore({ p1: 1, p2: 99, p3: 55 }, ACTUAL_RACE, false);
    expect(s.points).toBe(5);
    expect(s.exact_matches).toBe(1);
    expect(s.slot_mismatches).toBe(0);
    expect(s.dnf_zeros).toBe(2);
    expect(s.perfect_bonus).toBe(false);
  });

  it("exactly 1 driver on podium, wrong slot → 1 pt", () => {
    // pick P1=4 (actual P2 — on podium, wrong slot); P2/P3 off podium.
    const s = computeScore({ p1: 4, p2: 99, p3: 55 }, ACTUAL_RACE, false);
    expect(s.points).toBe(1);
    expect(s.exact_matches).toBe(0);
    expect(s.slot_mismatches).toBe(1);
    expect(s.dnf_zeros).toBe(2);
    expect(s.perfect_bonus).toBe(false);
  });

  it("exactly 2 drivers on podium, both wrong slot → 2 pts", () => {
    // P1=4 (actual P2), P2=16 (actual P3) — both on podium wrong slot; P3 miss.
    const s = computeScore({ p1: 4, p2: 16, p3: 99 }, ACTUAL_RACE, false);
    expect(s.points).toBe(2);
    expect(s.exact_matches).toBe(0);
    expect(s.slot_mismatches).toBe(2);
    expect(s.dnf_zeros).toBe(1);
    expect(s.perfect_bonus).toBe(false);
  });

  it("all 3 drivers on podium, all wrong slot → 4 pts", () => {
    // rotate the podium one slot: P1=4, P2=16, P3=1.
    const s = computeScore({ p1: 4, p2: 16, p3: 1 }, ACTUAL_RACE, false);
    expect(s.points).toBe(4);
    expect(s.exact_matches).toBe(0);
    expect(s.slot_mismatches).toBe(3);
    expect(s.dnf_zeros).toBe(0);
    expect(s.perfect_bonus).toBe(false);
  });

  it("1 exact + 1 on-podium-wrong-slot → 6 pts (5 + 1)", () => {
    // P1=1 exact; P2=16 (actual P3 — wrong slot); P3=99 miss.
    const s = computeScore({ p1: 1, p2: 16, p3: 99 }, ACTUAL_RACE, false);
    expect(s.points).toBe(6);
    expect(s.exact_matches).toBe(1);
    expect(s.slot_mismatches).toBe(1);
    expect(s.dnf_zeros).toBe(1);
    expect(s.perfect_bonus).toBe(false);
  });

  it("1 exact + 2 on-podium-wrong-slot → 7 pts (5 + 2)", () => {
    // P1=1 exact; P2=16 (actual P3); P3=4 (actual P2) — both wrong slot.
    const s = computeScore({ p1: 1, p2: 16, p3: 4 }, ACTUAL_RACE, false);
    expect(s.points).toBe(7);
    expect(s.exact_matches).toBe(1);
    expect(s.slot_mismatches).toBe(2);
    expect(s.dnf_zeros).toBe(0);
    expect(s.perfect_bonus).toBe(false);
  });

  it("DNF on P1, P2 exact, P3 on-podium-wrong-slot → 6 pts (5 + 1)", () => {
    // P1=99 off podium; P2=4 exact; P3=1 (actual P1) wrong slot.
    const s = computeScore({ p1: 99, p2: 4, p3: 1 }, ACTUAL_RACE, false);
    expect(s.points).toBe(6);
    expect(s.exact_matches).toBe(1);
    expect(s.slot_mismatches).toBe(1);
    expect(s.dnf_zeros).toBe(1);
    expect(s.perfect_bonus).toBe(false);
  });

  it("null P2/P3 slots count as off-podium (defensive)", () => {
    const s = computeScore(
      { p1: 1, p2: null, p3: null },
      ACTUAL_RACE,
      false,
    );
    expect(s.points).toBe(5);
    expect(s.exact_matches).toBe(1);
    expect(s.slot_mismatches).toBe(0);
    expect(s.dnf_zeros).toBe(2);
    expect(s.perfect_bonus).toBe(false);
  });
});

describe("computeScore — sprint (unchanged: P1 only)", () => {
  it("sprint P1 exact → 5 pts", () => {
    const s = computeScore(
      { p1: 1, p2: null, p3: null },
      ACTUAL_SPRINT,
      true,
    );
    expect(s.points).toBe(5);
    expect(s.exact_matches).toBe(1);
    expect(s.slot_mismatches).toBe(0);
    expect(s.dnf_zeros).toBe(0);
    expect(s.perfect_bonus).toBe(false);
  });

  it("sprint P1 wrong → 0 pts", () => {
    const s = computeScore(
      { p1: 99, p2: null, p3: null },
      ACTUAL_SPRINT,
      true,
    );
    expect(s.points).toBe(0);
    expect(s.exact_matches).toBe(0);
    expect(s.slot_mismatches).toBe(0);
    expect(s.dnf_zeros).toBe(1);
    expect(s.perfect_bonus).toBe(false);
  });
});
