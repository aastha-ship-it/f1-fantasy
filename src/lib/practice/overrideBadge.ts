/**
 * Admin FP-override status badge (design_handoff_phase11 §8).
 *
 * Pure status → {label,color,bg} map (verbatim from the canvas
 * `FpOverrideRow`). `active`/`using` are the persistent states;
 * `saved`/`cleared` are the transient post-action confirmations the form
 * flashes for ~2s before reverting. Unit-locked FP-OB1..FP-OB4.
 */
export type OverrideStatus = "using" | "active" | "saved" | "cleared";

export function overrideBadge(status: OverrideStatus): {
  label: string;
  color: string;
  bg: string;
} {
  if (status === "active") {
    return {
      label: "Override active",
      color: "var(--warning)",
      bg: "var(--surface-2)",
    };
  }
  if (status === "saved") {
    return {
      label: "✓ Saved · overrides OpenF1",
      color: "var(--success)",
      bg: "var(--surface-2)",
    };
  }
  if (status === "cleared") {
    return {
      label: "✓ Cleared · using OpenF1",
      color: "var(--fg-muted)",
      bg: "var(--surface-2)",
    };
  }
  return { label: "Using OpenF1", color: "var(--fg-subtle)", bg: "transparent" };
}
