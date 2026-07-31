// @vitest-environment jsdom
/**
 * PB1–PB2 — `<PracticeBanner>` mobile-fork locks (Task 11).
 *
 * PB1 guards the FP *session* grid: its column count is data-driven
 * (1 on a sprint weekend, 3 otherwise), so it used to live in an inline
 * `gridTemplateColumns`, which no breakpoint can reach. The fork keeps the
 * count in a CSS custom property and consumes it only at `md:` — a
 * single-column stack below the 780px fork.
 *
 * PB2 is the R3 preservation lock: the sanctioned 3px team-colour left edge
 * on FP rows (one of the three explicit exceptions to the no-accent-stripe
 * rule in `.impeccable.md`) must survive any restructuring of the row grid.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PracticeBanner } from "./PracticeBanner";
import type { FpSession } from "@/lib/practice/loadPractice";

const podium = (
  teams: [string, string, string],
): FpSession["top3"] =>
  teams.map((team, i) => ({
    pos: i + 1,
    driverId: i + 1,
    code: ["VER", "LEC", "HAM"][i],
    team,
    lapSeconds: 79.075 + i * 0.4,
  }));

const TEAMS: [string, string, string] = ["Ferrari", "McLaren", "Mercedes"];
const TEAM_HEX = ["#E8002D", "#FF8000", "#27F4D2"];

const session = (fpIndex: 1 | 2 | 3): FpSession => ({
  fpIndex,
  label: `FP${fpIndex}`,
  source: "openf1",
  startLabel: "Fri 13:30",
  top3: podium(TEAMS),
});

const THREE: FpSession[] = [session(1), session(2), session(3)];
const SPRINT: FpSession[] = [session(1)];

function sessionGrid(container: HTMLElement): HTMLElement {
  const header = container.querySelector("header");
  if (!header) throw new Error("PracticeBanner header not rendered");
  const grid = header.nextElementSibling as HTMLElement | null;
  if (!grid) throw new Error("session grid not rendered");
  return grid;
}

// jsdom normalises hex → rgb() in inline-style reads.
const hexToRgb = (hex: string): string => {
  const m = hex
    .replace("#", "")
    .match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
};

describe("PracticeBanner mobile fork (Task 11)", () => {
  it("PB1: FP session grid has no unconditional inline column template — single-column base, md: restoration from --fp-cols", () => {
    for (const sessions of [THREE, SPRINT]) {
      const { container } = render(<PracticeBanner sessions={sessions} />);
      const grid = sessionGrid(container);

      // An inline gridTemplateColumns applies at every viewport and cannot
      // carry a breakpoint — that is the defect.
      expect(grid.style.gridTemplateColumns).toBe("");

      // Mobile base: one column below the 780px fork.
      expect(grid.className).toMatch(/(^|\s)grid-cols-1(\s|$)/);

      // Desktop restoration reads the count from the custom property.
      expect(grid.className).toMatch(
        /(^|\s)md:\[grid-template-columns:repeat\(var\(--fp-cols\),1fr\)\](\s|$)/,
      );
      expect(grid.style.getPropertyValue("--fp-cols")).toBe(
        String(sessions.length),
      );
    }
  });

  it("PB3: FP row grid is a class with a minmax(0,1fr) flexible track — no inline template, no bare 1fr at any breakpoint", () => {
    const { container } = render(<PracticeBanner sessions={THREE} />);
    const rows = Array.from(container.querySelectorAll("li"));
    expect(rows.length).toBe(9);

    for (const row of rows) {
      // An inline template applies at every viewport and cannot carry a
      // breakpoint — that is the defect this row had.
      expect(row.style.gridTemplateColumns).toBe("");

      expect(row.className).toMatch(
        /(^|\s)grid-cols-\[32px_auto_minmax\(0,1fr\)_auto\](\s|$)/,
      );

      // A bare `1fr` flexible track lets the browser squeeze the `auto`
      // portrait column instead (measured: 28px -> 0px at 375px, 28px ->
      // 22.72px at 780px). `minmax(0,1fr)` reads as "minmax(0,1fr)" and
      // never as "_1fr_", so this catches the bare form in a base class OR
      // in any breakpoint restoration.
      expect(row.className).not.toMatch(/_1fr_/);
    }
  });

  it("PB2: every FP row keeps the sanctioned 3px team-colour left edge", () => {
    const { container } = render(<PracticeBanner sessions={THREE} />);
    const rows = Array.from(container.querySelectorAll("li"));
    expect(rows.length).toBe(9); // 3 sessions × top-3

    rows.forEach((row, i) => {
      const s = row.style;
      expect(s.borderLeftWidth).toBe("3px");
      expect(s.borderLeftStyle).toBe("solid");
      expect(s.borderLeftColor).toBe(hexToRgb(TEAM_HEX[i % 3]));
      // The stripe is the only accent edge — no top/right/bottom borders.
      expect(s.borderTop).toBe("");
      expect(s.borderRight).toBe("");
      expect(s.borderBottom).toBe("");
    });
  });
});
