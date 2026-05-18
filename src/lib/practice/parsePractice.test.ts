import { describe, it, expect } from "vitest";
import { parsePractice, type PracticeResultRow } from "./parsePractice";

const MAP = new Map<number, { id: number; code: string; team: string }>([
  [1, { id: 1, code: "VER", team: "Red Bull Racing" }],
  [81, { id: 81, code: "PIA", team: "McLaren" }],
  [23, { id: 23, code: "ALB", team: "Williams" }],
  [63, { id: 63, code: "RUS", team: "Mercedes" }],
  [44, { id: 44, code: "HAM", team: "Ferrari" }],
]);

describe("parsePractice", () => {
  it("FP-P1 · returns the top 3 by position with code/team/lap", () => {
    const rows: PracticeResultRow[] = [
      { driver_number: 1, position: 1, duration: 103.372 },
      { driver_number: 81, position: 2, duration: 103.903 },
      { driver_number: 23, position: 3, duration: 104.099 },
      { driver_number: 63, position: 4, duration: 104.225 },
      { driver_number: 44, position: 5, duration: 104.279 },
    ];
    expect(parsePractice(rows, MAP)).toEqual([
      { pos: 1, driverId: 1, code: "VER", team: "Red Bull Racing", lapSeconds: 103.372 },
      { pos: 2, driverId: 81, code: "PIA", team: "McLaren", lapSeconds: 103.903 },
      { pos: 3, driverId: 23, code: "ALB", team: "Williams", lapSeconds: 104.099 },
    ]);
  });

  it("FP-P2 · sorts by position and drops unclassified (null position)", () => {
    const rows: PracticeResultRow[] = [
      { driver_number: 23, position: 3, duration: 104.099 },
      { driver_number: 99, position: null, duration: null },
      { driver_number: 1, position: 1, duration: 103.372 },
      { driver_number: 81, position: 2, duration: 103.903 },
    ];
    expect(parsePractice(rows, MAP).map((e) => e.code)).toEqual([
      "VER",
      "PIA",
      "ALB",
    ]);
  });

  it("FP-P3 · returns fewer than 3 when fewer are classified", () => {
    const rows: PracticeResultRow[] = [
      { driver_number: 1, position: 1, duration: 103.372 },
      { driver_number: 81, position: 2, duration: 103.903 },
    ];
    const out = parsePractice(rows, MAP);
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.pos)).toEqual([1, 2]);
  });

  it("FP-P4 · skips drivers missing from the map, keeps filling to 3", () => {
    const rows: PracticeResultRow[] = [
      { driver_number: 1, position: 1, duration: 103.372 },
      { driver_number: 777, position: 2, duration: 103.9 }, // not in MAP
      { driver_number: 23, position: 3, duration: 104.099 },
      { driver_number: 63, position: 4, duration: 104.225 },
    ];
    expect(parsePractice(rows, MAP).map((e) => ({ pos: e.pos, code: e.code }))).toEqual([
      { pos: 1, code: "VER" },
      { pos: 3, code: "ALB" },
      { pos: 4, code: "RUS" },
    ]);
  });

  it("FP-P5 · lapSeconds is null when duration missing/zero", () => {
    const rows: PracticeResultRow[] = [
      { driver_number: 1, position: 1, duration: undefined },
      { driver_number: 81, position: 2, duration: 0 },
      { driver_number: 23, position: 3, duration: null },
    ];
    expect(parsePractice(rows, MAP).map((e) => e.lapSeconds)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("FP-P6 · empty input → empty array", () => {
    expect(parsePractice([], MAP)).toEqual([]);
  });
});
