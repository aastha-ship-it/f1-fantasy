/**
 * Form-L5 pip colour (design_handoff_phase11 §11).
 *
 * Pure token → design-token-colour map for the predict-detail recent-form
 * strip. §11 anatomy is colour-of-text only (the latest pip's surface/border
 * box is applied at render). Unit-locked L5-1..L5-4.
 *
 *   DNF / DNS / DSQ / —  → var(--error)
 *   P1 / P2 / P3         → var(--success)
 *   P4 … P10             → var(--fg)
 *   anything else        → var(--fg-subtle)
 */
export function formPillColor(token: string): string {
  const t = token.trim().toUpperCase();
  if (t === "DNF" || t === "DNS" || t === "DSQ" || t === "—") {
    return "var(--error)";
  }
  const m = t.match(/^P?(\d+)$/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 3) return "var(--success)";
    if (n >= 4 && n <= 10) return "var(--fg)";
  }
  return "var(--fg-subtle)";
}
