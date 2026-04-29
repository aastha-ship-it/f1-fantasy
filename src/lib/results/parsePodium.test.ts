import { describe, it, expect } from "vitest";
import { parsePodium } from "./parsePodium";

describe("parsePodium (race)", () => {
  it("F1 · picks positions 1, 2, 3 from OpenF1 session_result rows", () => {
    const rows = [
      { driver_number: 11, position: 4 },
      { driver_number: 1, position: 1 },
      { driver_number: 16, position: 2 },
      { driver_number: 4, position: 3 },
      { driver_number: 81, position: 5 },
    ];
    expect(parsePodium(rows, false)).toEqual({ p1: 1, p2: 16, p3: 4 });
  });

  it("F2 · ignores DNF rows (position null) when filling the podium", () => {
    const rows = [
      { driver_number: 1, position: null },
      { driver_number: 11, position: 1 },
      { driver_number: 16, position: 2 },
      { driver_number: 4, position: 3 },
    ];
    expect(parsePodium(rows, false)).toEqual({ p1: 11, p2: 16, p3: 4 });
  });

  it("F3 · throws if fewer than 3 classified finishers for a race", () => {
    expect(() =>
      parsePodium(
        [
          { driver_number: 1, position: 1 },
          { driver_number: 16, position: 2 },
        ],
        false,
      ),
    ).toThrow(/podium incomplete/i);
  });
});

describe("parsePodium (sprint)", () => {
  it("F4 · sprint returns only P1; P2/P3 null", () => {
    const rows = [
      { driver_number: 11, position: 1 },
      { driver_number: 1, position: 2 },
      { driver_number: 16, position: 3 },
    ];
    expect(parsePodium(rows, true)).toEqual({ p1: 11, p2: null, p3: null });
  });

  it("F5 · sprint throws if no winner classified", () => {
    expect(() =>
      parsePodium(
        [
          { driver_number: 1, position: null },
          { driver_number: 16, position: null },
        ],
        true,
      ),
    ).toThrow(/no winner/i);
  });
});
