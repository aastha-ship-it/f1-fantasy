import { describe, it, expect } from "vitest";
import { formPillColor } from "./formColor";

/**
 * L5-1..L5-4 — Form-L5 pip colour map (design_handoff_phase11 §11).
 * Verbatim spec: DNF → --error, P1/P2/P3 → --success, P4–P10 → --fg,
 * everything else → --fg-subtle. Locked so the map can't drift (it had
 * regressed to --fg-muted on the "else" bucket before this PR).
 */
describe("formPillColor (design_handoff_phase11 §11)", () => {
  it("L5-1: DNF / DNS / DSQ / em-dash → --error", () => {
    for (const t of ["DNF", "dns", " DSQ ", "—"]) {
      expect(formPillColor(t)).toBe("var(--error)");
    }
  });

  it("L5-2: P1 / P2 / P3 (podium) → --success", () => {
    for (const t of ["P1", "p2", "3", " P3 "]) {
      expect(formPillColor(t)).toBe("var(--success)");
    }
  });

  it("L5-3: P4 … P10 (points / midfield) → --fg", () => {
    for (const t of ["P4", "p7", "10", " P10 "]) {
      expect(formPillColor(t)).toBe("var(--fg)");
    }
  });

  it("L5-4: P11+ / unknown → --fg-subtle (not --fg-muted)", () => {
    for (const t of ["P11", "20", "", "??", "NC"]) {
      expect(formPillColor(t)).toBe("var(--fg-subtle)");
    }
  });
});
