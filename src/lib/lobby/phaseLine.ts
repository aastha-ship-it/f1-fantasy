/**
 * Lobby preview-card phase line (design_handoff_phase11 §1, Col 2).
 *
 * Pure mapping over the progressive-reveal flags → the verbatim copy +
 * tone the design spec dictates. Kept separate from the view so the exact
 * strings are unit-locked (PL1–PL5) and can't silently drift.
 */

export type PhaseTone = "muted" | "accent" | "success";

export type PhaseLine = { text: string; tone: PhaseTone };

export function phaseLine(s: {
  progressive: boolean;
  showP3: boolean;
  showP2: boolean;
  sessionOver: boolean;
}): PhaseLine {
  if (!s.progressive) return { text: "Lock status only", tone: "muted" };
  if (s.sessionOver)
    return { text: "P3 + P2 revealed · P1 in the Reveal", tone: "success" };
  if (s.showP2)
    return { text: "P3 + P2 revealed · P2 just landed", tone: "accent" };
  if (s.showP3)
    return { text: "P3 revealed · P2 reveals next", tone: "accent" };
  return {
    text: "Picks hidden — revealing as the session runs",
    tone: "muted",
  };
}
