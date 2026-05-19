import { describe, it, expect } from "vitest";
import { overrideBadge } from "./overrideBadge";

/**
 * FP-OB1..FP-OB4 — Admin FP-override status badge (design_handoff_phase11
 * §8, canvas screens-aux.jsx FpOverrideRow:135-140). active/saved/cleared
 * sit on --surface-2; "Using OpenF1" is the bare default. Locked so the
 * label/colour can't drift (saved/cleared also drive the transient flash).
 */
describe("overrideBadge (design_handoff_phase11 §8)", () => {
  it("FP-OB1: active → 'Override active' / warning / surface-2", () => {
    expect(overrideBadge("active")).toEqual({
      label: "Override active",
      color: "var(--warning)",
      bg: "var(--surface-2)",
    });
  });

  it("FP-OB2: saved → '✓ Saved · overrides OpenF1' / success / surface-2", () => {
    expect(overrideBadge("saved")).toEqual({
      label: "✓ Saved · overrides OpenF1",
      color: "var(--success)",
      bg: "var(--surface-2)",
    });
  });

  it("FP-OB3: cleared → '✓ Cleared · using OpenF1' / fg-muted / surface-2", () => {
    expect(overrideBadge("cleared")).toEqual({
      label: "✓ Cleared · using OpenF1",
      color: "var(--fg-muted)",
      bg: "var(--surface-2)",
    });
  });

  it("FP-OB4: using → 'Using OpenF1' / fg-subtle / transparent", () => {
    expect(overrideBadge("using")).toEqual({
      label: "Using OpenF1",
      color: "var(--fg-subtle)",
      bg: "transparent",
    });
  });
});
