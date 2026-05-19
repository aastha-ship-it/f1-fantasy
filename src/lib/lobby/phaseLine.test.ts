import { describe, it, expect } from "vitest";
import { phaseLine } from "./phaseLine";

/**
 * PL1–PL5 — Lobby preview-card phase line (design_handoff_phase11 §1 Col 2).
 * Verbatim strings + tone are the spec; lock them so a refactor can't drift
 * the copy or recolour a state. Pure mapping over the RevealState flags.
 */
describe("phaseLine (design_handoff_phase11 §1)", () => {
  it("PL1: sprint / non-progressive → 'Lock status only' (muted)", () => {
    expect(
      phaseLine({
        progressive: false,
        showP3: false,
        showP2: false,
        sessionOver: false,
      }),
    ).toEqual({ text: "Lock status only", tone: "muted" });
  });

  it("PL2: progressive + sessionOver → 'P3 + P2 revealed · P1 in the Reveal' (success)", () => {
    expect(
      phaseLine({
        progressive: true,
        showP3: true,
        showP2: true,
        sessionOver: true,
      }),
    ).toEqual({
      text: "P3 + P2 revealed · P1 in the Reveal",
      tone: "success",
    });
  });

  it("PL3: progressive + showP2, not over → 'P3 + P2 revealed · P2 just landed' (accent)", () => {
    expect(
      phaseLine({
        progressive: true,
        showP3: true,
        showP2: true,
        sessionOver: false,
      }),
    ).toEqual({
      text: "P3 + P2 revealed · P2 just landed",
      tone: "accent",
    });
  });

  it("PL4: progressive + showP3 only → 'P3 revealed · P2 reveals next' (accent)", () => {
    expect(
      phaseLine({
        progressive: true,
        showP3: true,
        showP2: false,
        sessionOver: false,
      }),
    ).toEqual({ text: "P3 revealed · P2 reveals next", tone: "accent" });
  });

  it("PL5: progressive, nothing open yet → 'Picks hidden — revealing as the session runs' (muted)", () => {
    expect(
      phaseLine({
        progressive: true,
        showP3: false,
        showP2: false,
        sessionOver: false,
      }),
    ).toEqual({
      text: "Picks hidden — revealing as the session runs",
      tone: "muted",
    });
  });
});
