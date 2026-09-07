import { describe, it, expect, afterEach } from "vitest";
import { formatSessionClock } from "./sessionLabel";

describe("formatSessionClock", () => {
  const realTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = realTz;
  });

  it("S1 · renders WEEKDAY HH:MM TZ, uppercased and comma-free", () => {
    process.env.TZ = "Asia/Calcutta";
    // 2026-05-02T11:00Z is Saturday 16:30 in IST.
    expect(formatSessionClock("2026-05-02T11:00:00Z")).toBe("SAT 16:30 IST");
  });

  it("S2 · follows the viewer's timezone, weekday included", () => {
    process.env.TZ = "America/Los_Angeles";
    // Same instant is Saturday 04:00 on the US west coast.
    expect(formatSessionClock("2026-05-02T11:00:00Z")).toMatch(/^SAT 04:00 /);
  });

  it("S3 · midnight is 00:00, never 24:00 (the hour12:false trap)", () => {
    process.env.TZ = "UTC";
    expect(formatSessionClock("2026-05-03T00:00:00Z")).toBe("SUN 00:00 UTC");
  });

  it("S4 · an unparseable value degrades to a string, never throws", () => {
    expect(() => formatSessionClock("not-a-date")).not.toThrow();
  });
});
