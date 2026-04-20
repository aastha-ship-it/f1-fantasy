import { describe, it, expect } from "vitest";
import {
  validatePrediction,
  ValidationError,
  type SessionType,
} from "./validatePrediction";

const ACTIVE_DRIVERS = new Set<number>([1, 4, 16, 44, 63, 81]);

function ctx(sessionType: SessionType) {
  return { sessionType, activeDriverIds: ACTIVE_DRIVERS };
}

describe("validatePrediction", () => {
  it("U8 · invalid driver_id → throws ValidationError", () => {
    expect(() =>
      validatePrediction({ p1: 1, p2: 4, p3: 99 }, ctx("race")),
    ).toThrow(ValidationError);
  });

  it("U9 · sprint sent with P2/P3 → throws ValidationError", () => {
    expect(() =>
      validatePrediction({ p1: 1, p2: 4, p3: 16 }, ctx("sprint_race")),
    ).toThrow(ValidationError);
  });

  it("U10 · race sent without P2/P3 → throws ValidationError", () => {
    expect(() =>
      validatePrediction({ p1: 1, p2: null, p3: null }, ctx("race")),
    ).toThrow(ValidationError);
  });

  it("happy · race with 3 valid distinct drivers passes", () => {
    expect(() =>
      validatePrediction({ p1: 1, p2: 4, p3: 16 }, ctx("race")),
    ).not.toThrow();
  });

  it("happy · sprint with only P1 valid driver passes", () => {
    expect(() =>
      validatePrediction(
        { p1: 44, p2: null, p3: null },
        ctx("sprint_quali"),
      ),
    ).not.toThrow();
  });

  it("edge · duplicate driver across slots throws ValidationError", () => {
    // Implicit invariant: a driver can't finish in two positions.
    expect(() =>
      validatePrediction({ p1: 1, p2: 1, p3: 16 }, ctx("race")),
    ).toThrow(ValidationError);
  });
});
