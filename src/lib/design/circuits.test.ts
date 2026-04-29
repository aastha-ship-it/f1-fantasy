import { describe, it, expect } from "vitest";
import { circuitMeta } from "./circuits";

describe("circuitMeta", () => {
  it("D13 · returns length + laps for known Jolpica circuit_ids", () => {
    expect(circuitMeta("miami")).toEqual({ lengthKm: 5.412, laps: 57 });
    expect(circuitMeta("monaco")).toEqual({ lengthKm: 3.337, laps: 78 });
    expect(circuitMeta("silverstone")).toEqual({ lengthKm: 5.891, laps: 52 });
  });

  it("D14 · resolves OpenF1 aliases", () => {
    expect(circuitMeta("Sakhir")?.lengthKm).toBe(5.412);
    expect(circuitMeta("Monte Carlo")?.laps).toBe(78);
    expect(circuitMeta("Las Vegas")?.lengthKm).toBe(6.201);
  });

  it("D15 · null for unknown", () => {
    expect(circuitMeta(null)).toBeNull();
    expect(circuitMeta("nowhere")).toBeNull();
  });
});
