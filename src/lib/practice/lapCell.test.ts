import { describe, it, expect } from "vitest";
import { lapCell } from "./lapCell";

/**
 * FP-L1..FP-L4 — Free-Practice banner lap-cell variant (design_handoff_phase11
 * §6, canvas screens-aux.jsx FpResultsBanner). Leader → absolute M:SS.mmm,
 * non-leader → "+gap", admin override → OVR, OpenF1-but-no-time → Awaiting.
 * Locked so a refactor can't drift which cell renders.
 */
describe("lapCell (design_handoff_phase11 §6)", () => {
  it("FP-L1: admin source → ovr (no lap, regardless of seconds)", () => {
    expect(lapCell({ pos: 1, lapSeconds: null }, null, "admin")).toEqual({
      kind: "ovr",
    });
    expect(lapCell({ pos: 2, lapSeconds: 90 }, 89, "admin")).toEqual({
      kind: "ovr",
    });
  });

  it("FP-L2: OpenF1 leader (pos 1) → absolute M:SS.mmm", () => {
    expect(
      lapCell({ pos: 1, lapSeconds: 89.847 }, 89.847, "openf1"),
    ).toEqual({ kind: "time", text: "1:29.847" });
  });

  it("FP-L3: OpenF1 non-leader → '+gap' to the leader", () => {
    expect(
      lapCell({ pos: 2, lapSeconds: 89.971 }, 89.847, "openf1"),
    ).toEqual({ kind: "time", text: "+0.124" });
    expect(
      lapCell({ pos: 3, lapSeconds: 90.259 }, 89.847, "openf1"),
    ).toEqual({ kind: "time", text: "+0.412" });
  });

  it("FP-L4: OpenF1 but no/invalid lap → awaiting", () => {
    expect(lapCell({ pos: 1, lapSeconds: null }, null, "openf1")).toEqual({
      kind: "awaiting",
    });
    expect(lapCell({ pos: 2, lapSeconds: 0 }, 89.8, "openf1")).toEqual({
      kind: "awaiting",
    });
  });
});
