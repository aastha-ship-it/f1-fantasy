import { describe, it, expect } from "vitest";
import { pillFill } from "./pillFill";

/**
 * SR1–SR3 — Show-Reel session-pill accent fill % (design_handoff_phase11
 * §3, canvas screens-lobby.jsx:636). perfect → 28, ≥10 pts → 18, else 10.
 * Locked so the standout-session emphasis can't silently drift.
 */
describe("pillFill (design_handoff_phase11 §3)", () => {
  it("SR1: perfect podium → 28", () => {
    expect(pillFill(true, 18)).toBe(28);
    expect(pillFill(true, 0)).toBe(28);
  });

  it("SR2: not perfect, ≥10 pts → 18", () => {
    expect(pillFill(false, 10)).toBe(18);
    expect(pillFill(false, 18)).toBe(18);
  });

  it("SR3: <10 pts, or unscored (null) → 10", () => {
    expect(pillFill(false, 9)).toBe(10);
    expect(pillFill(false, 0)).toBe(10);
    expect(pillFill(false, null)).toBe(10);
  });
});
