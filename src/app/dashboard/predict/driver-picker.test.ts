import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

describe("driver-picker mobile layout", () => {
  const src = readFileSync(
    resolve(__dirname, "driver-picker.tsx"),
    "utf8",
  );

  it("does not force a three-column slot grid at every width", () => {
    expect(src).not.toMatch(/gridTemplateColumns:\s*isSprint\s*\?\s*"1fr"\s*:\s*"1\.2fr 1fr 1fr"/);
  });

  it("guards the 320px slot-card floor behind md", () => {
    expect(src).not.toMatch(/className="[^"]*\bmin-h-\[320px\]/);
    expect(src).toMatch(/md:min-h-\[320px\]/);
  });

  it("gives the driver grid a 44px minimum tap target", () => {
    expect(src).toMatch(/min-h-\[44px\]/);
  });
});
