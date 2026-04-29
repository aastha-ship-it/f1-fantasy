import { describe, it, expect } from "vitest";
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
});
