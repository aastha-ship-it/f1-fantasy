import { describe, it, expect } from "vitest";
import { formatLapTime } from "./formatLapTime";

describe("formatLapTime", () => {
  it("FP-T1 · formats a normal lap as M:SS.mmm", () => {
    expect(formatLapTime(103.372)).toBe("1:43.372");
  });

  it("FP-T2 · zero-pads seconds and milliseconds", () => {
    expect(formatLapTime(83.5)).toBe("1:23.500");
    expect(formatLapTime(90)).toBe("1:30.000");
  });

  it("FP-T3 · sub-minute lap keeps the 0: minute", () => {
    expect(formatLapTime(59.999)).toBe("0:59.999");
  });

  it("FP-T4 · rounds to whole milliseconds", () => {
    expect(formatLapTime(103.3724)).toBe("1:43.372");
    expect(formatLapTime(103.3726)).toBe("1:43.373");
  });

  it("FP-T5 · returns null-safe dash for null/invalid", () => {
    expect(formatLapTime(null)).toBe("—");
    expect(formatLapTime(undefined)).toBe("—");
    expect(formatLapTime(0)).toBe("—");
    expect(formatLapTime(Number.NaN)).toBe("—");
  });
});
