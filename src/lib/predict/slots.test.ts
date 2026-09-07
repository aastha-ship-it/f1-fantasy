import { describe, it, expect } from "vitest";
import {
  isSprintSession,
  slotCount,
  slotDriverIds,
  allSlotsFilled,
} from "@/lib/predict/slots";

/**
 * PS1.. — podium slot shape per session type.
 *
 * The acceptance check the mobile addendum asks for ("a sprint-weekend
 * session row renders one pick chip, a race row renders three") lands here:
 * `/dashboard/predict/round/[round]` is an async server component and cannot
 * be render-tested, but both of its chip rows — the `md:hidden` mobile tree
 * and the `hidden md:contents` desktop one — map the SAME `slotDriverIds`
 * array, so the count is proven once for both.
 */
describe("predict slot shape", () => {
  it("PS1: sprint sessions score P1 only → one slot", () => {
    expect(slotCount("sprint_quali")).toBe(1);
    expect(slotCount("sprint_race")).toBe(1);
    expect(isSprintSession("sprint_quali")).toBe(true);
    expect(isSprintSession("sprint_race")).toBe(true);
  });

  it("PS2: quali and race take a full podium → three slots", () => {
    expect(slotCount("quali")).toBe(3);
    expect(slotCount("race")).toBe(3);
    expect(isSprintSession("quali")).toBe(false);
    expect(isSprintSession("race")).toBe(false);
  });

  it("PS3: an unknown session type falls back to three, never zero", () => {
    // Defensive: a session_type added to the enum without touching this
    // helper must still render a chip row, not an empty one.
    expect(slotCount("practice")).toBe(3);
    expect(slotDriverIds("practice", null)).toHaveLength(3);
  });

  it("PS4: slotDriverIds returns one id for a sprint, three for a race", () => {
    const pick = {
      p1_driver_id: 4,
      p2_driver_id: 16,
      p3_driver_id: 81,
    };
    expect(slotDriverIds("sprint_race", pick)).toEqual([4]);
    expect(slotDriverIds("race", pick)).toEqual([4, 16, 81]);
  });

  it("PS5: a missing pick row keeps the row shape, filled with null", () => {
    expect(slotDriverIds("sprint_quali", null)).toEqual([null]);
    expect(slotDriverIds("quali", undefined)).toEqual([null, null, null]);
  });

  it("PS6: allSlotsFilled is true only when every slot has a driver", () => {
    expect(allSlotsFilled([4])).toBe(true);
    expect(allSlotsFilled([null])).toBe(false);
    expect(allSlotsFilled([4, 16, 81])).toBe(true);
    expect(allSlotsFilled([4, 16, null])).toBe(false);
    // A sprint row is "filled" on one driver — it must not be judged
    // against the three-slot shape.
    expect(allSlotsFilled(slotDriverIds("sprint_race", { p1_driver_id: 4, p2_driver_id: null, p3_driver_id: null }))).toBe(true);
    expect(allSlotsFilled([])).toBe(false);
  });
});
