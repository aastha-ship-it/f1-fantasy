// @vitest-environment jsdom
/**
 * SL1–SL4 — ScoringLegendBody verbatim copy regression (changes.md §4 design
 * pass, Phase 14 PR 1). The point-system wording is the spec; the canvas
 * truth is design_handoff_phase11/design/screens-lobby.jsx (LegendSection).
 * These lock the exact strings so a future refactor can't silently drift
 * them. Behavior-level (asserts rendered text), so it survives the chrome /
 * sizing refactor in the same PR.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ScoringLegendBody } from "./ScoringLegend";

function text() {
  return render(<ScoringLegendBody />).container.textContent ?? "";
}

describe("ScoringLegendBody copy (changes.md §4)", () => {
  it("SL1: on-podium wrong-slot rows use parenthesized wording", () => {
    const t = text();
    expect(t).toContain("1 of your drivers on the podium (wrong slot)");
    expect(t).toContain("2 of your drivers on the podium (wrong slot)");
    expect(t).toContain("3 of your drivers on the podium (wrong slot)");
    expect(t).not.toContain("on the podium, wrong slot");
  });

  it("SL2: Race & Qualifying subtitle explains the non-linear bucket", () => {
    const t = text();
    expect(t).toContain(
      "Predict the top three. Every driver scores independently — then a non-linear bucket rewards getting the whole podium even when jumbled.",
    );
  });

  it("SL3: Worked examples uses the canvas wording", () => {
    const t = text();
    expect(t).toContain("Perfect podium — all three exact (+ bonus)");
    expect(t).toContain("How the pieces add up across one podium prediction.");
    expect(t).not.toContain("Perfect podium (3 exact + bonus)");
    expect(t).not.toContain("across a single podium prediction");
  });

  it("SL4: footnote states the max-points rule in canvas wording", () => {
    const t = text();
    expect(t).toContain("Max for a race/quali session is");
    expect(t).toContain("18");
    expect(t).not.toContain("Maximum for a race or qualifying session");
  });
});
