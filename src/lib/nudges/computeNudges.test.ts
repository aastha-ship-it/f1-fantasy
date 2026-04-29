import { describe, it, expect } from "vitest";
import {
  recentForm,
  atTrackPodiums,
  qualiRaceDelta,
} from "./computeNudges";

/**
 * Three pure signals aggregated into a nudge for each driver:
 *   - recentForm   — compact last-5 finishes string
 *   - atTrackPodiums — how many podiums at this circuit historically
 *   - qualiRaceDelta — average position change grid → classified
 *
 * None of these touch the network. The lib that orchestrates OpenF1 fetches
 * feeds already-shaped arrays into these functions.
 */

describe("recentForm", () => {
  it("N1 · renders last 5 positions compactly", () => {
    expect(recentForm([1, 4, 2, null, 3])).toBe("P1 · P4 · P2 · DNF · P3");
  });

  it("N2 · fewer than 5 entries — renders what's there", () => {
    expect(recentForm([1, 2])).toBe("P1 · P2");
  });

  it("N3 · empty → em dash", () => {
    expect(recentForm([])).toBe("—");
  });

  it("N4 · more than 5 — keeps the most recent 5 (last-5, assumes caller orders recent-first)", () => {
    expect(recentForm([1, 2, 3, 4, 5, 6, 7])).toBe(
      "P1 · P2 · P3 · P4 · P5",
    );
  });

  it("N5 · treats non-classified (null) and DNS/DSQ (undefined) both as DNF", () => {
    expect(recentForm([1, null, undefined as unknown as null, 2, 3])).toBe(
      "P1 · DNF · DNF · P2 · P3",
    );
  });
});

describe("atTrackPodiums", () => {
  it("N6 · counts podium finishes (position 1, 2, or 3) at the given circuit", () => {
    const results = [
      { circuit: "Miami", position: 2 },
      { circuit: "Miami", position: 4 },
      { circuit: "Miami", position: 1 },
      { circuit: "Monaco", position: 1 }, // different track — ignored
      { circuit: "Miami", position: 3 },
      { circuit: "Miami", position: null }, // DNF at Miami
    ];
    expect(atTrackPodiums(results, "Miami")).toBe(3);
  });

  it("N7 · returns 0 when no history at the track", () => {
    expect(
      atTrackPodiums(
        [{ circuit: "Monaco", position: 1 }],
        "Miami",
      ),
    ).toBe(0);
  });

  it("N8 · empty history → 0", () => {
    expect(atTrackPodiums([], "Miami")).toBe(0);
  });
});

describe("qualiRaceDelta", () => {
  it("N9 · average delta is (grid - classified) averaged — positive = gained places", () => {
    // Race 1: started 10th, finished 7th → +3
    // Race 2: started 5th,  finished 8th → -3
    // Race 3: started 3rd,  finished 1st → +2
    // Average: (3 - 3 + 2) / 3 = +0.67 → rounded to 1 decimal = 0.7
    expect(
      qualiRaceDelta([
        { grid: 10, classified: 7 },
        { grid: 5, classified: 8 },
        { grid: 3, classified: 1 },
      ]),
    ).toBeCloseTo(0.7, 1);
  });

  it("N10 · ignores DNFs (classified null) entirely", () => {
    expect(
      qualiRaceDelta([
        { grid: 10, classified: null },
        { grid: 5, classified: 1 }, // +4
        { grid: 5, classified: null },
      ]),
    ).toBeCloseTo(4, 1);
  });

  it("N11 · all DNFs → null (unknown delta, not zero)", () => {
    expect(
      qualiRaceDelta([
        { grid: 10, classified: null },
        { grid: 5, classified: null },
      ]),
    ).toBeNull();
  });

  it("N12 · empty → null", () => {
    expect(qualiRaceDelta([])).toBeNull();
  });
});
