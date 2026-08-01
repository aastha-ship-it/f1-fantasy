import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

describe("reveal variant plumbing", () => {
  const stage = readFileSync(resolve(__dirname, "reveal-stage.tsx"), "utf8");
  const page = readFileSync(resolve(__dirname, "page.tsx"), "utf8");

  it("accepts a variant prop", () => {
    expect(stage).toMatch(/variant\s*[:?]/);
    expect(stage).toMatch(/"portrait"\s*\|\s*"wide"/);
  });

  it("derives the variant from the UA on the server", () => {
    expect(page).toMatch(/isPhoneUA/);
    expect(page).toMatch(/headers\(\)/);
  });

  it("keeps exactly one set of timing constants", () => {
    // A second PODIUM_STAGGER means the two timelines can drift apart.
    const matches = stage.match(/const PODIUM_STAGGER/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});
