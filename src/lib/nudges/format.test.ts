import { describe, it, expect } from "vitest";
import { formatAtTrack } from "./format";

/**
 * D25 — at-track copy formatter for the predict-detail telemetry strip.
 *
 *   null/null         → "—"          (data is missing — historical_results
 *                                     hasn't been backfilled for the circuit)
 *   0/0               → "0 podiums"  (driver has raced but never podiumed)
 *   0/n               → "n podium(s)" (no wins; tight string, no "0 wins ·")
 *   w/p (w >= 1)      → "w win(s) · p podium(s)"
 *
 * Wins are always ≤ podiums by construction, but we don't enforce that here —
 * the helper is purely string formatting.
 */
describe("D25 · formatAtTrack", () => {
  it("D25.1 null wins + null podiums → em dash", () => {
    expect(formatAtTrack(null, null)).toBe("—");
  });

  it("D25.2 zero wins, zero podiums → '0 podiums'", () => {
    expect(formatAtTrack(0, 0)).toBe("0 podiums");
  });

  it("D25.3 zero wins, two podiums → '2 podiums' (no '0 wins · ' prefix)", () => {
    expect(formatAtTrack(0, 2)).toBe("2 podiums");
  });

  it("D25.4 one win, two podiums → '1 win · 2 podiums'", () => {
    expect(formatAtTrack(1, 2)).toBe("1 win · 2 podiums");
  });

  it("D25.5 two wins, five podiums → '2 wins · 5 podiums'", () => {
    expect(formatAtTrack(2, 5)).toBe("2 wins · 5 podiums");
  });

  it("D25.6 one win, one podium → '1 win · 1 podium' (both singular)", () => {
    expect(formatAtTrack(1, 1)).toBe("1 win · 1 podium");
  });

  it("D25.7 null wins but a real podium count → falls back to podiums-only", () => {
    // Defensive: legacy rows from before the wins column will read null/wins
    // and a number/podiums. Keep them readable rather than rendering "—".
    expect(formatAtTrack(null, 3)).toBe("3 podiums");
  });
});
