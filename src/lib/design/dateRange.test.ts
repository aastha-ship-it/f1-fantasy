import { describe, it, expect, afterEach } from "vitest";
import { formatDateRange } from "./dateRange";

describe("formatDateRange", () => {
  it("D19 · multi-day same month renders as `dayA - dayB Month`", () => {
    // Miami 2026: 2 May (Fri practice) → 4 May (Sun race)
    expect(
      formatDateRange("2026-05-02T00:00:00Z", "2026-05-04T00:00:00Z"),
    ).toBe("2 - 4 May");
  });

  it("D20 · cross-month range names both months", () => {
    // Hypothetical: 31 May → 2 Jun
    expect(
      formatDateRange("2026-05-31T12:00:00Z", "2026-06-02T12:00:00Z"),
    ).toBe("31 May - 2 Jun");
  });

  it("D21 · single-day range collapses to `day Month`", () => {
    expect(
      formatDateRange("2026-05-04T00:00:00Z", "2026-05-04T00:00:00Z"),
    ).toBe("4 May");
  });

  // The helper is documented against UTC instants, so its output must not
  // depend on the machine's timezone. Pinned explicitly: without a TZ the
  // assertion passes vacuously wherever CI happens to run at UTC.
  describe("timezone independence", () => {
    const realTz = process.env.TZ;
    afterEach(() => {
      process.env.TZ = realTz;
    });

    it("D22 · a late-evening UTC start does not roll the month forward", () => {
      // Round 20, Mexico City: 2026-10-31T21:00Z is 1 Nov local in IST.
      // Reading the month locally while the day stays UTC printed "31 Nov".
      process.env.TZ = "Asia/Calcutta";
      expect(
        formatDateRange("2026-10-31T21:00:00Z", "2026-10-31T21:00:00Z"),
      ).toBe("31 Oct");
    });

    it("D23 · same instants render identically either side of UTC", () => {
      process.env.TZ = "Asia/Calcutta";
      const ahead = formatDateRange(
        "2026-10-31T21:00:00Z",
        "2026-11-01T21:00:00Z",
      );
      process.env.TZ = "America/Los_Angeles";
      const behind = formatDateRange(
        "2026-10-31T21:00:00Z",
        "2026-11-01T21:00:00Z",
      );
      expect(ahead).toBe("31 Oct - 1 Nov");
      expect(behind).toBe(ahead);
    });
  });
});
