import { describe, it, expect } from "vitest";
import { openF1BannerState } from "./bannerState";

/**
 * BS1–BS4 — Admin OpenF1-fetch banner state machine (design_handoff_phase11
 * §7). Pure derivation from (revealed, hasResults, results.source):
 *   revealed → revealed (precedence — frozen once the cinematic fired)
 *   no results → idle
 *   source 'admin' → official (manual entry or accepted fetch; Phase-12 frozen)
 *   results + 'openf1', not revealed → provisional
 */
describe("openF1BannerState (design_handoff_phase11 §7)", () => {
  it("BS1: revealed wins regardless of results/source", () => {
    expect(
      openF1BannerState({ revealed: true, hasResults: true, source: "admin" }),
    ).toBe("revealed");
    expect(
      openF1BannerState({ revealed: true, hasResults: false, source: null }),
    ).toBe("revealed");
  });

  it("BS2: not revealed, no results → idle", () => {
    expect(
      openF1BannerState({ revealed: false, hasResults: false, source: null }),
    ).toBe("idle");
  });

  it("BS3: results + source 'admin', not revealed → official", () => {
    expect(
      openF1BannerState({ revealed: false, hasResults: true, source: "admin" }),
    ).toBe("official");
  });

  it("BS4: results + source 'openf1', not revealed → provisional", () => {
    expect(
      openF1BannerState({
        revealed: false,
        hasResults: true,
        source: "openf1",
      }),
    ).toBe("provisional");
    // null source with results (legacy row) is treated as provisional too.
    expect(
      openF1BannerState({ revealed: false, hasResults: true, source: null }),
    ).toBe("provisional");
  });
});
