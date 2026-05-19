import { describe, it, expect } from "vitest";
import { orderRecentForm } from "@/lib/nudges/recentForm";

/**
 * RF1.. — recent-form strip ordering (design_handoff_phase11 §11 / ADDENDUM
 * Diff §4). `driver_nudges.recent_form` is stored most-recent-first; the
 * strip renders oldest-left → latest-right (sports convention), so the
 * rightmost pip is the latest and gets the ↑ LATEST tag. Pure extraction
 * from the inline IIFE in driver-picker.tsx — behaviour-preserving.
 */
describe("orderRecentForm", () => {
  it("RF1: most-recent-first input → oldest-left, latest-right", () => {
    expect(orderRecentForm("P1·P3·DNF·P2·P1")).toEqual([
      "P1",
      "P2",
      "DNF",
      "P3",
      "P1",
    ]);
  });

  it("RF2: empty / null / undefined → []", () => {
    expect(orderRecentForm("")).toEqual([]);
    expect(orderRecentForm(null)).toEqual([]);
    expect(orderRecentForm(undefined)).toEqual([]);
  });

  it("RF3: trims tokens and drops empty segments", () => {
    expect(orderRecentForm(" P1 · · P2 ")).toEqual(["P2", "P1"]);
  });

  it("RF4: single token → that token (latest === only)", () => {
    expect(orderRecentForm("P1")).toEqual(["P1"]);
  });
});
