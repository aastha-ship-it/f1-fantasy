import { describe, it, expect } from "vitest";
import { computeScore } from "./computeScores";

/**
 * Scoring contract (from plans/flickering-giggling-valley.md §Scoring):
 *   Race (P1/P2/P3): exact=5 · slot_mismatch=2 · perfect_podium=+3. DNF=0.
 *   Sprint (P1 only): exact=5 · DNF=0.
 *   DNF rule: predicted driver not in classified result => 0 for that slot,
 *     NOT "right driver wrong slot".
 *
 * Driver IDs below are arbitrary integers. Only identity matters.
 */

const ACTUAL_RACE = { p1: 1, p2: 4, p3: 16 };
const ACTUAL_SPRINT = { p1: 1, p2: null, p3: null };

describe("computeScore — race", () => {
  it("U1 · exact podium → 18 pts with perfect_bonus", () => {
    const s = computeScore({ p1: 1, p2: 4, p3: 16 }, ACTUAL_RACE, false);
    expect(s.points).toBe(18);
    expect(s.exact_matches).toBe(3);
    expect(s.slot_mismatches).toBe(0);
    expect(s.dnf_zeros).toBe(0);
    expect(s.perfect_bonus).toBe(true);
  });

  it("U2 · all three wrong drivers → 0 pts", () => {
    const s = computeScore({ p1: 77, p2: 99, p3: 55 }, ACTUAL_RACE, false);
    expect(s.points).toBe(0);
    expect(s.exact_matches).toBe(0);
    expect(s.slot_mismatches).toBe(0);
    expect(s.dnf_zeros).toBe(3);
    expect(s.perfect_bonus).toBe(false);
  });

  it("U3 · P1 exact only, P2/P3 wrong drivers → 5 pts", () => {
    const s = computeScore({ p1: 1, p2: 99, p3: 55 }, ACTUAL_RACE, false);
    expect(s.points).toBe(5);
    expect(s.exact_matches).toBe(1);
    expect(s.slot_mismatches).toBe(0);
    expect(s.dnf_zeros).toBe(2);
    expect(s.perfect_bonus).toBe(false);
  });

  it("U4 · right driver wrong slot ×3 → 6 pts (2+2+2)", () => {
    // actual P1=1, P2=4, P3=16; prediction rotates them one slot
    const s = computeScore({ p1: 4, p2: 16, p3: 1 }, ACTUAL_RACE, false);
    expect(s.points).toBe(6);
    expect(s.exact_matches).toBe(0);
    expect(s.slot_mismatches).toBe(3);
    expect(s.dnf_zeros).toBe(0);
    expect(s.perfect_bonus).toBe(false);
  });

  it("U5 · DNF on P1, P2 exact, P3 slot-wrong → 7 pts", () => {
    // P1=99 not in actual (DNF), P2=4 exact, P3=1 is in actual but wrong slot
    const s = computeScore({ p1: 99, p2: 4, p3: 1 }, ACTUAL_RACE, false);
    expect(s.points).toBe(7);
    expect(s.exact_matches).toBe(1);
    expect(s.slot_mismatches).toBe(1);
    expect(s.dnf_zeros).toBe(1);
    expect(s.perfect_bonus).toBe(false);
  });
});

describe("computeScore — sprint", () => {
  it("U6 · sprint P1 exact → 5 pts", () => {
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

  it("U7 · sprint P1 DNF → 0 pts", () => {
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
