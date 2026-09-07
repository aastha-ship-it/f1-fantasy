import { describe, it, expect } from "vitest";
import { formatLockDelta } from "./lockDelta";

const D = 86_400_000;
const H = 3_600_000;
const M = 60_000;

describe("formatLockDelta", () => {
  it("D24 · days branch shows two units and zero-pads the hour", () => {
    expect(formatLockDelta(2 * D + 4 * H + 23 * M)).toBe("2d 04h");
  });

  it("D25 · `precise` adds the minutes term for the mobile lobby card", () => {
    expect(formatLockDelta(2 * D + 14 * H + 23 * M, { precise: true })).toBe(
      "2d 14h 23m",
    );
  });

  it("D26 · sub-day and sub-hour branches are unaffected by `precise`", () => {
    expect(formatLockDelta(1 * H + 30 * M)).toBe("1h 30m");
    expect(formatLockDelta(1 * H + 30 * M, { precise: true })).toBe("1h 30m");
    expect(formatLockDelta(45 * M)).toBe("45m");
  });

  it("D27 · non-positive deltas read as Locked, not a negative duration", () => {
    expect(formatLockDelta(0)).toBe("Locked");
    expect(formatLockDelta(-5 * M)).toBe("Locked");
  });
});
