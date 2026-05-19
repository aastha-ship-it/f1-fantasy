import { describe, it, expect } from "vitest";
import { slotBadge } from "@/lib/computeScores";

/**
 * RS1.. — reveal FriendCard pick-row badge (design_handoff_phase11 §C /
 * ADDENDUM Diff §4). The wrong-slot ("on podium") row must NEVER show
 * per-row points — only the semantic label. The non-linear bucket number
 * lives solely in the bucket-tally row (locked by computeScores BD*).
 * Pure extraction from the inline badge ternary in reveal-stage.tsx —
 * behaviour-preserving.
 */
describe("slotBadge", () => {
  it("RS1: on-podium-wrong-slot badge carries NO number", () => {
    const b = slotBadge("onPodium");
    expect(b.text).toBe("⊙ On podium");
    expect(b.text).not.toMatch(/\d/); // no "+2" etc. on the row
    expect(b.color).toBe("var(--warning)");
    expect(b.weight).toBe(600);
  });

  it("RS2: miss badge carries NO number", () => {
    const b = slotBadge("miss");
    expect(b.text).toBe("× Miss");
    expect(b.text).not.toMatch(/\d/);
    expect(b.color).toBe("var(--fg-subtle)");
    expect(b.weight).toBe(400);
  });

  it("RS3: exact badge shows only the fixed per-driver +5 (by spec)", () => {
    const b = slotBadge("exact");
    expect(b.text).toBe("✓ Exact +5");
    expect(b.color).toBe("var(--success)");
    expect(b.weight).toBe(600);
  });
});
